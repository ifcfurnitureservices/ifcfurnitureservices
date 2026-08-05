'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { Package, Clock, CheckCircle, XCircle, Calendar, Layers, Box } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid 
} from 'recharts';

export default function ClientDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [normalOrders, setNormalOrders] = useState<any[]>([]);
  const [modularOrders, setModularOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);

  // Toggle State
  const [activeTab, setActiveTab] = useState<'normal' | 'modular'>('normal');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('clientUser');
    if (!storedUser) {
      router.push('/'); 
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setClientData(parsedUser);
    fetchClientOrders(parsedUser.id);
  }, [router]);

  // ── Fetch only this client's orders from BOTH tables ──
  const fetchClientOrders = async (clientId: string) => {
    setLoading(true);
    
    const [ordersRes, modularRes] = await Promise.all([
      supabase.from('orders').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
      supabase.from('modular_projects').select('*').eq('client_id', clientId).order('created_at', { ascending: true })
    ]);

    if (ordersRes.data) setNormalOrders(ordersRes.data);
    if (modularRes.data) setModularOrders(modularRes.data);
    
    setLoading(false);
  };

  // 1. Get the currently active dataset and normalize statuses for KPI buckets
  const activeData = useMemo(() => {
    const rawData = activeTab === 'normal' ? normalOrders : modularOrders;
    
    return rawData.map(item => {
      let mappedStatus = item.status;
      
      if (activeTab === 'modular') {
        if (item.status === 'completed') {
          mappedStatus = 'completed';
        } else if (item.status === 'rejected' || item.status === 'cancelled') {
          mappedStatus = 'cancelled';
        } else {
          mappedStatus = 'pending'; // covers submitted, assigned, in_progress, awaiting_countertop, etc.
        }
      } else {
        // Normal orders mapping
        if (item.status === 'completed') {
          mappedStatus = 'completed';
        } else if (item.status === 'cancelled') {
          mappedStatus = 'cancelled';
        } else {
          mappedStatus = 'pending'; // covers in_progress, scheduled, pending
        }
      }

      return { ...item, mappedStatus };
    });
  }, [activeTab, normalOrders, modularOrders]);

  // Theme colors unified to green for charts & avatars (except modular toggle button)
  const themeColor = '#8ED26B';
  const themeBgColor = 'bg-[#f0fce8]';
  const avatarGradient = 'from-[#8ED26B] to-[#6eb54a] shadow-[#8ED26B]/20';
  const textGradient = 'from-[#8ED26B] to-[#5a9c3e]';

  // 2. Apply Date Filters
  const filteredOrders = useMemo(() => {
    return activeData.filter((order) => {
      if (!startDate && !endDate) return true;
      
      const orderDate = new Date(order.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999); 

      const matchStart = start ? orderDate >= start : true;
      const matchEnd = end ? orderDate <= end : true;

      return matchStart && matchEnd;
    });
  }, [activeData, startDate, endDate]);

  // 3. Calculate KPI Metrics
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => o.mappedStatus === 'completed').length;
  const pendingOrders = filteredOrders.filter(o => o.mappedStatus === 'pending').length; 
  const cancelledOrders = filteredOrders.filter(o => o.mappedStatus === 'cancelled').length;

  const completedPercent = totalOrders === 0 ? 0 : Math.round((completedOrders / totalOrders) * 100);
  const pendingPercent = totalOrders === 0 ? 0 : Math.round((pendingOrders / totalOrders) * 100);

  // 4. Prepare Chart Data: Service Type
  const serviceData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      // Modular orders might not have type_of_service, so we fallback
      const rawService = o.type_of_service || (activeTab === 'modular' ? 'Modular Installation' : 'Standard Service');
      const services = rawService.split(',').map((s: string) => s.trim());
      services.forEach((service: string) => {
        counts[service] = (counts[service] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map(key => ({ name: key, count: counts[key] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); 
  }, [filteredOrders, activeTab]);

  const toLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 5. Prepare Chart Data: Daily Trend
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
      if (statusKey === 'all') router.push('/order-intake');
      else router.push(`/order-intake?status=${statusKey}`);
    } else {
      // Navigate to modular projects page
      if (statusKey === 'all') router.push('/modular-interior');
      else if (statusKey === 'pending') router.push('/modular-interior?status=submitted');
      else router.push(`/modular-interior?status=${statusKey}`);
    }
  };

  // ── UPDATED KPI CARD WITH ONCLICK & HOVER STYLES ──
  const KPICard = ({ title, value, icon: Icon, color, bgColor, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 min-w-0 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer hover:ring-2 hover:ring-opacity-50"
      style={{ '--tw-ring-color': color } as React.CSSProperties}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
        <Icon size={24} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-wider truncate mt-0.5">{title}</p>
      </div>
    </div>
  );

  // Extract name strings for the UI
  const clientNameStr = clientData?.full_name || 'Client';
  const firstName = clientNameStr.split(' ')[0];
  const initial = firstName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 overflow-x-hidden">
      
      {/* ══ COMPACT ELEGANT HERO & FILTERS ══ */}
      <div className="mb-6 relative overflow-hidden bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-5">
        
        {/* Subtle background glow effects */}
        <div className={`absolute -top-24 -right-12 w-48 h-48 bg-gradient-to-br from-[#8ED26B]/20 to-transparent rounded-full blur-3xl pointer-events-none transition-colors duration-500`} />
        <div className="absolute -bottom-24 -left-12 w-48 h-48 bg-gradient-to-tr from-blue-50 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Left Side: Avatar & Greeting */}
        <div className="relative z-10 flex items-center gap-4 sm:gap-5">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-2xl font-extrabold shadow-md shrink-0 ring-2 ring-white transition-all duration-500`}>
            {initial}
          </div>
          
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mb-1 flex items-center flex-wrap gap-2">
              Welcome back,{' '}
              <span className={`text-transparent bg-clip-text bg-gradient-to-r ${textGradient} transition-all duration-500`}>
                {firstName}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">
              Here is your performance overview and metrics.
            </p>
          </div>
        </div>

        {/* Right Side: Date Filters */}
        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-gray-50/80 p-2.5 rounded-2xl border border-gray-200/60 shadow-sm w-full md:w-auto">
          <div className="flex flex-col sm:flex-row items-center gap-2 px-2 w-full">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs sm:text-sm font-medium border-none bg-transparent outline-none text-gray-900 cursor-pointer w-full"
              />
            </div>
            <span className="text-gray-400 text-xs font-bold uppercase hidden sm:block">to</span>
            <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-none pt-2 sm:pt-0 border-gray-100">
              <span className="text-gray-400 text-xs font-bold uppercase sm:hidden shrink-0">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs sm:text-sm font-medium border-none bg-transparent outline-none text-gray-900 cursor-pointer w-full"
              />
            </div>
          </div>
          
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-2 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors w-full sm:w-auto text-center mt-2 sm:mt-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── TOGGLE SWITCH ── */}
      <div className="flex justify-center md:justify-start mb-6">
        <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('normal')}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'normal' 
                ? 'bg-[#8ED26B]/10 text-[#6eb54a] shadow-sm ring-1 ring-[#8ED26B]/20' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Box size={16} /> Normal Orders
          </button>
          <button
            onClick={() => setActiveTab('modular')}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'modular' 
                ? 'bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers size={16} /> Modular Orders
          </button>
        </div>
      </div>

      {/* ══ KPI METRICS GRID ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard 
          title="Total Orders" 
          value={totalOrders} 
          icon={Package} 
          color={themeColor} 
          bgColor={themeBgColor} 
          onClick={() => handleKpiClick('all')} 
        />
        <KPICard 
          title="Active / Pending" 
          value={pendingOrders} 
          icon={Clock} 
          color="#f59e0b" 
          bgColor="bg-amber-50" 
          onClick={() => handleKpiClick('pending')} 
        />
        <KPICard 
          title="Completed" 
          value={completedOrders} 
          icon={CheckCircle} 
          color="#10b981" 
          bgColor="bg-emerald-50" 
          onClick={() => handleKpiClick('completed')} 
        />
        <KPICard 
          title="Cancelled" 
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
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center min-w-0">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6">Active / Pending %</h3>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-full shrink-0" 
                    style={{ background: `conic-gradient(#f59e0b ${pendingPercent}%, #fef3c7 ${pendingPercent}%)` }}>
                <div className="absolute w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                  <span className="text-lg sm:text-xl font-bold text-gray-800">{pendingPercent}%</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{pendingOrders}</p>
                <p className="text-xs sm:text-sm text-gray-400 truncate">Orders await action</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center min-w-0">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6">Completed %</h3>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-full shrink-0" 
                    style={{ background: `conic-gradient(${themeColor} ${completedPercent}%, #f0fce8 ${completedPercent}%)` }}>
                <div className="absolute w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                  <span className="text-lg sm:text-xl font-bold text-gray-800">{completedPercent}%</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{completedOrders}</p>
                <p className="text-xs sm:text-sm text-gray-400 truncate">Successfully closed</p>
              </div>
            </div>
          </div>
        </div>

        {/* DAILY TREND LINE CHART */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm min-w-0">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6">Daily Order Trend</h3>
          <div className="h-64 w-full">
            {dailyTrendData.length === 0 ? (
               <div className="h-full flex items-center justify-center text-sm text-gray-400">No trend data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrendData} margin={{ top: 5, right: 10, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
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

      {/* SERVICE TYPE BAR CHART */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm mb-8 min-w-0">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6">Orders by Service Type</h3>
        <div className="h-72 w-full overflow-hidden">
          {serviceData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">No service data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceData} margin={{ top: 5, right: 0, bottom: 25, left: -25 }} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#9ca3af' }} 
                  dy={15}
                  tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill={themeColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}