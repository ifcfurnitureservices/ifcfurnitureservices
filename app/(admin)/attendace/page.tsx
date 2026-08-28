'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import {
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Camera,
  X,
  Loader2,
  Search,
  UserCheck,
  Activity,
  AlertTriangle,
  Briefcase,
  Timer,
  CheckSquare,
  MapPin,
  Image as ImageIcon,
  LogOut,
  UserMinus
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Executor = { id: string; full_name: string; phone?: string | null; role?: string | null; status?: string | null };

type UnifiedTask = {
  id: string;
  category: string;
  time: string;
  remarks: string | null;
  media_url: string | null;
};

type UnifiedLog = {
  id: string;
  type: 'standard' | 'modular';
  date: string;
  jobId: string;
  jobName: string;
  inTime: string | null;
  outTime: string | null;
  staticWorkedMs: number;
  isActive: boolean;
  acceptSelfie: string | null;
  endSelfie: string | null;
  tasks: UnifiedTask[];
};

type ExecutorStats = {
  executor: Executor;
  presentDates: Set<string>;
  totalStaticMs: number;
  lastActiveDate: string | null;
  entries: UnifiedLog[];
};

// Database row types
type OrderLite = { id: string; assigned_executor_id: string | null; job_id: string | null; product_name: string | null };
type ModularProjectLite = { id: string; customer_name: string | null; job_id: string | null };
type ModularTaskLite = { id: string; daily_log_id: string; category: string; created_at: string; remarks: string | null; media_url: string | null };

/* ─── Utilities ──────────────────────────────────────────────────────────── */
const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDateLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
};

const monthLabel = (d: Date) => d.toLocaleDateString([], { month: 'long', year: 'numeric' });
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const todayKey = () => new Date().toISOString().slice(0, 10);

const getLiveDurationMs = (inTime: string | null, outTime: string | null, staticMs: number, now: number) => {
  if (outTime || !inTime) return staticMs; 
  const inMs = new Date(inTime).getTime();
  return Math.max(0, now - inMs);
};

