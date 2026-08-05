'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/app/utils/supabase/client';
import {
  FileSpreadsheet, FileDown, Check, Activity, Users, Building, Briefcase, Layers,
  Box, BarChart2, Table as TableIcon, Eye, X, Link as LinkIcon, Globe
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

type TimeRange = 'monthly' | 'past_month' | 'yearly' | 'custom';

const COLORS = {
  total: '#4b5563',       
  completed: '#8ec04c',   
  pending: '#f3b022',     
  in_progress: '#47b7e8', 
  cancelled: '#ef4444',   
  empty: '#e5e7eb',
  modular: '#D4A017', // Turmeric for modular
  normal: '#8ED26B'   // Green for normal
};

export default function ReportsPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [modularOrders, setModularOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [executors, setExecutors] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState('');

  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── MODAL STATE FOR VIEWING ORDER DETAILS ──
  const [viewModal, setViewModal] = useState<{ open: boolean; clientName: string; type: 'normal' | 'modular'; data: any[] }>({
    open: false, clientName: '', type: 'normal', data: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const [ordersRes, modularRes, usersRes, clientsRes, executorsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('modular_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, full_name, status, created_at'),
      supabase.from('clients').select('id, full_name, company_name, status, created_at'),
      supabase.from('executors').select('id, full_name, status, created_at')
    ]);

    if (ordersRes.data) setOrders(ordersRes.data);
    if (modularRes.data) setModularOrders(modularRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (executorsRes.data) setExecutors(executorsRes.data); else setExecutors([]);
    
    setLoading(false);
  };

  const getFilteredData = (dataArray: any[], dateField = 'created_at') => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (timeRange === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'past_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (timeRange === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start = dateFrom ? new Date(dateFrom) : new Date(2000, 0, 1);
      end = dateTo ? new Date(new Date(dateTo).setHours(23, 59, 59)) : now;
    }

    return dataArray.filter(item => {
      const itemDate = new Date(item.purchase_date || item[dateField]);
      return itemDate >= start && itemDate <= end;
    });
  };

  const filteredOrders = getFilteredData(orders);
  const filteredModular = getFilteredData(modularOrders);
  
  // ── 1. NORMAL ORDERS DONUT DATA ──
  const total = filteredOrders.length;
  const completed = filteredOrders.filter(o => o.status === 'completed').length;
  const inProgress = filteredOrders.filter(o => o.status === 'in_progress').length;
  const pending = filteredOrders.filter(o => o.status === 'pending').length;

  const orderCards = [
    {
      title: 'Total Normal Orders', value: total, desc: 'All recorded volume', centerColor: COLORS.total,
      data: total > 0 ? [
        { name: 'Completed', value: completed, color: COLORS.completed },
        { name: 'In Progress', value: inProgress, color: COLORS.in_progress },
        { name: 'Pending', value: pending, color: COLORS.pending }
      ] : [{ name: 'Empty', value: 1, color: COLORS.empty }]
    },
    { title: 'Completed', value: completed, desc: 'Successfully delivered', centerColor: COLORS.completed, data: [{ name: 'Completed', value: completed, color: COLORS.completed }, { name: 'Remaining', value: total - completed > 0 ? total - completed : 0.01, color: COLORS.empty }], share: total > 0 ? Math.round((completed / total) * 100) : 0 },
    { title: 'In Progress', value: inProgress, desc: 'Currently active', centerColor: COLORS.in_progress, data: [{ name: 'In Progress', value: inProgress, color: COLORS.in_progress }, { name: 'Remaining', value: total - inProgress > 0 ? total - inProgress : 0.01, color: COLORS.empty }], share: total > 0 ? Math.round((inProgress / total) * 100) : 0 },
    { title: 'Pending', value: pending, desc: 'Awaiting action', centerColor: COLORS.pending, data: [{ name: 'Pending', value: pending, color: COLORS.pending }, { name: 'Remaining', value: total - pending > 0 ? total - pending : 0.01, color: COLORS.empty }], share: total > 0 ? Math.round((pending / total) * 100) : 0 }
  ];

  // ── 2. MODULAR ORDERS DONUT DATA ──
  const modTotal = filteredModular.length;
  const modCompleted = filteredModular.filter(o => o.status === 'completed').length;
  const modInProgress = filteredModular.filter(o => o.status === 'in_progress').length;
  const modPending = filteredModular.filter(o => ['submitted', 'assigned', 'awaiting_countertop', 'sign_off'].includes(o.status)).length;

  const modularCards = [
    {
      title: 'Total Modular Orders', value: modTotal, desc: 'All modular projects', centerColor: COLORS.modular,
      data: modTotal > 0 ? [
        { name: 'Completed', value: modCompleted, color: COLORS.completed },
        { name: 'In Progress', value: modInProgress, color: COLORS.in_progress },
        { name: 'Pending', value: modPending, color: COLORS.pending }
      ] : [{ name: 'Empty', value: 1, color: COLORS.empty }]
    },
    { title: 'Completed', value: modCompleted, desc: 'Successfully installed', centerColor: COLORS.completed, data: [{ name: 'Completed', value: modCompleted, color: COLORS.completed }, { name: 'Remaining', value: modTotal - modCompleted > 0 ? modTotal - modCompleted : 0.01, color: COLORS.empty }], share: modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0 },
    { title: 'In Progress', value: modInProgress, desc: 'Currently active', centerColor: COLORS.in_progress, data: [{ name: 'In Progress', value: modInProgress, color: COLORS.in_progress }, { name: 'Remaining', value: modTotal - modInProgress > 0 ? modTotal - modInProgress : 0.01, color: COLORS.empty }], share: modTotal > 0 ? Math.round((modInProgress / modTotal) * 100) : 0 },
    { title: 'Pending', value: modPending, desc: 'Awaiting assignment', centerColor: COLORS.pending, data: [{ name: 'Pending', value: modPending, color: COLORS.pending }, { name: 'Remaining', value: modTotal - modPending > 0 ? modTotal - modPending : 0.01, color: COLORS.empty }], share: modTotal > 0 ? Math.round((modPending / modTotal) * 100) : 0 }
  ];

  // ── 3. COMBINED OVERALL DATA (New Requirement) ──
  const combinedTotal = total + modTotal;
  const combinedCompleted = completed + modCompleted;
  const combinedActive = inProgress + pending + modInProgress + modPending;

  // Calculate total unique customers using phones, names, or clients
  const allOrderRecords = [...filteredOrders, ...filteredModular];
  const uniqueCustomersSet = new Set();
  allOrderRecords.forEach(o => {
    if (o.phone) uniqueCustomersSet.add(o.phone);
    else if (o.customer_name) uniqueCustomersSet.add(o.customer_name.toLowerCase());
    else if (o.client) uniqueCustomersSet.add(o.client.toLowerCase());
  });
  const totalUniqueCustomers = uniqueCustomersSet.size;

  const combinedCards = [
    {
      title: 'Overall Combined Orders', value: combinedTotal, desc: 'orders + Modular orders', centerColor: '#3b82f6',
      data: combinedTotal > 0 ? [
        { name: 'Completed', value: combinedCompleted, color: COLORS.completed },
        { name: 'Active', value: combinedActive, color: COLORS.in_progress }
      ] : [{ name: 'Empty', value: 1, color: COLORS.empty }]
    },
    { title: 'Overall Completed', value: combinedCompleted, desc: 'Successfully delivered overall', centerColor: COLORS.completed, data: [{ name: 'Completed', value: combinedCompleted, color: COLORS.completed }, { name: 'Remaining', value: combinedTotal - combinedCompleted > 0 ? combinedTotal - combinedCompleted : 0.01, color: COLORS.empty }], share: combinedTotal > 0 ? Math.round((combinedCompleted / combinedTotal) * 100) : 0 },
    { title: 'Total Unique Customers', value: totalUniqueCustomers, desc: 'Across all order types', centerColor: '#f59e0b', data: [{ name: 'Customers', value: 1, color: '#f59e0b' }] },
    { title: 'Overall Active & Pending', value: combinedActive, desc: 'Work currently ongoing or waiting', centerColor: COLORS.in_progress, data: [{ name: 'Active', value: combinedActive, color: COLORS.in_progress }, { name: 'Remaining', value: combinedTotal - combinedActive > 0 ? combinedTotal - combinedActive : 0.01, color: COLORS.empty }], share: combinedTotal > 0 ? Math.round((combinedActive / combinedTotal) * 100) : 0 }
  ];


  // ── 4. COMPARISON TREND GRAPH DATA (Normal vs Modular) ──
  const getComparisonTrendData = () => {
    const grouped: Record<string, { date: string, Normal: number, Modular: number }> = {};
    const processData = (arr: any[], keyName: 'Normal' | 'Modular') => {
      arr.forEach(o => {
        const d = new Date(o.purchase_date || o.created_at);
        const dateKey = timeRange === 'yearly' 
          ? d.toLocaleString('default', { month: 'short' })
          : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        
        if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, Normal: 0, Modular: 0 };
        grouped[dateKey][keyName] += 1;
      });
    };
    processData(filteredOrders, 'Normal');
    processData(filteredModular, 'Modular');
    return Object.values(grouped).reverse();
  };
  const comparisonTrendData = getComparisonTrendData();

  // ── 5. CLIENT DETAILS REPORT DATA (Stacked Bar) ──
  type ClientReportRow = { name: string; Normal: number; Modular: number; Total: number };
  const getClientReportData = () => {
    const clientMap: Record<string, ClientReportRow> = {};
    clients.forEach(c => { clientMap[c.id] = { name: c.company_name || c.full_name || 'Unknown', Normal: 0, Modular: 0, Total: 0 }; });
    filteredOrders.forEach(o => {
      if (o.assigned_client_id && clientMap[o.assigned_client_id]) {
        clientMap[o.assigned_client_id].Normal += 1;
        clientMap[o.assigned_client_id].Total += 1;
      }
    });
    filteredModular.forEach(m => {
      let found = false;
      if (m.client_id && clientMap[m.client_id]) {
        clientMap[m.client_id].Modular += 1;
        clientMap[m.client_id].Total += 1;
        found = true;
      }
      if (!found) {
        const matched = Object.values(clientMap).find(c => c.name === m.client);
        if (matched) { matched.Modular += 1; matched.Total += 1; }
      }
    });
    return Object.values(clientMap).filter((c: ClientReportRow) => c.Total > 0).sort((a: ClientReportRow, b: ClientReportRow) => b.Total - a.Total).slice(0, 8); 
  };
  const clientData = getClientReportData();

  // ── 6. TOP SERVICES DATA ──
  const getServiceTypeData = () => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      if (o.type_of_service) {
        const services = o.type_of_service.split(',').map((s: string) => s.trim());
        services.forEach((s: string) => { if (s) counts[s] = (counts[s] || 0) + 1; });
      }
    });
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] })).sort((a: { count: number }, b: { count: number }) => b.count - a.count).slice(0, 5); 
  };
  const serviceData = getServiceTypeData();

  // ── 7. USER TRACKING DATA ──
  const userGroups = [
    { title: 'In-House Users', total: users.length, active: users.filter(u => u.status === 'active').length, inactive: users.filter(u => u.status !== 'active').length, colorActive: '#3b82f6', colorInactive: '#e5e7eb', icon: Users },
    { title: 'Clients', total: clients.length, active: clients.filter(c => c.status === 'active').length, inactive: clients.filter(c => c.status !== 'active').length, colorActive: '#a855f7', colorInactive: '#e5e7eb', icon: Building },
    { title: 'Executors', total: executors.length, active: executors.filter(e => e.status === 'active').length, inactive: executors.filter(e => e.status !== 'active').length, colorActive: '#f59e0b', colorInactive: '#e5e7eb', icon: Briefcase }
  ];

  // ── 8. AGGREGATED CLIENT TABLE DATA (For bottom tables) ──
  type ClientSummaryRow = { name: string; total: number; completed: number; ordersList: any[]; };

  const normalRecord = filteredOrders.reduce((acc: Record<string, ClientSummaryRow>, o: any) => {
    const clientName = String(clients.find(c => c.id === o.assigned_client_id)?.company_name || o.client || 'Direct / Unassigned');
    if (!acc[clientName]) acc[clientName] = { name: clientName, total: 0, completed: 0, ordersList: [] };
    acc[clientName].total += 1;
    if (o.status === 'completed') acc[clientName].completed += 1;
    acc[clientName].ordersList.push(o);
    return acc;
  }, {});
  const normalClientSummary: ClientSummaryRow[] = Object.values(normalRecord).sort((a, b) => b.total - a.total).slice(0, 8);

  const modularRecord = filteredModular.reduce((acc: Record<string, ClientSummaryRow>, m: any) => {
    const clientName = String(m.client || 'Direct / Unassigned');
    if (!acc[clientName]) acc[clientName] = { name: clientName, total: 0, completed: 0, ordersList: [] };
    acc[clientName].total += 1;
    if (m.status === 'completed') acc[clientName].completed += 1;
    acc[clientName].ordersList.push(m);
    return acc;
  }, {});
  const modularClientSummary: ClientSummaryRow[] = Object.values(modularRecord).sort((a, b) => b.total - a.total).slice(0, 8);


  // ── EXPORT LOGIC ──
  const showToast = (msg: string) => { setDownloadToast(msg); setTimeout(() => setDownloadToast(''), 3000); };
  
  const handleExport = (type: 'normal' | 'modular') => {
    setDownloading(true);
    try {
      let data = [];
      let fileName = '';

      if (type === 'normal') {
        data = filteredOrders.map(o => {
          const matchedClient = clients.find(c => c.id === o.assigned_client_id);
          return {
            'System ID': o.id || '', 'Job ID': o.job_id || '', 'Purchase Date': o.purchase_date ? new Date(o.purchase_date).toLocaleDateString() : '',
            'Customer Name': o.customer_name || '', 'Phone': o.phone || '', 'City': o.city || '', 'Type of Service': o.type_of_service || '',
            'Order Status': o.status?.toUpperCase() || '', 'Client Company': matchedClient?.company_name || o.client || 'N/A',
            'Assigned Executor': o.assigned_executor_name || 'Unassigned', 'Created At': o.created_at ? new Date(o.created_at).toLocaleString() : ''
          };
        });
        fileName = `Normal_Orders_Report_${timeRange.toUpperCase()}.xlsx`;
      } else {
        data = filteredModular.map(m => ({
            'System ID': m.id || '', 'Job ID': m.job_id || '', 'Customer Name': m.customer_name || '', 'Phone': m.phone || '',
            'City': m.city || '', 'Modular Status': m.status?.toUpperCase() || '', 'Client Name/Company': m.client || 'N/A',
            'Assigned Executor ID': m.assigned_executor_id || 'Unassigned', 'Created At': m.created_at ? new Date(m.created_at).toLocaleString() : '',
            'Scheduled Date': m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '', 'Duration Time': m.time_taken || ''
        }));
        fileName = `Modular_Orders_Report_${timeRange.toUpperCase()}.xlsx`;
      }

      if (data.length === 0) { showToast('No data to export.'); setDownloading(false); return; }
      const ws = XLSX.utils.json_to_sheet(data);
      const cols = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
      ws['!cols'] = cols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, fileName);
      showToast(`Excel downloaded — ${data.length} records.`);
    } catch { showToast('Failed to download Excel.'); }
    setDownloading(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading Analytics...</div>;
  }

  // ── REUSABLE DONUT CARDS RENDERER ──
  const renderDonutCards = (cardsArray: any[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
      {cardsArray.map((card) => (
        <div key={card.title} className="flex flex-col items-center relative group w-full">
          <div className="relative w-36 h-36 drop-shadow-sm transition-transform group-hover:scale-105 duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={card.data} cx="50%" cy="50%" innerRadius={46} outerRadius={68} dataKey="value" stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
                  {card.data.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold tracking-tighter" style={{ color: card.centerColor }}>{card.value}</span>
            </div>
          </div>
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white p-3 w-[110%] max-w-[180px] text-center -mt-6 relative z-10 ring-1 ring-gray-900/5 transition-shadow group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]">
            <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: card.centerColor }}>{card.title}</h3>
            <div className="w-6 h-[3px] mx-auto mt-1.5 mb-2 rounded-full" style={{ backgroundColor: card.centerColor, opacity: 0.3 }}></div>
            <p className="text-[10px] font-medium text-gray-500 leading-relaxed px-1 mb-1">{card.desc}</p>
            {card.share !== undefined && (
              <div className="mt-1.5 inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${card.centerColor}15`, color: card.centerColor }}>
                {card.share}% Share
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
  <div className="min-h-screen bg-gray-50 pb-12 relative">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── TOP HEADER & CONTROLS ── */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-500 mt-1 mb-4">Professional performance insights and data exports</p>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExport('normal')}
                disabled={downloading || filteredOrders.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm text-white disabled:opacity-50"
                style={{ backgroundColor: COLORS.normal }}
              >
                <FileSpreadsheet size={15} /> {downloading ? 'Exporting…' : 'Export Normal Orders'}
              </button>
              <button
                onClick={() => handleExport('modular')}
                disabled={downloading || filteredModular.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm text-white disabled:opacity-50"
                style={{ backgroundColor: COLORS.modular }}
              >
                <FileSpreadsheet size={15} /> Export Modular Orders
              </button>
            </div>
            
            {downloadToast && (
              <div className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 w-max">
                <Check size={14} /> {downloadToast}
              </div>
            )}
          </div>

          <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-2 items-center">
            <div className="flex bg-gray-50 rounded-xl p-1 border border-gray-100 w-full sm:w-auto">
              {[
                { id: 'monthly', label: 'This Month' },
                { id: 'past_month', label: 'Past Month' },
                { id: 'yearly', label: 'Yearly' },
                { id: 'custom', label: 'Custom' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTimeRange(t.id as TimeRange)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition ${timeRange === t.id ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-2 px-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#8ED26B]" />
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#8ED26B]" />
              </div>
            )}
          </div>
        </div>

        {/* ── NORMAL ORDERS DISTRIBUTION ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full opacity-50 pointer-events-none"></div>
          <div className="mb-6 text-center sm:text-left relative z-10">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
              <Box size={22} className="text-[#8ED26B]" /> Normal Order Distribution
            </h2>
            <p className="text-sm text-gray-500 mt-1">Breakdown of standard sales and fulfillment</p>
          </div>
          {renderDonutCards(orderCards)}
        </div>

        {/* ── MODULAR ORDERS DISTRIBUTION ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-bl-full opacity-50 pointer-events-none"></div>
          <div className="mb-6 text-center sm:text-left relative z-10">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
              <Layers size={22} className="text-[#D4A017]" /> Modular Order Distribution
            </h2>
            <p className="text-sm text-gray-500 mt-1">Breakdown of complex modular projects and installations</p>
          </div>
          {renderDonutCards(modularCards)}
        </div>

        {/* ── OVERALL COMBINED DISTRIBUTION (NEW) ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] mb-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none"></div>
          <div className="mb-6 text-center sm:text-left relative z-10">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
              <Globe size={22} className="text-[#3b82f6]" /> Overall Combined Performance
            </h2>
            <p className="text-sm text-gray-500 mt-1">Aggregated statistics combining Normal and Modular workflow orders</p>
          </div>
          {renderDonutCards(combinedCards)}
        </div>

        {/* ── CHARTS: TREND COMPARISON & CLIENT REPORT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Comparison Graph */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] h-[400px] flex flex-col">
            <h2 className="text-base font-bold text-gray-900 mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity size={18} className="text-gray-500" /> Order Volume Comparison</span>
            </h2>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <RechartsTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Normal" name="Normal Orders" fill={COLORS.normal} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Modular" name="Modular Orders" fill={COLORS.modular} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Client Stacked Bar Report */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] h-[400px] flex flex-col">
            <h2 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart2 size={18} className="text-gray-500" /> Top Clients Overview
            </h2>
            <div className="flex-1 w-full min-h-0">
              {clientData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 500 }} width={110} />
                    <RechartsTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Normal" stackId="a" name="Normal Orders" fill={COLORS.normal} radius={[0, 0, 0, 0]} barSize={25} />
                    <Bar dataKey="Modular" stackId="a" name="Modular Orders" fill={COLORS.modular} radius={[0, 4, 4, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                  No client data available for this range.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── ADDITIONAL METRICS: TOP SERVICES & USER TRACKING ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] h-[340px] flex flex-col col-span-1">
            <h2 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Layers size={18} className="text-[#47b7e8]" /> Top Services
            </h2>
            <div className="flex-1 w-full min-h-0">
              {serviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 500 }} width={100} />
                    <RechartsTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} />
                    <Bar dataKey="count" name="Total" fill="#47b7e8" radius={[0, 4, 4, 0]} barSize={20}>
                      {serviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#47b7e8' : '#8ED26B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
                  No service data available.
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)]">
            <h2 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users size={18} className="text-gray-500" /> Platform User Activity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 h-full pb-8">
              {userGroups.map((group) => {
                const donutData = group.total > 0 ? [
                  { name: 'Online', value: group.active, color: group.colorActive },
                  { name: 'Offline', value: group.inactive, color: group.colorInactive },
                ] : [{ name: 'Empty', value: 1, color: COLORS.empty }];

                return (
                  <div key={group.title} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-4">
                      <group.icon size={16} style={{ color: group.colorActive }} />
                      <h3 className="font-bold text-gray-800 text-sm">{group.title}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
                          <p className="text-xl font-extrabold text-gray-900 leading-none">{group.total}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.colorActive }}></span>
                            <span className="text-xs font-bold text-gray-600 w-10">On: {group.active}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.colorInactive }}></span>
                            <span className="text-xs font-bold text-gray-500 w-10">Off: {group.inactive}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-24 h-24 flex-shrink-0">
                        {group.total > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={donutData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} dataKey="value" stroke="none" paddingAngle={2} isAnimationActive={false}>
                                {donutData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                              </Pie>
                              <RechartsTooltip contentStyle={{ fontSize: '11px', padding: '4px 8px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full rounded-full bg-gray-100 border-[4px] border-gray-200 flex items-center justify-center">
                            <span className="text-[10px] text-gray-400">N/A</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── TABULAR REPORTS (CLIENT AGGREGATIONS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Normal Orders Summary */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col h-[400px]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TableIcon size={18} className="text-[#8ED26B]" /> Normal Orders Summary
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-5 py-3">Client Name</th>
                    <th className="px-5 py-3 text-center">Total Orders</th>
                    <th className="px-5 py-3 text-center">Completed</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {normalClientSummary.map(client => (
                    <tr key={client.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-gray-900">{client.name}</td>
                      <td className="px-5 py-3 text-gray-600 text-center font-medium">{client.total}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider bg-green-50 text-green-700">
                          {client.completed}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button 
                          onClick={() => setViewModal({ open: true, clientName: client.name, type: 'normal', data: client.ordersList })}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-200 transition-colors"
                          title="View Order Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {normalClientSummary.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No client data found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modular Orders Summary */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col h-[400px]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TableIcon size={18} className="text-[#D4A017]" /> Modular Orders Summary
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-5 py-3">Client Name</th>
                    <th className="px-5 py-3 text-center">Total Orders</th>
                    <th className="px-5 py-3 text-center">Completed</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {modularClientSummary.map(client => (
                    <tr key={client.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-gray-900">{client.name}</td>
                      <td className="px-5 py-3 text-gray-600 text-center font-medium">{client.total}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider bg-yellow-50 text-yellow-700">
                          {client.completed}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button 
                          onClick={() => setViewModal({ open: true, clientName: client.name, type: 'modular', data: client.ordersList })}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-200 transition-colors"
                          title="View Order Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {modularClientSummary.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No client data found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* ── VIEW ORDER DETAILS MODAL ── */}
      {viewModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewModal({ open: false, clientName: '', type: 'normal', data: [] })}>
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Box size={20} className={viewModal.type === 'normal' ? 'text-[#8ED26B]' : 'text-[#D4A017]'} />
                  {viewModal.clientName}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mt-1">{viewModal.type} Orders Breakdown</p>
              </div>
              <button onClick={() => setViewModal({ open: false, clientName: '', type: 'normal', data: [] })} className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-3">
                {viewModal.data.map((order, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:border-gray-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{order.job_id || 'ID Pending'}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${order.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                            {order.status?.replace(/_/g, ' ') || 'Pending'}
                          </span>
                        </div>
                        
                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                          {viewModal.type === 'normal' 
                            ? (order.product_name || order.type_of_service || 'Product Details Unavailable')
                            : (order.project_details || order.type_of_service || 'Modular Project')}
                        </p>
                      </div>

                      {order.product_link && (
                        <a 
                          href={order.product_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors shrink-0"
                        >
                          <LinkIcon size={12} /> View Product
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}