'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { Package, Clock, CheckCircle, XCircle, Filter, Calendar, Layers, Box } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid 
} from 'recharts';

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter(); 
  
  const [normalOrders, setNormalOrders] = useState<any[]>([]);
  const [modularOrders, setModularOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Toggle State
  const [activeTab, setActiveTab] = useState<'normal' | 'modular'>('normal');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('All');

  // Reset partner filter when switching tabs to avoid "No data" if partner doesn't exist in the other tab
  useEffect(() => {
    setSelectedPartner('All');
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch both tables independently
    const [ordersRes, modularRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: true }),
      supabase.from('modular_projects').select('*').order('created_at', { ascending: true })
    ]);

    setNormalOrders(ordersRes.data || []);
    setModularOrders(modularRes.data || []);
    setLoading(false);
  };

  // 1. Get the currently active dataset and normalize statuses so the 4 KPI cards work for both
  const activeData = useMemo(() => {
    const rawData = activeTab === 'normal' ? normalOrders : modularOrders;
    
    return rawData.map(item => {
      let mappedStatus = item.status;
      
      // If it's modular, map the detailed statuses into the 3 main buckets (pending, completed, cancelled)
      if (activeTab === 'modular') {
        if (item.status === 'completed') {
          mappedStatus = 'completed';
        } else if (item.status === 'rejected' || item.status === 'cancelled') {
          mappedStatus = 'cancelled';
        } else {
          mappedStatus = 'pending'; // covers submitted, assigned, in_progress, awaiting_countertop, etc.
        }
      }

      return {
        ...item,
        mappedStatus,
        partnerName: item.client || 'Direct / Unassigned'
      };
    });
  }, [activeTab, normalOrders, modularOrders]);

  // Theme colors - Kept the same for both Normal and Modular as requested
  const themeColor = '#8ED26B';
  const themeBgColor = 'bg-[#f0fce8]';

  // 2. Extract Unique Partners for Dropdown based on active tab
  const partners = useMemo(() => {
    const unique = new Set(activeData.map(o => o.partnerName));
    return ['All', ...Array.from(unique)];
  }, [activeData]);

  // 3. Apply Date & Partner Filters
  const filteredOrders = useMemo(() => {
    return activeData.filter((order) => {
      const matchPartner = selectedPartner === 'All' || order.partnerName === selectedPartner;
      
      const orderDate = new Date(order.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      const matchStart = start ? orderDate >= start : true;
      const matchEnd = end ? orderDate <= end : true;

      return matchPartner && matchStart && matchEnd;
    });
  }, [activeData, selectedPartner, startDate, endDate]);

  // 4. Calculate KPI Metrics
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => o.mappedStatus === 'completed').length;
  const pendingOrders = filteredOrders.filter(o => o.mappedStatus === 'pending').length;
  const cancelledOrders = filteredOrders.filter(o => o.mappedStatus === 'cancelled').length;

  const completedPercent = totalOrders === 0 ? 0 : Math.round((completedOrders / totalOrders) * 100);
  const pendingPercent = totalOrders === 0 ? 0 : Math.round((pendingOrders / totalOrders) * 100);

  // 5. Prepare Chart Data: Partner-wise Count
  const partnerData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      counts[o.partnerName] = (counts[o.partnerName] || 0) + 1;
    });
    return Object.keys(counts)
      .map(key => ({ name: key, count: counts[key] }))
      .sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  const toLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 6. Prepare Chart Data: Daily Trend
  const dailyTrendData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const dateStr = toLocalDateKey(new Date(o.created_at));
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .map(date => {
        const [y, m, d] = date.split('-').map(Number);
        const displayDate = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { date: displayDate, orders: counts[date] };
      });
  }, [filteredOrders]);

  // ── ROUTING HANDLER FOR KPI CARDS ──
  const handleKpiClick = (statusKey: string) => {
    if (activeTab === 'normal') {
      // 1. NORMAL ORDERS ROUTING
      const normalRoute = '/orders'; // Change if your normal orders page is different
      if (statusKey === 'all') {
        router.push(normalRoute);
      } else {
        router.push(`${normalRoute}?status=${statusKey}`);
      }
    } else {
      // 2. MODULAR ORDERS ROUTING
      // ⚠️ CHANGE THIS to your exact modular admin page URL
      const modularRoute = '/modular-admin-schedule'; 

      if (statusKey === 'all') {
        router.push(modularRoute);
      } else if (statusKey === 'pending') {
        // Modular 'pending' maps to 'submitted' (Needs Validation) in your Modular Admin UI
        router.push(`${modularRoute}?status=submitted`);
      } else {
        // For completed and cancelled, they perfectly match the modular status filters
        router.push(`${modularRoute}?status=${statusKey}`);
      }
    }
  };

  const KPICard = ({ title, value, icon: Icon, color, bgColor, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer hover:ring-2 hover:ring-opacity-50"
      style={{ '--tw-ring-color': color } as React.CSSProperties}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgColor}`}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      
      {/* ── TOGGLE SWITCH ── */}
      <div className="flex justify-center md:justify-start mb-8">
        <div className="flex bg-gray-200/60 p-1.5 rounded-xl shadow-inner border border-gray-200">
          <button
            onClick={() => setActiveTab('normal')}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'normal' 
                ? 'bg-white text-[#8ED26B] shadow-sm ring-1 ring-gray-900/5' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Box size={16} /> Normal Orders
          </button>
          <button
            onClick={() => setActiveTab('modular')}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'modular' 
                ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-gray-900/5' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers size={16} /> Modular Orders
          </button>
        </div>
      </div>

      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'normal' ? 'Normal Orders Dashboard' : 'Modular Orders Dashboard'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time metrics and order analytics</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-3">
            <Filter size={16} className="text-gray-400" />
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="text-sm border-none bg-transparent outline-none text-gray-700 font-medium cursor-pointer focus:ring-0 max-w-[150px] truncate"
            >
              {partners.map(p => (
                <option key={p} value={p}>{p === 'All' ? 'All Partners' : p}</option>
              ))}
            </select>
          </div>
          
          <div className="w-px h-6 bg-gray-200" />

          <div className="flex items-center gap-2 px-3">
            <Calendar size={16} className="text-gray-400" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border-none bg-transparent outline-none text-gray-600 cursor-pointer"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border-none bg-transparent outline-none text-gray-600 cursor-pointer"
            />
          </div>
          
          {(startDate || endDate || selectedPartner !== 'All') && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedPartner('All'); }}
              className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Loading {activeTab} metrics...
        </div>
      ) : (
        <>
          {/* KPI METRICS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard 
              title="Total Orders" 
              value={totalOrders} 
              icon={Package} 
              color={themeColor} 
              bgColor={themeBgColor} 
              onClick={() => handleKpiClick('all')} 
            />
            <KPICard 
              title=" Orders Pending" 
              value={pendingOrders} 
              icon={Clock} 
              color="#f59e0b" 
              bgColor="bg-amber-50" 
              onClick={() => handleKpiClick('pending')} 
            />
            <KPICard 
              title="Orders Completed" 
              value={completedOrders} 
              icon={CheckCircle} 
              color="#10b981" 
              bgColor="bg-emerald-50" 
              onClick={() => handleKpiClick('completed')} 
            />
            <KPICard 
              title="Orders Cancelled" 
              value={cancelledOrders} 
              icon={XCircle} 
              color="#ef4444" 
              bgColor="bg-red-50" 
              onClick={() => handleKpiClick('cancelled')} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* PERCENTAGE WIDGETS */}
            <div className="lg:col-span-1 space-y-6">
              {/* Pending % */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Order Pending %</h3>
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 flex items-center justify-center rounded-full" 
                       style={{ background: `conic-gradient(#f59e0b ${pendingPercent}%, #fef3c7 ${pendingPercent}%)` }}>
                    <div className="absolute w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                      <span className="text-xl font-bold text-gray-800">{pendingPercent}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{pendingOrders}</p>
                    <p className="text-sm text-gray-400">Orders await action</p>
                  </div>
                </div>
              </div>

              {/* Completed % */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Order Completed %</h3>
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 flex items-center justify-center rounded-full" 
                       style={{ background: `conic-gradient(${themeColor} ${completedPercent}%, #f0fce8 ${completedPercent}%)` }}>
                    <div className="absolute w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                      <span className="text-xl font-bold text-gray-800">{completedPercent}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{completedOrders}</p>
                    <p className="text-sm text-gray-400">Successfully closed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* DAILY TREND LINE CHART */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Daily Order Trend</h3>
              <div className="h-64 w-full">
                {dailyTrendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No trend data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrendData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ stroke: '#f3f4f6', strokeWidth: 2 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="orders" 
                        stroke={themeColor} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: themeColor, strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 6, strokeWidth: 0 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* PARTNER-WISE BAR CHART */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Partner-wise Order Count</h3>
            <div className="h-72 w-full">
              {partnerData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">No partner data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partnerData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" fill={themeColor} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}