const fmtHumanLive = (ms: number) => {
  if (!ms || ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function CrmAttendancePage() {
  const supabase = useMemo(() => createClient(), []);

  // Filter State
  const [filterDate, setFilterDate] = useState(todayKey());
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<ExecutorStats[]>([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'date' | 'absent' | 'active'>('all');
  const [detailExecutor, setDetailExecutor] = useState<ExecutorStats | null>(null);

  // Live Timer State
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
      const monthEndExclusive = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString();

      // 1. Fetch Executors
      const { data: execs, error: execErr } = await supabase.from('executors').select('id, full_name, phone, role, status');
      if (execErr) throw execErr;

      // 2. Fetch Standard Jobs
      const { data: standardRows } = await supabase
        .from('job_execution')
        .select('id, order_id, travel_start_time, end_time, accept_selfie_url, end_selfie_url, actual_worked_ms')
        .gte('travel_start_time', monthStart)
        .lt('travel_start_time', monthEndExclusive)
        .not('accept_selfie_url', 'is', null);

      let standardOrders: OrderLite[] = [];
      const standardOrderIds = Array.from(new Set((standardRows || []).map((r) => r.order_id)));
      if (standardOrderIds.length > 0) {
        const { data } = await supabase.from('orders').select('id, assigned_executor_id, job_id, product_name').in('id', standardOrderIds);
        standardOrders = data || [];
      }
      const standardOrderMap = new Map(standardOrders.map((o) => [o.id, o]));

      // 3. Fetch Modular Jobs & Tasks
      const { data: modularRows } = await supabase
        .from('modular_daily_logs')
        .select('id, project_id, executor_id, check_in_time, check_out_time, check_in_selfie_url, check_out_selfie_url')
        .gte('check_in_time', monthStart)
        .lt('check_in_time', monthEndExclusive)
        .not('check_in_selfie_url', 'is', null);

      const modularLogIds = Array.from(new Set((modularRows || []).map(r => r.id)));
      let modularTasks: ModularTaskLite[] = [];
      if (modularLogIds.length > 0) {
        const { data } = await supabase.from('modular_task_updates').select('id, daily_log_id, category, created_at, remarks, media_url').in('daily_log_id', modularLogIds).order('created_at', { ascending: true });
        modularTasks = data || [];
      }

      let modularProjects: ModularProjectLite[] = [];
      const modularProjectIds = Array.from(new Set((modularRows || []).map(r => r.project_id)));
      if (modularProjectIds.length > 0) {
        const { data } = await supabase.from('modular_projects').select('id, customer_name, job_id').in('id', modularProjectIds);
        modularProjects = data || [];
      }
      const modularProjectMap = new Map(modularProjects.map(p => [p.id, p]));

      // 4. Build the Unified Map
      const statMap = new Map<string, ExecutorStats>();
      (execs || []).forEach((ex: Executor) => {
        statMap.set(ex.id, { executor: ex, presentDates: new Set(), totalStaticMs: 0, lastActiveDate: null, entries: [] });
      });

      // Populate Standard
      (standardRows || []).forEach((row) => {
        const order = standardOrderMap.get(row.order_id);
        if (!order?.assigned_executor_id) return;
        const stat = statMap.get(order.assigned_executor_id);
        if (!stat) return;

        const dateKey = (row.travel_start_time || '').slice(0, 10);
        if (!dateKey) return;
        
        const isActive = !row.end_time;
        const jobId = order.job_id || '—';
        const jobName = order.product_name || 'Standard Task';

        stat.presentDates.add(dateKey);
        if (row.actual_worked_ms) stat.totalStaticMs += row.actual_worked_ms;
        if (!stat.lastActiveDate || dateKey > stat.lastActiveDate) stat.lastActiveDate = dateKey;

        stat.entries.push({
          id: row.id, type: 'standard', date: dateKey, jobId, jobName, inTime: row.travel_start_time, outTime: row.end_time,
          staticWorkedMs: row.actual_worked_ms || 0, isActive, acceptSelfie: row.accept_selfie_url, endSelfie: row.end_selfie_url, tasks: [] 
        });
      });

      // Populate Modular
      (modularRows || []).forEach((log) => {
        if (!log.executor_id) return;
        const stat = statMap.get(log.executor_id);
        if (!stat) return;

        const project = modularProjectMap.get(log.project_id);
        const dateKey = (log.check_in_time || '').slice(0, 10);
        if (!dateKey) return;

        const isActive = !log.check_out_time;
        const jobId = project?.job_id || '—';
        const jobName = project?.customer_name || 'Modular Installation';
        
        const tasksForLog = modularTasks.filter(t => t.daily_log_id === log.id).map(t => ({
          id: t.id, category: t.category, time: t.created_at, remarks: t.remarks, media_url: t.media_url
        }));

        let staticMs = 0;
        if (log.check_out_time && log.check_in_time) {
          staticMs = new Date(log.check_out_time).getTime() - new Date(log.check_in_time).getTime();
        }

        stat.presentDates.add(dateKey);
        stat.totalStaticMs += staticMs;
        if (!stat.lastActiveDate || dateKey > stat.lastActiveDate) stat.lastActiveDate = dateKey;

        stat.entries.push({
          id: log.id, type: 'modular', date: dateKey, jobId, jobName, inTime: log.check_in_time, outTime: log.check_out_time,
          staticWorkedMs: staticMs, isActive, acceptSelfie: log.check_in_selfie_url, endSelfie: log.check_out_selfie_url, tasks: tasksForLog
        });
      });

      statMap.forEach((s) => s.entries.sort((a, b) => (a.date < b.date ? 1 : -1)));
      setStats(Array.from(statMap.values()).sort((a, b) => a.executor.full_name.localeCompare(b.executor.full_name)));

    } catch (err: any) {
      setError(err?.message || 'Could not load CRM attendance data.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    setFilterDate(newDate);
    if (filterMode === 'all') setFilterMode('date');
    
    const d = new Date(newDate);
    if (d.getMonth() !== monthDate.getMonth() || d.getFullYear() !== monthDate.getFullYear()) {
      setMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // ── KPI CALCULATIONS ──
  const totalExecutors = stats.length;
  const presentOnDateCount = stats.filter(s => s.presentDates.has(filterDate)).length;
  const absentOnDateCount = totalExecutors - presentOnDateCount;

  const totalLiveDateMs = stats.reduce((total, stat) => {
    const dateEntries = stat.entries.filter(e => e.date === filterDate);
    const execMs = dateEntries.reduce((sum, entry) => sum + getLiveDurationMs(entry.inTime, entry.outTime, entry.staticWorkedMs, now), 0);
    return total + execMs;
  }, 0);

  // ── FILTER LOGIC ──
  const filteredAndSearchedStats = stats.filter((s) => {
    // 1. Search Filter
    if (search && !s.executor.full_name.toLowerCase().includes(search.toLowerCase())) return false;

    // 2. State & Date Filters
    const dateEntries = s.entries.filter(e => e.date === filterDate);
    const isPresentOnDate = dateEntries.length > 0;
    
    let dayStatus = 'offline';
    if (isPresentOnDate) {
      const activeEntry = dateEntries.find(e => e.isActive);
      if (activeEntry && filterDate === todayKey()) {
        dayStatus = 'active';
      } else {
        dayStatus = 'completed';
      }
    }

    if (filterMode === 'date' && !isPresentOnDate) return false;
    if (filterMode === 'absent' && isPresentOnDate) return false;
    if (filterMode === 'active' && dayStatus !== 'active') return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans text-gray-800">
      {/* ================================= HEADER ================================= */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#8ED26B] flex items-center justify-center shrink-0 shadow-inner">
              <Activity size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#5aaa3a] uppercase tracking-wider">CRM Dashboard</p>
              <h1 className="text-sm sm:text-lg font-black text-gray-900 truncate">Workforce Pulse</h1>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 bg-[#f4fcf0] border border-[#8ED26B]/30 rounded-xl px-2 py-1.5 shrink-0 shadow-inner">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-[#5aaa3a] transition-all">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs sm:text-sm font-bold text-[#5aaa3a] px-1 sm:px-3 flex items-center gap-2 whitespace-nowrap">
              <Calendar size={14} className="hidden sm:inline" /> {monthLabel(monthDate)}
            </span>
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-[#5aaa3a] transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl mb-6 shadow-sm">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* ── Live KPI Cards (Clickable to Filter) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          
          <button 
            onClick={() => setFilterMode('all')}
            className={`bg-white rounded-2xl border text-left p-5 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filterMode === 'all' ? 'ring-2 ring-[#8ED26B] border-transparent' : 'border-gray-200 hover:border-[#8ED26B]/50'}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Users size={64} className="text-[#8ED26B]"/></div>
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center"><Users size={14} className="text-gray-600" /></div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Team</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 relative z-10">{totalExecutors}</p>
          </button>
          
          <button 
            onClick={() => setFilterMode('date')}
            className={`bg-white rounded-2xl border text-left p-5 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filterMode === 'date' ? 'ring-2 ring-[#8ED26B] border-transparent' : 'border-gray-200 hover:border-[#8ED26B]/50'}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><UserCheck size={64} className="text-[#8ED26B]"/></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[#f4fcf0] flex items-center justify-center"><UserCheck size={14} className="text-[#5aaa3a]" /></div>
                <span className="text-[11px] font-bold text-[#5aaa3a] uppercase tracking-wider">Present {filterDate === todayKey() ? 'Today' : ''}</span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 relative z-10">{presentOnDateCount}</p>
          </button>

          <button 
            onClick={() => setFilterMode('absent')}
            className={`bg-white rounded-2xl border text-left p-5 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filterMode === 'absent' ? 'ring-2 ring-red-400 border-transparent' : 'border-gray-200 hover:border-red-300'}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><UserMinus size={64} className="text-red-500"/></div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center"><UserMinus size={14} className="text-red-500" /></div>
                <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Absent {filterDate === todayKey() ? 'Today' : ''}</span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 relative z-10">{absentOnDateCount}</p>
          </button>

          <button 
            onClick={() => setFilterMode('date')}
            className={`bg-white rounded-2xl border text-left p-5 shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filterMode === 'date' ? 'ring-2 ring-[#8ED26B] border-transparent' : 'border-gray-200 hover:border-[#8ED26B]/50'}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Timer size={64} className="text-[#8ED26B]"/></div>
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <div className="w-7 h-7 rounded-md bg-[#f4fcf0] flex items-center justify-center"><Clock size={14} className="text-[#5aaa3a]" /></div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Hours</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[#5aaa3a] relative z-10 tabular-nums">{fmtHumanLive(totalLiveDateMs)}</p>
          </button>

        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team member..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8ED26B]/40 focus:border-[#8ED26B] transition-all"
            />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            {/* Date Picker */}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#8ED26B]/40 focus-within:border-[#8ED26B] transition-all shrink-0">
              <Calendar size={16} className="text-[#8ED26B] mr-2 shrink-0" />
              <input 
                type="date" 
                value={filterDate}
                onChange={handleDateChange}
                className="text-sm font-bold text-gray-700 focus:outline-none cursor-pointer w-full bg-transparent"
              />
            </div>

            {/* Segmented Filter */}
            <div className="flex bg-gray-200/60 p-1 rounded-xl shrink-0">
              <button 
                onClick={() => setFilterMode('all')} 
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilterMode('date')} 
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'date' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Present
              </button>
              <button 
                onClick={() => setFilterMode('absent')} 
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'absent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Absent
              </button>
              <button 
                onClick={() => { setFilterDate(todayKey()); setFilterMode('active'); }} 
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ml-1 ${filterMode === 'active' ? 'bg-[#f4fcf0] text-[#5aaa3a] shadow-sm ring-1 ring-[#8ED26B]/40' : 'text-gray-500 hover:text-[#5aaa3a]'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${filterMode === 'active' ? 'bg-[#8ED26B] animate-pulse' : 'bg-gray-400'}`}></span> Live
              </button>
            </div>
          </div>
        </div>

        {/* ── CRM Table ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <Loader2 size={36} className="animate-spin text-[#8ED26B]" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Syncing Live Data...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-left align-middle">Executor & ID</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-left align-middle">Status on {fmtDateLabel(filterDate)}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center align-middle">Month Attd.</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center align-middle">Hours Logged ({fmtDateLabel(filterDate)})</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right align-middle">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSearchedStats.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-bold text-gray-400">No matching records found.</td></tr>
                  )}
                  {filteredAndSearchedStats.map((s) => {
                    const dateEntries = s.entries.filter(e => e.date === filterDate);
                    const isPresentOnDate = dateEntries.length > 0;
                    
                    let dayStatus = 'offline';
                    
                    if (isPresentOnDate) {
                      const activeEntry = dateEntries.find(e => e.isActive);
                      if (activeEntry && filterDate === todayKey()) {
                        dayStatus = 'active';
                      } else {
                        dayStatus = 'completed';
                      }
                    }

                    const userDateLiveMs = dateEntries.reduce((sum, entry) => sum + getLiveDurationMs(entry.inTime, entry.outTime, entry.staticWorkedMs, now), 0);
                    // Generate a nice short ID for the UI
                    const shortId = s.executor.id.length > 8 ? s.executor.id.slice(0, 8).toUpperCase() : s.executor.id;

                    return (
                      <tr key={s.executor.id} className="hover:bg-[#f4fcf0]/50 transition-colors group">
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-black shadow-sm ${dayStatus === 'active' ? 'bg-[#8ED26B]' : isPresentOnDate ? 'bg-gray-400' : 'bg-gray-200'}`}>
                              {s.executor.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 group-hover:text-[#5aaa3a] transition-colors">{s.executor.full_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200" title={s.executor.id}>ID: {shortId}</span>
                                {s.executor.role && <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{s.executor.role}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          {dayStatus === 'active' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ED26B] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8ED26B]"></span>
                              </span>
                              <span className="text-[11px] font-black text-[#5aaa3a] uppercase tracking-wider">Working Now</span>
                            </div>
                          ) : isPresentOnDate ? (
                            <div>
                              <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Checked Out</span>
                              <p className="text-xs font-semibold text-gray-500 line-clamp-1 mt-1">Completed shift today.</p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">Absent / Offline</span>
                              <p className="text-xs font-medium text-gray-400 line-clamp-1 mt-0.5">
                                No entries on this date.
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <span className="inline-flex items-center justify-center bg-gray-50 text-gray-700 font-black text-xs px-2.5 py-1 rounded-md border border-gray-200 shadow-sm">
                            {s.presentDates.size} / {daysInMonth(monthDate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                          <span className={`inline-flex items-center justify-center font-black text-sm tabular-nums ${dayStatus === 'active' ? 'text-[#5aaa3a] bg-[#f4fcf0] px-2.5 py-1 rounded-md border border-[#8ED26B]/30' : isPresentOnDate ? 'text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200' : 'text-gray-300'}`}>
                            {fmtHumanLive(userDateLiveMs)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right align-middle">
                          <button
                            onClick={() => setDetailExecutor(s)}
                            disabled={s.entries.length === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition-all bg-[#8ED26B]"
                          >
                            <Activity size={14} /> View CRM Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ================================= PERFECT CHRONOLOGICAL TIMELINE MODAL ================================= */}
      {detailExecutor && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-gray-50 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-3xl w-full h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            
            {/* Modal Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-5 shrink-0 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-black shadow-inner bg-[#8ED26B]">
                  {detailExecutor.executor.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">{detailExecutor.executor.full_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs font-bold text-gray-500">{monthLabel(monthDate)} Record</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailExecutor(null)} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors shadow-sm">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: PERFECT Timeline View */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
              {detailExecutor.entries.length === 0 && (
                <div className="text-center py-12">
                  <Briefcase size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm font-bold text-gray-400">No activity logged for this month.</p>
                </div>
              )}

              {detailExecutor.entries.map((log) => {
                const logLiveMs = getLiveDurationMs(log.inTime, log.outTime, log.staticWorkedMs, now);
                
                // Construct a perfect chronological event list
                type TimelineEvent = { type: 'in' | 'out' | 'task'; time: string; img?: string | null; category?: string; remarks?: string | null; media?: string | null; };
                const events: TimelineEvent[] = [];
                
                if (log.inTime) {
                  events.push({ type: 'in', time: log.inTime, img: log.acceptSelfie });
                }
                log.tasks.forEach(t => {
                  events.push({ type: 'task', time: t.time, category: t.category, remarks: t.remarks, media: t.media_url });
                });
                if (log.outTime) {
                  events.push({ type: 'out', time: log.outTime, img: log.endSelfie });
                }
                events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

                return (
                  <div key={log.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    {/* Day & Job Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
                      <div>
                        <h4 className="text-sm font-black text-gray-900 mb-2">{fmtDateLabel(log.date)}</h4>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1.5">
                            ID: {log.jobId}
                          </span>
                          <span className="text-[10px] font-bold text-[#5aaa3a] bg-[#f4fcf0] border border-[#8ED26B]/40 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1.5">
                            <Briefcase size={12} /> {log.jobName}
                          </span>
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 flex items-center gap-1.5 shadow-inner">
                        <Timer size={14} className={log.isActive ? "text-[#8ED26B] animate-pulse" : "text-gray-400"} /> 
                        Total: {fmtHumanLive(logLiveMs)}
                      </div>
                    </div>

                    {/* Strict Vertical Timeline */}
                    <div className="relative pl-6 sm:pl-8 border-l-2 border-gray-100 space-y-6 pb-2 ml-2 sm:ml-4">
                      
                      {events.map((ev, idx) => (
                        <div key={idx} className="relative">
                          {/* IN EVENT */}
                          {ev.type === 'in' && (
                            <>
                              <div className="absolute -left-[31px] sm:-left-[39px] bg-white p-1 rounded-full border-2 border-green-200"><MapPin size={12} className="text-green-500"/></div>
                              <div className="bg-green-50/50 border border-green-100 rounded-xl p-3 flex items-start gap-4">
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-0.5">Check In</p>
                                  <p className="text-sm font-black text-gray-800">{fmtTime(ev.time)}</p>
                                </div>
                                {ev.img && (
                                  <a href={ev.img} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shadow-sm block hover:opacity-80 transition-opacity shrink-0">
                                    <img src={ev.img} alt="In" className="w-full h-full object-cover" />
                                  </a>
                                )}
                              </div>
                            </>
                          )}

                          {/* TASK EVENT */}
                          {ev.type === 'task' && (
                            <>
                              <div className="absolute -left-[31px] sm:-left-[39px] bg-white p-1 rounded-full border-2 border-[#8ED26B]/40"><CheckSquare size={12} className="text-[#5aaa3a]"/></div>
                              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3">
                                <div className="flex items-start justify-between mb-1.5">
                                  <p className="text-sm font-bold text-gray-900">{ev.category}</p>
                                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">{fmtTime(ev.time)}</span>
                                </div>
                                <p className="text-xs font-medium text-gray-500 leading-snug mb-2">{ev.remarks || 'Task completed without remarks.'}</p>
                                {ev.media && (
                                  <a href={ev.media} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#5aaa3a] bg-[#f4fcf0] border border-[#8ED26B]/30 px-2 py-1 rounded-md hover:bg-[#8ED26B]/20 transition-colors">
                                    <ImageIcon size={12} /> View Uploaded Media
                                  </a>
                                )}
                              </div>
                            </>
                          )}

                          {/* OUT EVENT */}
                          {ev.type === 'out' && (
                            <>
                              <div className="absolute -left-[31px] sm:-left-[39px] bg-white p-1 rounded-full border-2 border-red-200"><LogOut size={12} className="text-red-500"/></div>
                              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex items-start gap-4">
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-0.5">Check Out</p>
                                  <p className="text-sm font-black text-gray-800">{fmtTime(ev.time)}</p>
                                </div>
                                {ev.img && (
                                  <a href={ev.img} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shadow-sm block hover:opacity-80 transition-opacity shrink-0">
                                    <img src={ev.img} alt="Out" className="w-full h-full object-cover" />
                                  </a>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* ACTIVE / WORKING NOW BADGE (if no check-out event) */}
                      {log.isActive && (
                        <div className="relative mt-2">
                           <div className="absolute -left-[27px] sm:-left-[35px] top-1">
                            <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ED26B] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8ED26B]"></span>
                            </span>
                          </div>
                          <p className="text-xs font-black text-[#5aaa3a] italic">Currently working on site...</p>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}