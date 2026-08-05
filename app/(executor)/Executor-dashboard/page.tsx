'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  User,
  ShieldCheck,
  Loader2,
  Clock,
  CheckCircle2,
  ListTodo,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Activity,
  CalendarCheck,
  Zap,
  PieChart
} from 'lucide-react';

// ── Palette used for the Service Type Distribution bars ──
const SERVICE_TYPE_COLORS = ['#8ED26B', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa'];

export default function ExecutorOrdersPage() {
  const supabase = createClient();
  const router = useRouter();

  // ── Auth & Session State ──
  const [activeSession, setActiveSession] = useState<{ type: 'executor' | 'user'; id: string; name: string; email: string } | null>(null);

  // ── Orders State ──
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // ── Dashboard Tabs State ──
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'today_completed' | 'completed' | 'failed'>('all');

  // ── Pull to Refresh State ──
  const [isPulling, setIsPulling] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const PULL_THRESHOLD = 80;

  // ── Check Session on Mount ──
  const checkSession = () => {
    const eUser = localStorage.getItem('executorUser');
    const aUser = localStorage.getItem('adminUser');

    if (eUser) {
      const u = JSON.parse(eUser);
      setActiveSession({ type: 'executor', id: u.id, name: u.full_name || u.name || 'Executor', email: u.email });
    } else if (aUser) {
      const u = JSON.parse(aUser);
      setActiveSession({ type: 'user', id: u.id, name: u.full_name || u.name || 'Admin', email: u.email });
    } else {
      setActiveSession(null);
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    checkSession();

    // Optional: Listen for local storage changes in case they log in via the new Header component
    const handleStorageChange = () => checkSession();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Fetch Orders ──
  useEffect(() => {
    if (activeSession) {
      fetchOrders();
    }
  }, [activeSession]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    
    // Fetch from BOTH tables so the dashboard works for Delivery, Carpenters, and Admins universally
    let ordersQuery = supabase.from('orders').select('*').order('created_at', { ascending: false });
    let modularQuery = supabase.from('modular_projects').select('*').order('created_at', { ascending: false });

    if (activeSession?.type === 'executor') {
      ordersQuery = ordersQuery.eq('assigned_executor_id', activeSession.id);
      modularQuery = modularQuery.eq('assigned_executor_id', activeSession.id);
    }

    const [ordersRes, modularRes] = await Promise.all([ordersQuery, modularQuery]);

    // Combine the results
    const combined = [
      ...(ordersRes.data || []),
      ...(modularRes.data || []).map(p => ({
        ...p,
        service_type: 'Modular Installation', // Tag modular projects for the pie chart
      }))
    ];

    // Sort combined records by date descending
    combined.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    setOrders(combined);
    setLoadingOrders(false);
  };

  // ── Pull to Refresh ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) setPullStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const pulled = e.changedTouches[0].clientY - pullStartY;
    if (pulled > PULL_THRESHOLD && !isPulling) {
      setIsPulling(true);
      await fetchOrders();
      setIsPulling(false);
    }
    setPullStartY(0);
  };

  // ── Compute Stats for Metric Cards & Matrix ──
  const todayStr = new Date().toDateString();
  
  // Safe date parser to prevent "00:00:00" NaN bugs on iOS/Safari
  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    let cleanStr = dateStr;
    if (!cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T');
    if (!cleanStr.endsWith('Z') && !cleanStr.includes('+')) cleanStr += 'Z';
    
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return false;
    return d.toDateString() === todayStr;
  };

  const stats = {
    all: orders.length,
    pending: orders.filter(o => ['pending', 'scheduled', 'assigned', 'submitted', 'in_progress', 'ongoing', 'awaiting_countertop', 'countertop_completed', 'sign_off', 'snag_reopened'].includes((o.status || '').toLowerCase())).length,
    today_completed: orders.filter(o => ['completed', 'done'].includes((o.status || '').toLowerCase()) && isToday(o.updated_at || o.created_at || o.scheduled_date)).length,
    completed: orders.filter(o => ['completed', 'done'].includes((o.status || '').toLowerCase())).length,
    failed: orders.filter(o => ['failed', 'cancelled', 'rejected'].includes((o.status || '').toLowerCase())).length,
  };

  // ── Compute Service Type Distribution (top 5 categories by volume) ──
  const serviceTypeCounts = orders.reduce((acc: Record<string, number>, o) => {
    const label = o.service_type || o.category || o.service_name || o.service || 'General';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const serviceTypeStats = Object.entries(serviceTypeCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  const maxServiceCount = Math.max(1, ...serviceTypeStats.map(([, count]) => count as number));

  return (
    <main
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex-1 max-w-[90rem] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8"
    >
      {isPulling && (
        <div className="flex items-center justify-center gap-2 py-2 mb-2 text-sm font-bold text-[#5aaa3a]">
          <Loader2 size={16} className="animate-spin" /> Refreshing...
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
            <Activity className="text-[#8ED26B] shrink-0" size={26} /> 
            <span>Central Job Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5 sm:mt-2 font-medium">Monitor active dispatches, track logistical progress, and manage execution states.</p>
        </div>

        {activeSession && (
          <button
            onClick={fetchOrders}
            disabled={loadingOrders}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm disabled:opacity-50 transition-all w-full sm:w-auto justify-center"
          >
            <RefreshCw size={16} className={loadingOrders ? "animate-spin text-[#8ED26B]" : "text-[#8ED26B]"} />
            Sync Database
          </button>
        )}
      </div>

      {/* ================================= SQUARE METRIC CARDS ================================= */}
      {!activeSession ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-16 text-center shadow-sm max-w-2xl mx-auto mt-6 sm:mt-10">
          <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4 sm:mb-5 sm:w-14 sm:h-14" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Secure Access Required</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8 font-medium">Please authenticate using the header menu to access the dispatch matrix.</p>
        </div>
      ) : loadingOrders ? (
        <div className="flex flex-col items-center justify-center h-56 sm:h-64 space-y-4 bg-white rounded-3xl border border-gray-100 shadow-sm mb-6 sm:mb-10">
          <Loader2 size={36} className="animate-spin text-[#8ED26B]" />
          <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest">Compiling Database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mb-8 sm:mb-12">
          {[
            { id: 'all', label: 'All Jobs', count: stats.all, icon: ListTodo, color: 'text-gray-700', activeBg: 'bg-gray-900', activeText: 'text-white' },
            { id: 'pending', label: 'Pending Jobs', count: stats.pending, icon: Clock, color: 'text-blue-700', activeBg: 'bg-blue-600', activeText: 'text-white' },
            { id: 'today_completed', label: 'Today Completed', count: stats.today_completed, icon: CalendarCheck, color: 'text-emerald-700', activeBg: 'bg-emerald-500', activeText: 'text-white' },
            { id: 'completed', label: 'Total Completed', count: stats.completed, icon: CheckCircle2, color: 'text-green-700', activeBg: 'bg-[#8ED26B]', activeText: 'text-white' },
            { id: 'failed', label: 'Failed Jobs', count: stats.failed, icon: AlertCircle, color: 'text-red-700', activeBg: 'bg-red-500', activeText: 'text-white' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  router.push(`/my-orders?filter=${tab.id}`);
                }}
                className={`relative overflow-hidden flex flex-col justify-between p-3.5 sm:p-6 aspect-square rounded-2xl sm:rounded-3xl border transition-all duration-300 text-left group cursor-pointer ${
                  isActive
                    ? `${tab.activeBg} border-transparent shadow-xl scale-[1.03]`
                    : 'bg-white border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl w-max ${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-200 transition-colors'}`}>
                  <Icon size={18} className={`sm:w-6 sm:h-6 ${isActive ? tab.activeText : tab.color}`} />
                </div>

                <div className="mt-auto relative z-10">
                  <span className={`text-2xl sm:text-4xl lg:text-5xl font-black block mb-0.5 sm:mb-1 tracking-tight ${isActive ? tab.activeText : 'text-gray-900'}`}>
                    {tab.count}
                  </span>
                  <h4 className={`text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider leading-tight ${isActive ? 'text-white/90' : 'text-gray-500'}`}>
                    {tab.label}
                  </h4>
                </div>

                {/* Decorative background shape for active state */}
                {isActive && (
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ================================= HIGH MODE ANALYTICS ================================= */}
      {activeSession && !loadingOrders && (
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 sm:gap-6 mb-8 border-t border-gray-200 pt-6 sm:pt-10">

          {/* Chart 1: Weekly Performance */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={16} className="text-[#8ED26B] shrink-0 sm:w-[18px] sm:h-[18px]" /> Weekly Performance
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-1 font-medium">Job dispatch resolution over the last 7 days.</p>
            </div>

            <div className="mt-6 sm:mt-8 flex items-end justify-between h-24 sm:h-32 gap-2 sm:gap-3">
              {/* CSS Bar Chart Simulation */}
              {[40, 70, 45, 90, 60, 85, 100].map((height, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 group">
                  <div className="w-full bg-gray-50 rounded-t-lg flex items-end h-full relative overflow-hidden group-hover:bg-gray-100 transition-colors">
                    <div
                      className="w-full rounded-t-lg transition-all duration-1000 ease-out"
                      style={{ height: `${height}%`, backgroundColor: height === 100 ? '#8ED26B' : '#dcf4d1' }}
                    />
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase">D{i+1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Daily Activity Trend (spans both rows to fill the column height on desktop) */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between lg:row-span-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Zap size={16} className="text-amber-500 shrink-0 sm:w-[18px] sm:h-[18px]" /> Activity Trend
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-1 font-medium">Hourly operational volume tracking across shift.</p>
            </div>

            <div className="mt-6 sm:mt-8 flex items-end justify-between h-24 sm:h-32 lg:h-64 gap-1 relative">
              {/* CSS Trend Line/Area Simulation */}
              {[20, 35, 30, 50, 45, 80, 70, 95, 85, 100].map((height, i) => (
                <div key={i} className="flex-1 bg-amber-50 rounded-t-sm relative group hover:bg-amber-100 transition-colors" style={{ height: `${height}%` }}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400 rounded-t-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Chart 3: Efficiency Matrix — ring only, own dedicated card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between items-center">
            <div className="w-full">
              <h3 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-[#5aaa3a] shrink-0 sm:w-[18px] sm:h-[18px]" /> Efficiency Matrix
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-1 font-medium">Overall completion success ratio.</p>
            </div>

            <div className="flex items-center justify-center my-3 sm:my-4 relative">
              {/* CSS Ring Chart */}
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-[8px] sm:border-[10px] border-gray-50 relative flex items-center justify-center shadow-inner">
                <div className="absolute inset-0 rounded-full border-[8px] sm:border-[10px] border-[#8ED26B] border-t-transparent border-r-transparent transform -rotate-45"></div>
                <div className="text-center">
                  <span className="block text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">
                    {stats.all > 0 ? Math.round((stats.completed / stats.all) * 100) : 0}%
                  </span>
                  <span className="block text-[7px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Success</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 4: Service Type Distribution — fills the gap beside Weekly Performance */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <PieChart size={16} className="text-blue-500 shrink-0 sm:w-[18px] sm:h-[18px]" /> Service Type Distribution
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-1 font-medium">Breakdown of job volume by service category.</p>
            </div>

            <div className="mt-4 sm:mt-6 space-y-2.5 sm:space-y-3">
              {serviceTypeStats.length === 0 ? (
                <p className="text-xs text-gray-400 font-medium text-center py-6">No service data available.</p>
              ) : (
                serviceTypeStats.map(([label, count], i) => {
                  const pct = Math.round(((count as number) / maxServiceCount) * 100);
                  const color = SERVICE_TYPE_COLORS[i % SERVICE_TYPE_COLORS.length];
                  return (
                    <div key={label} className="flex items-center gap-2 sm:gap-3">
                      <span className="text-[10px] sm:text-[11px] font-bold text-gray-600 w-16 sm:w-24 truncate shrink-0" title={label}>{label}</span>
                      <div className="flex-1 h-2.5 sm:h-3 bg-gray-50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-black text-gray-900 w-5 sm:w-6 text-right shrink-0">{count as number}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chart 5: Calculations — matching container directly below Efficiency Matrix */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <h3 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3 sm:mb-4">
              <BarChart3 size={16} className="text-gray-400 shrink-0 sm:w-[18px] sm:h-[18px]" /> Calculations
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold bg-gray-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-100">
                <span className="flex items-center gap-2 text-gray-700"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span> Today Completed</span>
                <span className="text-gray-900">= {stats.today_completed}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold bg-gray-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-100">
                <span className="flex items-center gap-2 text-gray-700"><span className="w-2 h-2 rounded-full bg-[#8ED26B] shrink-0"></span> Total Completed</span>
                <span className="text-gray-900">= {stats.completed}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold bg-gray-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-100">
                <span className="flex items-center gap-2 text-gray-700"><span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span> Total Pending</span>
                <span className="text-gray-900">= {stats.pending}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold bg-gray-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-100">
                <span className="flex items-center gap-2 text-gray-700"><span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span> Total Failed</span>
                <span className="text-gray-900">= {stats.failed}</span>
              </div>
            </div>
          </div>

        </div>
      )}

    </main>
  );
}