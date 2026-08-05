'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import {
Clock3,
User,
Package,
MapPin,
Search,
CheckCircle2,
AlertCircle,
Users,
Calendar,
Briefcase,
Building2,
Filter,
Wrench,
X,
Phone,
Pencil,
Eye,
} from 'lucide-react';

export default function OrdersSchedulePage() {
const supabase = createClient();

const [orders, setOrders] = useState<any[]>([]);
const [executors, setExecutors] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [savingId, setSavingId] = useState<string | null>(null);

// Search & Filter States
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState('all');
const [isFilterOpen, setIsFilterOpen] = useState(false);

// Modal state
const [viewOrder, setViewOrder] = useState<any | null>(null); // order being viewed (read-only)
const [scheduleOrder, setScheduleOrder] = useState<any | null>(null); // order being scheduled (draft edits live here)

// Validation errors for the schedule popup — keyed by field name
const [scheduleErrors, setScheduleErrors] = useState<{ [key: string]: string }>({});

// Available filter options for the dropdown
const filterOptions = [
'All',
'Scheduled',
'Unscheduled',
'Accepted',
'Rejected',
'Ongoing',
'Completed',
];

useEffect(() => {
fetchData();
}, []);

// =====================================
// FETCH ALL DATA
// =====================================
const fetchData = async () => {
setLoading(true);

await Promise.all([fetchOrders(), fetchExecutors()]);

setLoading(false);
};

// =====================================
// FETCH EXECUTORS
// =====================================
const fetchExecutors = async () => {
const { data, error } = await supabase
.from('executors')
.select(`
id,
full_name,
email,
phone,
company_name,
pincode,
service_type,
job_id,
status
`)
.eq('status', 'active')
.order('full_name', { ascending: true });

if (!error && data) {
setExecutors(data);
}
};

// =====================================
// FETCH ORDERS
// =====================================
const fetchOrders = async () => {
const { data, error } = await supabase
.from('orders')
.select('*')
.order('created_at', { ascending: false });

if (!error && data) {
setOrders(data);
}
};

// =====================================
// AUTO SUGGEST EXECUTORS
// =====================================
const getSuggestedExecutors = (order: any) => {
return executors.filter(executor => {
const samePincode =
executor.pincode?.toString() === order.pincode?.toString();
const serviceMatch = executor.service_type?.includes(
order.type_of_service
);
return samePincode || serviceMatch;
});
};

// =====================================
// VALIDATE SCHEDULE DRAFT
// Executor, Date, and Time are all compulsory before saving
// =====================================
const validateSchedule = (order: any) => {
const errors: { [key: string]: string } = {};

if (!order.assigned_executor_id) {
errors.assigned_executor_id = 'Please allot an executor';
}
if (!order.scheduled_date) {
errors.scheduled_date = 'Please pick a schedule date';
}
if (!order.scheduled_time) {
errors.scheduled_time = 'Please pick a schedule time';
}

return errors;
};

// =====================================
// SAVE SCHEDULE (used by the popup)
// =====================================
const saveSchedule = async (order: any) => {
// Block saving until Executor + Date + Time are all filled in
const errors = validateSchedule(order);
if (Object.keys(errors).length > 0) {
setScheduleErrors(errors);
return;
}
setScheduleErrors({});

try {
setSavingId(order.id);

const selectedExecutor = executors.find(
e => e.id === order.assigned_executor_id
);

const { error } = await supabase
.from('orders')
.update({
assigned_executor_id: order.assigned_executor_id || null,
assigned_executor_name: selectedExecutor?.full_name || null,
scheduled_date: order.scheduled_date || null,
scheduled_time: order.scheduled_time || null,
schedule_status:
order.scheduled_date && order.scheduled_time
? 'scheduled'
: 'not_scheduled',
})
.eq('id', order.id);

if (error) {
console.log(error);
alert('Failed to save schedule');
return;
}

await fetchOrders();
setScheduleOrder(null);
} catch (err) {
console.log(err);
} finally {
setSavingId(null);
}
};

// =====================================
// CALCULATE COUNTS FOR STAT CARDS
// =====================================
const counts = useMemo(() => {
const stats = {
scheduled: 0,
unscheduled: 0,
accepted: 0,
ongoing: 0,
completed: 0,
};

orders.forEach(o => {
// Schedule status
if (o.schedule_status === 'scheduled') stats.scheduled++;
if (
o.schedule_status === 'not_scheduled' ||
o.schedule_status === 'unscheduled'
) {
stats.unscheduled++;
}

// Order status
const s = o.status?.toLowerCase();
if (s === 'accepted') stats.accepted++;
if (s === 'ongoing') stats.ongoing++;
if (s === 'completed') stats.completed++;
});

return stats;
}, [orders]);

// =====================================
// FILTER ORDERS (Dropdown & Search)
// =====================================
const filteredOrders = useMemo(() => {
return orders.filter(order => {
const keyword = search.toLowerCase();

// 1. Text Search Matching
const matchesSearch =
!keyword ||
order.customer_name?.toLowerCase().includes(keyword) ||
order.order_id?.toLowerCase().includes(keyword) ||
order.assigned_executor_name?.toLowerCase().includes(keyword) ||
order.city?.toLowerCase().includes(keyword) ||
order.state?.toLowerCase().includes(keyword) ||
order.pincode?.toString().toLowerCase().includes(keyword) ||
order.type_of_service?.toLowerCase().includes(keyword) ||
order.job_id?.toString().toLowerCase().includes(keyword);

// 2. Status Filter Matching (from dropdown only)
let matchesStatus = true;
if (statusFilter !== 'all') {
const checkStatus = (statusStr: string | undefined | null) => {
if (!statusStr) return false;
const s = statusStr.toLowerCase();
const f = statusFilter.toLowerCase();

if (f === 'unscheduled' && s === 'not_scheduled') return true;
if (f === 'not_scheduled' && s === 'unscheduled') return true;

return s === f;
};

matchesStatus =
checkStatus(order.schedule_status) || checkStatus(order.status);
}

return matchesSearch && matchesStatus;
});
}, [orders, search, statusFilter]);

// View-Only Stats configurations
const statCards = [
{ id: 'scheduled', label: 'Scheduled', count: counts.scheduled, icon: Calendar, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
{ id: 'unscheduled', label: 'Unscheduled', count: counts.unscheduled, icon: Clock3, iconColor: 'text-amber-500', bgColor: 'bg-amber-50' },
{ id: 'accepted', label: 'Accepted', count: counts.accepted, icon: CheckCircle2, iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
{ id: 'ongoing', label: 'Ongoing', count: counts.ongoing, icon: Clock3, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
{ id: 'completed', label: 'Completed', count: counts.completed, icon: CheckCircle2, iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
];

// Open the schedule popup with a draft copy of the order (so edits don't
// touch table state until Save is pressed)
const openScheduleModal = (order: any) => {
setScheduleErrors({});
setScheduleOrder({ ...order });
};

const updateDraft = (field: string, value: any) => {
setScheduleOrder((prev: any) => (prev ? { ...prev, [field]: value } : prev));
// Clear the error for this field the moment the person fixes it
setScheduleErrors((prev) => {
if (!prev[field]) return prev;
const next = { ...prev };
delete next[field];
return next;
});
};

return (
<div className="min-h-screen bg-gray-50/50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

{/* ================================= HEADER ================================= */}
<div className="mb-8">
<h1 className="text-2xl font-bold text-gray-900">Orders Schedule</h1>
<p className="text-sm text-gray-500 mt-1">
Real-time metrics and executor allotment
</p>
</div>

{/* ================================= SEARCH & DROPDOWN FILTER ================================= */}
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">

{/* Search Bar */}
<div className="relative w-full max-w-md">
<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
<input
type="text"
placeholder="Search orders or Job ID..."
value={search}
onChange={e => setSearch(e.target.value)}
className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#8ED26B]/20 focus:border-[#8ED26B] text-gray-900 placeholder-gray-400"
/>
</div>

{/* Filter Dropdown */}
<div className="relative w-full sm:w-auto sm:ml-auto">
<button
onClick={() => setIsFilterOpen(!isFilterOpen)}
className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#8ED26B]/20 focus:border-[#8ED26B]"
>
<div className="flex items-center gap-2">
<Filter size={16} className="text-gray-500" />
<span className="capitalize text-gray-700">
{statusFilter === 'all' ? 'All filters' : statusFilter}
</span>
</div>
</button>

{isFilterOpen && (
<div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 shadow-lg rounded-xl z-20 py-2">
{filterOptions.map(option => (
<button
key={option}
onClick={() => {
setStatusFilter(option.toLowerCase());
setIsFilterOpen(false);
}}
className={`w-full text-left px-4 py-2 text-sm transition-colors ${
statusFilter === option.toLowerCase()
? 'bg-[#8ED26B]/10 text-[#4B7C35] font-semibold'
: 'text-gray-700 hover:bg-gray-50'
}`}
>
{option}
</button>
))}
</div>
)}
</div>
</div>

{/* ================================= DASHBOARD STATS (VIEW ONLY) ================================= */}
<div className="flex overflow-x-auto gap-4 pb-4 mb-6 hide-scrollbar snap-x">
{statCards.map((stat) => (
<div
key={stat.id}
className="min-w-[200px] flex-shrink-0 flex items-center gap-4 p-5 rounded-2xl border bg-white border-gray-200 shadow-sm snap-start"
>
<div className={`p-3 rounded-xl ${stat.bgColor}`}>
<stat.icon className={stat.iconColor} size={24} />
</div>
<div>
<h3 className="text-2xl font-bold text-gray-900">{stat.count}</h3>
<p className="text-sm font-medium text-gray-500 mt-0.5">{stat.label}</p>
</div>
</div>
))}
</div>

{/* ================================= ORDERS TABLE ================================= */}
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
{loading ? (
<div className="p-10 text-center">
<p className="text-gray-500">Loading schedules...</p>
</div>
) : filteredOrders.length === 0 ? (
<div className="p-10 text-center">
<AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
<p className="text-gray-500">No orders found</p>
</div>
) : (
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead>
<tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
<th className="px-5 py-3">Order</th>
<th className="px-5 py-3">Customer</th>
<th className="px-5 py-3">Service</th>
<th className="px-5 py-3">Location</th>
<th className="px-5 py-3">Status</th>
<th className="px-5 py-3">Schedule</th>
<th className="px-5 py-3">Executor</th>
<th className="px-5 py-3 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-100">
{filteredOrders.map(order => {
const isScheduled = order.schedule_status === 'scheduled';
return (
<tr
key={order.id}
onClick={() => setViewOrder(order)}
className="cursor-pointer hover:bg-gray-50/80 transition-colors"
>
<td className="px-5 py-4">
<p className="font-semibold text-gray-900">{order.order_id}</p>
{order.job_id && (
<p className="text-xs text-blue-600 font-medium mt-0.5">
Job ID: {order.job_id}
</p>
)}
</td>
<td className="px-5 py-4">
<p className="font-medium text-gray-900">{order.customer_name}</p>
<p className="text-xs text-gray-500 mt-0.5">{order.product_name}</p>
</td>
<td className="px-5 py-4 text-gray-700">{order.type_of_service || '—'}</td>
<td className="px-5 py-4 text-gray-700">
{order.city ? `${order.city}, ${order.state} - ${order.pincode}` : '—'}
</td>
<td className="px-5 py-4">
<span
className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
isScheduled
? 'bg-emerald-50 text-emerald-700'
: 'bg-amber-50 text-amber-700'
}`}
>
{isScheduled ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
{isScheduled ? 'Scheduled' : 'Not Scheduled'}
</span>
</td>
<td className="px-5 py-4 text-gray-700">
{order.scheduled_date ? (
<div>
<p className="font-medium text-gray-900">{order.scheduled_date}</p>
<p className="text-xs text-gray-500">{order.scheduled_time || '—'}</p>
</div>
) : (
<span className="text-gray-400">—</span>
)}
</td>
<td className="px-5 py-4 text-gray-700">
{order.assigned_executor_name || (
<span className="text-gray-400">Unassigned</span>
)}
</td>
<td className="px-5 py-4">
<div
className="flex items-center justify-end gap-2"
onClick={e => e.stopPropagation()}
>
<button
onClick={() => setViewOrder(order)}
title="View details"
className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
>
<Eye size={15} />
</button>
<button
onClick={() => openScheduleModal(order)}
className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
isScheduled
? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
: 'bg-[#8ED26B] text-white hover:brightness-95'
}`}
>
{isScheduled ? (
<>
<Pencil size={13} />
Reschedule
</>
) : (
<>
<Calendar size={13} />
Schedule
</>
)}
</button>
</div>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
</div>

{/* ================================= VIEW DETAILS MODAL ================================= */}
{viewOrder && (
<div
className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
onClick={() => setViewOrder(null)}
>
<div
className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
onClick={e => e.stopPropagation()}
>
<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
<div>
<p className="text-xs font-bold text-[#8ED26B]">{viewOrder.order_id}</p>
<h3 className="text-lg font-bold text-gray-900">{viewOrder.customer_name}</h3>
</div>
<button
onClick={() => setViewOrder(null)}
className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
>
<X size={18} />
</button>
</div>

<div className="p-6 space-y-5">
<div>
<p className="text-xs font-semibold text-gray-400 uppercase mb-2">Customer Details</p>
<div className="space-y-2 text-sm">
<div className="flex items-center gap-2">
<User size={15} className="text-gray-400" />
<span>{viewOrder.customer_name}</span>
</div>
<div className="flex items-center gap-2">
<Package size={15} className="text-gray-400" />
<span>{viewOrder.product_name} {viewOrder.type_of_service ? `• ${viewOrder.type_of_service}` : ''}</span>
</div>
<div className="flex items-center gap-2">
<MapPin size={15} className="text-gray-400" />
<span>{viewOrder.city}, {viewOrder.state} - {viewOrder.pincode}</span>
</div>
{viewOrder.job_id && (
<div className="flex items-center gap-2">
<Briefcase size={15} className="text-gray-400" />
<span>Job ID: {viewOrder.job_id}</span>
</div>
)}
</div>
</div>

<div>
<p className="text-xs font-semibold text-gray-400 uppercase mb-2">Schedule</p>
{viewOrder.scheduled_date ? (
<div className="space-y-2 text-sm">
<div className="flex items-center gap-2">
<Calendar size={15} className="text-gray-400" />
<span>{viewOrder.scheduled_date}</span>
</div>
<div className="flex items-center gap-2">
<Clock3 size={15} className="text-gray-400" />
<span>{viewOrder.scheduled_time || '—'}</span>
</div>
</div>
) : (
<p className="text-sm text-gray-400">Not scheduled yet</p>
)}
</div>

<div>
<p className="text-xs font-semibold text-gray-400 uppercase mb-2">Assigned Executor</p>
{(() => {
const ex = executors.find(e => e.id === viewOrder.assigned_executor_id);
if (!ex) return <p className="text-sm text-gray-400">Unassigned</p>;
return (
<div className="bg-[#8ED26B]/10 border border-[#8ED26B]/20 rounded-xl p-4 space-y-2">
<p className="text-sm font-bold text-[#4B7C35]">{ex.full_name}</p>
{ex.phone && (
<div className="flex items-center gap-2 text-sm text-gray-700">
<Phone size={14} />
<span>{ex.phone}</span>
</div>
)}
{ex.company_name && (
<div className="flex items-center gap-2 text-sm text-gray-700">
<Building2 size={14} />
<span>{ex.company_name}</span>
</div>
)}
{ex.pincode && (
<div className="flex items-center gap-2 text-sm text-gray-700">
<MapPin size={14} />
<span>Pincode: {ex.pincode}</span>
</div>
)}
</div>
);
})()}
</div>
</div>

<div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
<button
onClick={() => setViewOrder(null)}
className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
>
Close
</button>
<button
onClick={() => {
const order = viewOrder;
setViewOrder(null);
openScheduleModal(order);
}}
className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#8ED26B] text-white hover:brightness-95"
>
{viewOrder.schedule_status === 'scheduled' ? 'Edit Schedule' : 'Schedule Now'}
</button>
</div>
</div>
</div>
)}

{/* ================================= SCHEDULE POPUP ================================= */}
{scheduleOrder && (
<div
className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
onClick={() => !savingId && setScheduleOrder(null)}
>
<div
className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
onClick={e => e.stopPropagation()}
>
<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
<div>
<p className="text-xs font-bold text-[#8ED26B]">{scheduleOrder.order_id}</p>
<h3 className="text-lg font-bold text-gray-900">
{scheduleOrder.schedule_status === 'scheduled' ? 'Reschedule' : 'Schedule'} — {scheduleOrder.customer_name}
</h3>
</div>
<button
onClick={() => !savingId && setScheduleOrder(null)}
className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
>
<X size={18} />
</button>
</div>

<div className="p-6 space-y-5">
{/* All fields below are required before the schedule can be saved */}
<div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
<AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
<p className="text-xs text-amber-700 font-medium leading-relaxed">
Executor, date, and time are all required to save a schedule.
</p>
</div>

{/* Suggested Executors */}
{getSuggestedExecutors(scheduleOrder).length > 0 && (
<div>
<p className="text-xs font-semibold text-gray-400 uppercase mb-2">Suggested Executors</p>
<div className="flex flex-wrap gap-2">
{getSuggestedExecutors(scheduleOrder).map(executor => (
<button
key={executor.id}
onClick={() => updateDraft('assigned_executor_id', executor.id)}
className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
scheduleOrder.assigned_executor_id === executor.id
? 'bg-[#8ED26B] text-white border-[#8ED26B]'
: 'border-[#8ED26B]/30 bg-[#8ED26B]/10 hover:bg-[#8ED26B]/20 text-[#4B7C35]'
}`}
>
{executor.full_name}
{executor.pincode ? ` • ${executor.pincode}` : ''}
</button>
))}
</div>
</div>
)}

{/* Executor select */}
<div>
<label className="block text-xs font-semibold text-gray-500 mb-2">
Allot Executor <span className="text-red-500">*</span>
</label>
<div className="relative">
<Wrench size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
<select
value={scheduleOrder.assigned_executor_id || ''}
onChange={e => updateDraft('assigned_executor_id', e.target.value)}
className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm outline-none bg-white text-gray-900 focus:ring-2 ${
scheduleErrors.assigned_executor_id
? 'border-red-300 focus:ring-red-100 focus:border-red-400'
: 'border-gray-200 focus:ring-[#8ED26B]/20 focus:border-[#8ED26B]'
}`}
>
<option value="">Select Executor</option>
{executors.map(executor => (
<option key={executor.id} value={executor.id}>
{executor.full_name}
{executor.company_name ? ` - ${executor.company_name}` : ''}
{executor.pincode ? ` (${executor.pincode})` : ''}
</option>
))}
</select>
</div>
{scheduleErrors.assigned_executor_id && (
<p className="mt-1.5 text-xs font-semibold text-red-500">{scheduleErrors.assigned_executor_id}</p>
)}

{scheduleOrder.assigned_executor_id && (() => {
const selectedExecutor = executors.find(e => e.id === scheduleOrder.assigned_executor_id);
if (!selectedExecutor) return null;
return (
<div className="mt-3 bg-[#8ED26B]/10 border border-[#8ED26B]/20 rounded-xl p-4 space-y-2">
<p className="text-sm font-bold text-[#4B7C35]">{selectedExecutor.full_name}</p>
{selectedExecutor.phone && (
<div className="flex items-center gap-2 text-sm text-gray-700">
<Users size={14} />
<span>{selectedExecutor.phone}</span>
</div>
)}
{selectedExecutor.company_name && (
<div className="flex items-center gap-2 text-sm text-gray-700">
<Building2 size={14} />
<span>{selectedExecutor.company_name}</span>
</div>
)}
</div>
);
})()}
</div>

{/* Date & Time */}
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-gray-500 mb-2">
Schedule Date <span className="text-red-500">*</span>
</label>
<div className="relative">
<Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
<input
type="date"
value={scheduleOrder.scheduled_date || ''}
onChange={e => updateDraft('scheduled_date', e.target.value)}
className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm outline-none bg-white text-gray-900 focus:ring-2 ${
scheduleErrors.scheduled_date
? 'border-red-300 focus:ring-red-100 focus:border-red-400'
: 'border-gray-200 focus:ring-[#8ED26B]/20 focus:border-[#8ED26B]'
}`}
/>
</div>
{scheduleErrors.scheduled_date && (
<p className="mt-1.5 text-xs font-semibold text-red-500">{scheduleErrors.scheduled_date}</p>
)}
</div>

<div>
<label className="block text-xs font-semibold text-gray-500 mb-2">
Schedule Time <span className="text-red-500">*</span>
</label>
<div className="relative">
<Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
<input
type="time"
value={scheduleOrder.scheduled_time || ''}
onChange={e => updateDraft('scheduled_time', e.target.value)}
className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm outline-none bg-white text-gray-900 focus:ring-2 ${
scheduleErrors.scheduled_time
? 'border-red-300 focus:ring-red-100 focus:border-red-400'
: 'border-gray-200 focus:ring-[#8ED26B]/20 focus:border-[#8ED26B]'
}`}
/>
</div>
{scheduleErrors.scheduled_time && (
<p className="mt-1.5 text-xs font-semibold text-red-500">{scheduleErrors.scheduled_time}</p>
)}
</div>
</div>
</div>

<div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
<button
onClick={() => setScheduleOrder(null)}
disabled={!!savingId}
className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
>
Cancel
</button>
<button
onClick={() => saveSchedule(scheduleOrder)}
disabled={savingId === scheduleOrder.id}
className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#8ED26B] text-white hover:brightness-95 disabled:opacity-60"
>
{savingId === scheduleOrder.id ? 'Saving...' : 'Save Schedule'}
</button>
</div>
</div>
</div>
)}
</div>
);
}