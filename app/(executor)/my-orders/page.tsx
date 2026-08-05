'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  User,
  ShieldCheck,
  Package,
  X,
  Loader2,
  Clock,
  Navigation,
  Briefcase,
  ChevronRight,
  Filter,
  CalendarDays,
  Phone,
  AlertTriangle
} from 'lucide-react';

// Haversine formula — straight-line distance in km
const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Removed completed statuses to hide them entirely from the view
type StatusFilter = 'all' | 'pending' | 'failed';

// 1. EXTRACT LOGIC TO AN INNER CLIENT COMPONENT
function ExecutorOrdersContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Auth & Session State ──
  const [activeSession, setActiveSession] = useState<{ type: 'executor' | 'user'; id: string; name: string; email: string; role?: string } | null>(null);

  // ── Orders State ──
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // ── Filter Bar State ──
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  
  // Defaulting to TODAY's date to only show current day orders by default
  const [filterDate, setFilterDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // ── Error / Block State ──
  const [actionError, setActionError] = useState('');

  // ── User Geolocation ──
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ── Mobile card expand/collapse state ──
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Check if any order is currently strictly 'in_progress' ──
  const hasInProgress = orders.some(o => ['in_progress', 'ongoing'].includes((o.status || '').toLowerCase()));

  // ── Pick up ?filter= from the dashboard's metric cards on load ──
  useEffect(() => {
    const incoming = searchParams.get('filter') as StatusFilter | null;
    if (incoming && ['all', 'pending', 'failed'].includes(incoming)) {
      setStatusFilter(incoming);
      if (incoming !== 'all') setFilterPanelOpen(true);
    }
  }, [searchParams]);

  // ── Check Session on Mount ──
  const checkSession = () => {
    const eUser = localStorage.getItem('executorUser');
    const aUser = localStorage.getItem('adminUser');

    if (eUser) {
      const u = JSON.parse(eUser);
      setActiveSession({ type: 'executor', id: u.id, name: u.full_name || u.name || 'Executor', email: u.email, role: u.role });
    } else if (aUser) {
      const u = JSON.parse(aUser);
      setActiveSession({ type: 'user', id: u.id, name: u.full_name || u.name || 'Admin', email: u.email, role: u.role });
    } else {
      setActiveSession(null);
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    checkSession();
    const handleStorageChange = () => checkSession();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Fetch geolocation once on mount ──
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  // ── Fetch Orders ──
  useEffect(() => {
    if (activeSession) {
      fetchOrders();
    }
  }, [activeSession]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (activeSession?.type === 'executor') {
      query = query.eq('assigned_executor_id', activeSession.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assigned orders:', error);
    }

    let modularNormalized: any[] = [];
    let modularQuery = supabase
      .from('modular_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeSession?.type === 'executor') {
      modularQuery = modularQuery.eq('assigned_executor_id', activeSession.id);
    }

    const { data: modularData, error: modularError } = await modularQuery;

    if (modularError) {
      console.error('Error fetching assigned modular projects:', modularError);
    } else if (modularData) {
      modularNormalized = modularData.map((p: any) => ({
        id: p.id,
        job_id: p.job_id,
        order_id: p.job_id,
        product_name: 'Modular Interior Installation',
        customer_name: p.customer_name,
        phone: p.phone,
        status: p.status,
        scheduled_date: p.scheduled_date,
        address: p.address,
        city: p.city,
        state: p.state,
        pincode: p.pincode,
        remarks: p.project_details,
        type_of_service: 'Modular Interior Installation',
        assigned_executor_id: p.assigned_executor_id,
        created_at: p.created_at,
        updated_at: p.updated_at,
        latitude: null,
        longitude: null,
      }));
    }

    // Filter out 'completed' or 'done' statuses completely so they never show up
    const combined = [...(data || []), ...modularNormalized]
      .filter(o => {
        const s = (o.status || '').toLowerCase();
        return s !== 'completed' && s !== 'done';
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
    setOrders(combined);
    setLoadingOrders(false);
  };

  // ── Safe Open Job Logic (WITH CARPENTER ROUTING & MULTI-JOB ALLOWANCE) ──
  const handleOpenJob = (e: React.MouseEvent | null, order: any, orderKey: string) => {
    if (e) e.stopPropagation();
    const statusStr = (order.status || 'pending').toLowerCase();
    
    // 🚨 TRAFFIC COP ROUTING LOGIC 🚨
    // Check if the user is a Carpenter OR if the specific job is a modular installation
    const isCarpenter = 
      activeSession?.role === 'Carpenter' || 
      order.type_of_service?.toLowerCase().includes('modular') ||
      order.type_of_service?.toLowerCase().includes('carpenter');

    const isFinished = ['failed', 'cancelled', 'rejected'].includes(statusStr);
    
    // Block opening pending/assigned jobs if one is actively being worked on
    // IMPORTANT: This block ONLY runs for Delivery (!isCarpenter). Carpenters bypass this entirely.
    if (!isCarpenter && hasInProgress && statusStr !== 'in_progress' && !isFinished) {
      setActionError('Please complete your current active job before accepting another.');
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see banner
      setTimeout(() => setActionError(''), 4500);
      return;
    }

    // Decide the correct base folder URL based on role
    const basePath = isCarpenter ? '/carpenter-job' : '/my-orders';

    // Jobs already in progress go straight to the execution screen
    if (['in_progress', 'ongoing', 'snag_reopened', 'awaiting_countertop', 'countertop_completed'].includes(statusStr)) {
      router.push(`${basePath}/${orderKey}/execute`);
      return;
    }

    // Pending/Assigned jobs go to the details screen to accept
    router.push(`${basePath}/${orderKey}`);
  };

  // ── Filtered Data (status + optional date filter) ──
  const filteredOrders = orders.filter(order => {
    const status = (order.status || 'pending').toLowerCase();

    let statusMatch = true;
    if (statusFilter === 'pending') statusMatch = ['pending', 'scheduled', 'assigned', 'in_progress', 'ongoing', 'snag_reopened', 'awaiting_countertop', 'countertop_completed'].includes(status);
    if (statusFilter === 'failed') statusMatch = ['failed', 'cancelled', 'rejected'].includes(status);

    let dateMatch = true;
    if (filterDate) {
      const orderDateRaw = order.scheduled_date || order.created_at;
      const orderDate = orderDateRaw ? new Date(orderDateRaw).toISOString().slice(0, 10) : null;
      dateMatch = orderDate === filterDate;
    }

    return statusMatch && dateMatch;
  });

  const FILTER_LABELS: Record<StatusFilter, string> = {
    all: 'All',
    pending: 'Pending',
    failed: 'Failed',
  };

  const statusBadgeClasses = (statusStr: string) =>
    statusStr === 'in_progress' || statusStr === 'ongoing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
    statusStr === 'failed' || statusStr === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
    statusStr === 'snag_reopened' ? 'bg-red-50 text-red-700 border-red-200' :
    statusStr === 'awaiting_countertop' || statusStr === 'countertop_completed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
    'bg-amber-50 text-amber-700 border-amber-200';

  const statusDotClasses = (statusStr: string) =>
    statusStr === 'in_progress' || statusStr === 'ongoing' ? 'bg-blue-500' :
    statusStr === 'failed' || statusStr === 'cancelled' || statusStr === 'snag_reopened' ? 'bg-red-500' :
    statusStr === 'awaiting_countertop' || statusStr === 'countertop_completed' ? 'bg-purple-500' :
    'bg-amber-500';

  return (
    <main className="flex-1 max-w-[90rem] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">

      {/* ================================= FILTER BAR & ERRORS ================================= */}
      {actionError && (
        <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold px-4 py-3 rounded-xl shadow-sm anim-fade">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {activeSession && !loadingOrders && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mb-5 sm:mb-6">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                filterPanelOpen || statusFilter !== 'all' || filterDate
                  ? 'bg-gray-900 text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} /> Filters
              {(statusFilter !== 'all' || filterDate) && <span className="w-1.5 h-1.5 rounded-full bg-[#8ED26B]" />}
            </button>

            {statusFilter !== 'all' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                Showing: {FILTER_LABELS[statusFilter]}
              </span>
            )}

            {filterPanelOpen && (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="flex-1 sm:flex-none text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm outline-none min-w-0"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>

                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex-1 sm:flex-none min-w-0">
                  <CalendarDays size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="text-sm font-semibold text-gray-700 outline-none bg-transparent w-full min-w-0"
                  />
                  {filterDate && (
                    <button onClick={() => setFilterDate('')} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================= EMPTY / AUTH / LOADING STATES ================================= */}
      {!activeSession ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-16 text-center shadow-sm max-w-2xl mx-auto mt-6 sm:mt-10">
          <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4 sm:mb-5 sm:w-14 sm:h-14" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Secure Access Required</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8 font-medium">Please authenticate using the header menu to access the dispatch matrix.</p>
        </div>
      ) : loadingOrders ? (
        <div className="flex flex-col items-center justify-center h-56 sm:h-64 space-y-4 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Loader2 size={36} className="animate-spin text-[#8ED26B]" />
          <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest">Compiling Database...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 border-dashed p-8 sm:p-16 text-center shadow-sm mb-10">
          <Package size={48} className="mx-auto text-gray-200 mb-4 sm:w-14 sm:h-14" />
          <h2 className="text-base sm:text-lg font-bold text-gray-600 mb-2">Registry Empty</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto">No job records match the selected operational filters.</p>
        </div>
      ) : (
        <>
          {/* ================================= MOBILE: CARD LIST (< lg) ================================= */}
          <div className="flex flex-col gap-2.5 lg:hidden mb-10">
            {filteredOrders.map((order) => {
              const addressQuery = encodeURIComponent(`${order.address || ''} ${order.city || ''} ${order.pincode || ''}`.trim());
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
              const orderKey = order.id ?? order.job_id ?? order.order_id;
              const distanceKm = order.latitude && order.longitude && userLocation ? getDistanceKm(userLocation.lat, userLocation.lng, order.latitude, order.longitude) : null;
              const statusStr = (order.status || 'pending').toLowerCase();
              const isExpanded = expandedIds.has(orderKey);

              return (
                <div key={orderKey} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                  {/* ── Always-visible summary row ── */}
                  <button
                    onClick={() => toggleExpanded(orderKey)}
                    className="w-full text-left p-3.5 flex items-start gap-3"
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${statusDotClasses(statusStr)}`} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900 text-sm leading-snug truncate">
                          {order.product_name || 'Service Request'}
                        </h3>
                        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${statusBadgeClasses(statusStr)}`}>
                          {order.status?.replace('_', ' ') || 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 truncate mt-0.5">{order.customer_name || 'N/A'}</p>
                      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500">
                          <Clock size={11} className="text-[#8ED26B]" />
                          {order.scheduled_date || 'TBD'}
                        </span>
                        {distanceKm !== null && (
                          <span className="text-[10px] font-bold text-gray-400">{distanceKm.toFixed(1)} km away</span>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      size={16}
                      className={`shrink-0 mt-1 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {/* ── Expanded details ── */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 border-t border-gray-100 pt-3">

                      <div className="flex flex-col gap-0.5 mb-3">
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider font-mono">
                          JOB: <span className="text-gray-600">{order.job_id || 'N/A'}</span>
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider font-mono">
                          ORD: <span className="text-gray-600">{order.order_id || order.id?.substring(0, 8)}</span>
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5aaa3a] bg-[#edfae3] px-2 py-0.5 rounded border border-[#8ED26B]/30 w-max mb-3">
                        <Briefcase size={10} /> {order.type_of_service || 'Standard'}
                      </span>

                      {/* Customer */}
                      <div className="flex items-center justify-between gap-2 py-2.5 border-t border-gray-100">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-gray-800 block truncate">{order.customer_name || 'N/A'}</span>
                          <span className="text-[11px] font-semibold text-gray-500">{order.phone || '—'}</span>
                        </div>
                        {order.phone && (
                          <a
                            href={`tel:${order.phone}`}
                            title={`Call ${order.customer_name || 'customer'}`}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#edfae3] text-[#5aaa3a] border border-[#8ED26B]/30 hover:bg-[#8ED26B] hover:text-white transition-colors"
                          >
                            <Phone size={11} />
                          </a>
                        )}
                      </div>

                      {order.remarks && (
                        <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100 leading-tight mb-2.5">
                          <span className="uppercase tracking-wider font-bold block mb-0.5 text-amber-600">Instructions</span>
                          {order.remarks}
                        </div>
                      )}

                      {/* Location */}
                      <div className="py-2.5 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 leading-relaxed">{order.address || 'No address'}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5 mb-2">{[order.city, order.state, order.pincode].filter(Boolean).join(', ')}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {order.address && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100"
                            >
                              <Navigation size={12} /> Map View
                            </a>
                          )}
                          {distanceKm !== null && (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                              {distanceKm.toFixed(1)} km away
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Schedule */}
                      <div className="py-2.5 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                          <Clock size={13} className="text-[#8ED26B] shrink-0" />
                          {order.scheduled_date ? `${order.scheduled_date}` : 'TBD'}
                          <span className="text-[11px] font-semibold text-gray-500">· {order.scheduled_time || 'Time TBD'}</span>
                        </div>
                      </div>
                      <div className="pb-1 border-t border-gray-100 pt-2.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Assigned To</span>
                        <span className="text-xs font-bold text-gray-700">{order.assigned_executor_name || activeSession.name}</span>
                      </div>

                      {/* Action */}
                      <button
                        onClick={(e) => handleOpenJob(e, order, orderKey)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 active:bg-[#8ED26B] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.98]"
                      >
                        Open Job <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ================================= DESKTOP: DATA TABLE (lg+) ================================= */}
          <div className="hidden lg:block bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Job Reference</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Customer Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Location Matrix</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Execution Schedule</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gray-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const addressQuery = encodeURIComponent(`${order.address || ''} ${order.city || ''} ${order.pincode || ''}`.trim());
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
                    const orderKey = order.id ?? order.job_id ?? order.order_id;
                    const distanceKm = order.latitude && order.longitude && userLocation ? getDistanceKm(userLocation.lat, userLocation.lng, order.latitude, order.longitude) : null;
                    const statusStr = (order.status || 'pending').toLowerCase();

                    return (
                      <tr key={orderKey} className="hover:bg-[#fcfdfc] transition-colors group">

                        {/* Job Reference */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-1.5">
                            <h3 className="font-bold text-gray-900 text-sm whitespace-normal min-w-[180px] leading-snug">
                              {order.product_name || 'Service Request'}
                            </h3>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-gray-400 tracking-wider font-mono">
                                JOB: <span className="text-gray-600">{order.job_id || 'N/A'}</span>
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 tracking-wider font-mono">
                                ORD: <span className="text-gray-600">{order.order_id || order.id?.substring(0,8)}</span>
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-[#5aaa3a] bg-[#edfae3] px-2 py-0.5 rounded border border-[#8ED26B]/30 w-max">
                              <Briefcase size={10} /> {order.type_of_service || 'Standard'}
                            </span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-gray-800">{order.customer_name || 'N/A'}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500">{order.phone || '—'}</span>
                              {order.phone && (
                                <a
                                  href={`tel:${order.phone}`}
                                  title={`Call ${order.customer_name || 'customer'}`}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#edfae3] text-[#5aaa3a] border border-[#8ED26B]/30 hover:bg-[#8ED26B] hover:text-white transition-colors"
                                >
                                  <Phone size={11} />
                                </a>
                              )}
                            </div>
                            {order.remarks && (
                              <div className="mt-2 text-[10px] font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100 max-w-[200px] whitespace-normal leading-tight">
                                <span className="uppercase tracking-wider font-bold block mb-0.5 text-amber-600">Instructions</span>
                                {order.remarks}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-2 min-w-[220px]">
                            <div>
                              <p className="text-xs font-semibold text-gray-700 whitespace-normal leading-relaxed">{order.address || 'No address'}</p>
                              <p className="text-[10px] font-bold text-gray-400 mt-0.5">{[order.city, order.state, order.pincode].filter(Boolean).join(', ')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {order.address && (
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 hover:bg-blue-100 transition-colors">
                                  <Navigation size={12} /> Map View
                                </a>
                              )}
                              {distanceKm !== null && (
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                  {distanceKm.toFixed(1)} km away
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Schedule & Exec */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                              <Clock size={14} className="text-[#8ED26B]" />
                              {order.scheduled_date ? `${order.scheduled_date}` : 'TBD'}
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 ml-5">
                              {order.scheduled_time || 'Time TBD'}
                            </span>
                            <div className="mt-2 border-t border-gray-100 pt-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Assigned To</span>
                              <span className="text-xs font-bold text-gray-700">{order.assigned_executor_name || activeSession.name}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-5 align-top">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm border ${statusBadgeClasses(statusStr)}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${statusDotClasses(statusStr)}`} />
                            {order.status?.replace('_', ' ') || 'Pending'}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-5 align-top text-right">
                          <button
                            onClick={(e) => handleOpenJob(null, order, orderKey)}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-[#8ED26B] text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg transform active:scale-95"
                          >
                            Open Job <ChevronRight size={14} />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </main>
  );
}

// 2. MAIN EXPORT WRAPPED IN SUSPENSE
export default function ExecutorOrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-56 sm:h-64 space-y-4 bg-white m-8 rounded-3xl border border-gray-100 shadow-sm">
        <Loader2 size={36} className="animate-spin text-[#8ED26B]" />
        <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Dashboard...</p>
      </div>
    }>
      <ExecutorOrdersContent />
    </Suspense>
  );
}