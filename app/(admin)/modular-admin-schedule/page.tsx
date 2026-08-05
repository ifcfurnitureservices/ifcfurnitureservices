'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Package, Eye, X, AlertCircle, CheckCircle, Loader2, Calendar,
  List, Wrench, Hammer, RefreshCcw, UserCheck, ClipboardCheck,
  RotateCcw, UserPlus, CheckSquare, CalendarDays, User, FileText, ClipboardList,
  XCircle, AlertTriangle, PenLine, HelpCircle, Filter, ChevronDown, Download,
} from 'lucide-react';

type StatusFilter = 'all' | 'submitted' | 'assigned' | 'rejected' | 'in_progress' | 'awaiting_countertop' | 'countertop_completed' | 'completed' | 'snag_reopened' | 'cancelled';

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All Statuses', icon: List },
  { id: 'submitted', label: 'Pending', icon: Calendar },
  { id: 'assigned', label: 'Assigned', icon: Wrench },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
  { id: 'in_progress', label: 'In Progress', icon: Hammer },
  { id: 'awaiting_countertop', label: 'Awaiting Countertop', icon: RefreshCcw },
  { id: 'countertop_completed', label: 'Countertop Done', icon: ClipboardCheck },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'snag_reopened', label: 'Snag / Revisit', icon: AlertCircle },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle }
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  submitted: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: '○ pending' },
  assigned: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● Assigned' },
  rejected: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Rejected' },
  in_progress: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● In Progress' },
  awaiting_countertop: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: '⟳ Awaiting Countertop' },
  countertop_completed: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: '⟳ Countertop Done' },
  completed: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Completed' },
  snag_reopened: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Snag / Revisit' },
  cancelled: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Cancelled' },
};

const PROJECT_TABLE_COLUMNS = [
  { label: 'Job ID', key: 'job_id' },
  { label: 'Client', key: 'client' },
  { label: 'Customer', key: 'customer_name' },
  { label: 'City', key: 'city' },
  { label: 'Status', key: 'status' },
  { label: 'Scheduled Date', key: 'scheduled_date' },
];

function ModularAdminScheduleContent() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');

  const [adminData, setAdminData] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [executors, setExecutors] = useState<any[]>([]);

  // ── Separate Filter States ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Dropdown toggles
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [assignForm, setAssignForm] = useState({ assigned_executor_id: '', scheduled_date: '' });
  const [assigning, setAssigning] = useState(false);

  const [snagTarget, setSnagTarget] = useState<any>(null);
  const [snagForm, setSnagForm] = useState({ reason: 'Snag', remarks: '' });
  const [snagSaving, setSnagSaving] = useState(false);

  const [viewProject, setViewProject] = useState<any>(null);
  const [viewDocs, setViewDocs] = useState<any[]>([]);

  // ── New Countertop Verification States ──
  const [countertopTarget, setCountertopTarget] = useState<any>(null);
  const [verifyingCountertop, setVerifyingCountertop] = useState(false);

  useEffect(() => {
    if (urlStatus) setStatusFilter(urlStatus as StatusFilter);
  }, [urlStatus]);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('adminUser');
    if (!storedAdmin) {
      router.push('/admin/login');
      return;
    }
    setAdminData(JSON.parse(storedAdmin));
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (authChecked) {
      fetchProjects();
      fetchAssigneeLists();
    }
  }, [authChecked]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('modular_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMsg('Failed to load projects.');
    } else if (data) {
      const cleanedData = data.map(p => ({
        ...p,
        status: p.status === 'handed_to_countertop' ? 'awaiting_countertop' : p.status
      }));
      setProjects(cleanedData);
    }
  };

  const fetchAssigneeLists = async () => {
    const { data: execs } = await supabase.from('executors').select('id, full_name, role, phone, email').eq('status', 'active');
    if (execs) setExecutors(execs);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const generateJobId = async () => {
    const { data, error } = await supabase
      .from('modular_projects')
      .select('job_id')
      .like('job_id', 'IFSC-MI-%');
    if (error) console.error('Job ID fetch error:', error);

    let maxSeq = 0;
    const seqPattern = /^IFSC-MI-(\d{4,})$/;
    (data || []).forEach((row: any) => {
      const match = (row.job_id || '').toString().match(seqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `IFSC-MI-${nextSeq}`;
  };

  const openView = async (project: any) => {
    setViewProject(project);
    const { data, error } = await supabase
      .from('modular_project_documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching docs:", error);
    setViewDocs(data || []);
  };

  const openAssign = (project: any) => {
    setAssignTarget(project);
    setAssignForm({
      assigned_executor_id: project.assigned_executor_id || '',
      scheduled_date: project.scheduled_date || new Date().toISOString().split('T')[0],
    });
  };

  const submitAssign = async () => {
    if (!assignForm.assigned_executor_id || !assignForm.scheduled_date) {
      setErrorMsg('Please select an executor and a schedule date.');
      return;
    }
    setAssigning(true);
    setErrorMsg('');
    try {
      const jobId = assignTarget.job_id || await generateJobId();
      const newStatus = ['submitted', 'rejected'].includes(assignTarget.status) ? 'assigned' : assignTarget.status;

      const { error } = await supabase
        .from('modular_projects')
        .update({
          job_id: jobId,
          assigned_executor_id: assignForm.assigned_executor_id,
          scheduled_date: assignForm.scheduled_date,
          status: newStatus,
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignTarget.id);
      if (error) throw error;

      showSuccess(`Project ${assignTarget.status === 'submitted' ? 'Scheduled' : 'Rescheduled'} successfully.`);
      setAssignTarget(null);
      fetchProjects();
    } catch (error: any) {
      setErrorMsg('Error assigning project: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const submitVerifyCountertop = async () => {
    if (!countertopTarget) return;
    setVerifyingCountertop(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.from('modular_projects').update({ status: 'countertop_completed', updated_at: new Date().toISOString() }).eq('id', countertopTarget.id);
      if (error) throw error;

      // Send Email Notification
      try {
        const notifyRes = await fetch('/api/notify-countertop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: countertopTarget.id,
            clientId: countertopTarget.client_id,
            executorId: countertopTarget.assigned_executor_id,
            jobId: countertopTarget.job_id
          })
        });
        
        if (!notifyRes.ok) {
          const errData = await notifyRes.json();
          console.error("API returned an error while sending email:", errData);
        }
      } catch (notifyErr) {
        console.error("Network error while triggering email notifications:", notifyErr);
      }

      showSuccess('Countertop verified! App unlocked and notifications sent.');
      setCountertopTarget(null);
      fetchProjects();
    } catch (err: any) {
      setErrorMsg('Error verifying countertop: ' + err.message);
    } finally {
      setVerifyingCountertop(false);
    }
  };

  const openSnag = (project: any) => {
    setSnagTarget(project);
    setSnagForm({ reason: 'Snag', remarks: '' });
  };

  const submitSnag = async () => {
    if (!snagForm.remarks.trim()) {
      setErrorMsg('Please describe the reason for this snag visit.');
      return;
    }
    setSnagSaving(true);
    setErrorMsg('');
    try {
      const { count } = await supabase
        .from('modular_snag_visits')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', snagTarget.id);
      const seq = String((count || 0) + 1).padStart(2, '0');
      const snagVisitId = `${snagTarget.job_id}-SNAG-${seq}`;

      const { error: snagErr } = await supabase.from('modular_snag_visits').insert([{
        snag_visit_id: snagVisitId,
        project_id: snagTarget.id,
        reason: snagForm.reason,
        remarks: snagForm.remarks,
        status: 'open',
      }]);
      if (snagErr) throw snagErr;

      const { error: projErr } = await supabase
        .from('modular_projects')
        .update({ status: 'snag_reopened', updated_at: new Date().toISOString() })
        .eq('id', snagTarget.id);
      if (projErr) throw projErr;

      showSuccess(`Snag visit ${snagVisitId} created and project reopened.`);
      setSnagTarget(null);
      fetchProjects();
    } catch (error: any) {
      setErrorMsg('Error creating snag visit: ' + error.message);
    } finally {
      setSnagSaving(false);
    }
  };

  // Safe download helper function handling cross-origin properly
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download via blob failed, opening in new tab instead', err);
      window.open(url, '_blank');
    }
  };

  const filtered = projects.filter(p => {
    const matchesSearch =
      p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.job_id?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all' && p.created_at) {
      const projDate = new Date(p.created_at);
      projDate.setHours(0, 0, 0, 0);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateFilter === 'today') {
        matchesDate = projDate.getTime() === today.getTime();
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        matchesDate = projDate >= lastWeek;
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        matchesDate = projDate >= lastMonth;
      } else if (dateFilter === 'custom') {
        if (customStartDate) {
          const sDate = new Date(customStartDate);
          sDate.setHours(0, 0, 0, 0);
          if (projDate < sDate) matchesDate = false;
        }
        if (customEndDate) {
          const eDate = new Date(customEndDate);
          eDate.setHours(23, 59, 59, 999);
          if (projDate > eDate) matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const submittedCount = projects.filter(p => p.status === 'submitted').length;
  const activeCount = projects.filter(p => !['completed', 'submitted', 'rejected', 'cancelled'].includes(p.status)).length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_BADGE[status] ?? { cls: 'bg-gray-50 text-gray-700 border border-gray-200', label: 'Unknown' };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  const truncate = (val: any, len = 18) => {
    const str = val?.toString() ?? '';
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!authChecked) return <Loader2 className="animate-spin mx-auto mt-20 text-[#8ED26B]" size={40} />;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      
      {/* Click-away backdrop for dropdowns */}
      {(isStatusOpen || isDateOpen) && (
        <div className="fixed inset-0 z-30" onClick={() => { setIsStatusOpen(false); setIsDateOpen(false); }} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Modular Interior Installation — Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">Review projects, schedule teams, and manage timelines</p>
        </div>

        {successMsg && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
            <CheckCircle size={16} className="flex-shrink-0" /> {successMsg}
          </div>
        )}
        {errorMsg && !viewProject && !assignTarget && !snagTarget && !countertopTarget && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Needs Validation', value: submittedCount, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Active', value: activeCount, icon: Hammer, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl px-6 py-5 border border-gray-200 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 p-4 gap-4 bg-white relative z-40">
            
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search Job ID, client, customer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-blue-400 focus:ring-1 focus:bg-white transition-all text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Separate Filter Dropdowns */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap relative z-50">
              
              {/* Separate Date Filter */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsDateOpen(!isDateOpen); setIsStatusOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border shadow-sm
                    ${dateFilter !== 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Calendar size={16} className={dateFilter !== 'all' ? 'text-blue-500' : 'text-gray-400'} />
                  <span>
                    {dateFilter === 'all' ? 'All Dates' : 
                     dateFilter === 'today' ? 'Today' : 
                     dateFilter === 'week' ? 'Last 7 Days' : 
                     dateFilter === 'month' ? 'Last 30 Days' : 'Custom Range'}
                  </span>
                  <ChevronDown size={14} className="opacity-50" />
                </button>

                {isDateOpen && (
                  <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Filter by Created Date</h4>
                    <select
                      value={dateFilter}
                      onChange={e => {
                        setDateFilter(e.target.value);
                        if (e.target.value !== 'custom') setIsDateOpen(false);
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400 mb-3 text-gray-900"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="custom">Custom Range</option>
                    </select>

                    {dateFilter === 'custom' && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Start Date</label>
                          <input 
                            type="date" 
                            value={customStartDate} 
                            onChange={e => setCustomStartDate(e.target.value)}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-blue-400 text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">End Date</label>
                          <input 
                            type="date" 
                            value={customEndDate} 
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-blue-400 text-gray-900 bg-white"
                          />
                        </div>
                        <div className="col-span-2 mt-1">
                          <button 
                            type="button" 
                            onClick={() => setIsDateOpen(false)} 
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Apply Range
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Separate Status Filter */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsStatusOpen(!isStatusOpen); setIsDateOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border shadow-sm
                    ${statusFilter !== 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Filter size={16} className={statusFilter !== 'all' ? 'text-blue-500' : 'text-gray-400'} />
                  <span>{STATUS_FILTERS.find(s => s.id === statusFilter)?.label || 'All Statuses'}</span>
                  <ChevronDown size={14} className="opacity-50" />
                </button>

                {isStatusOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-2 overflow-hidden flex flex-col max-h-[60vh]">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 shrink-0">Filter by Status</h4>
                    <div className="overflow-y-auto custom-scrollbar flex-1 pb-1">
                      {STATUS_FILTERS.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setStatusFilter(s.id); setIsStatusOpen(false); }}
                          className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors
                            ${statusFilter === s.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          <s.icon size={15} className={statusFilter === s.id ? 'text-blue-500' : 'text-gray-400'} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Desktop table (Strictly contained with horizontal scroll to prevent layout breaks) */}
          <div className="hidden sm:block w-full overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <tr>
                  {PROJECT_TABLE_COLUMNS.map(col => (
                    <th key={col.key} className="px-5 py-4 border-b border-gray-200">{col.label}</th>
                  ))}
                  <th className="px-5 py-4 border-b border-gray-200 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={PROJECT_TABLE_COLUMNS.length + 1} className="px-5 py-16 text-center text-gray-400">
                      <Package size={36} className="mx-auto mb-3 text-gray-200" />
                      <p className="font-medium">No projects found matching the selected filters.</p>
                    </td>
                  </tr>
                ) : filtered.map(project => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors group">
                    {PROJECT_TABLE_COLUMNS.map(col => (
                      <td key={col.key} className="px-5 py-3.5">
                        {col.key === 'status' ? (
                          <StatusBadge status={project.status} />
                        ) : col.key === 'scheduled_date' ? (
                          <span className="text-xs font-semibold text-gray-700">{formatDate(project[col.key])}</span>
                        ) : col.key === 'job_id' ? (
                          <span className="text-xs font-bold text-[#8ED26B] bg-[#f4fcf0] px-2 py-1 rounded-md border border-[#8ED26B]/20">
                            {project.job_id || 'Pending'}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-800">{truncate(project[col.key], 22)}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">

                        {/* VIEW BUTTON */}
                        <button onClick={() => openView(project)} title="View Details" className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors">
                          <Eye size={14} /> View
                        </button>

                        {/* SCHEDULE BUTTON */}
                        {project.status === 'submitted' && (
                          <button onClick={() => openAssign(project)} className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-[#8ED26B]/10 hover:bg-[#8ED26B]/20 text-[#5f9c46] text-xs font-bold transition-colors">
                            <Calendar size={14} /> Schedule
                          </button>
                        )}

                        {/* RESCHEDULE / REASSIGN BUTTON */}
                        {['assigned', 'rejected', 'in_progress', 'snag_reopened'].includes(project.status) && (
                          <button onClick={() => openAssign(project)} className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-colors">
                            {project.status === 'rejected' ? <UserPlus size={14} /> : <CalendarDays size={14} />}
                            {project.status === 'rejected' ? 'Reassign' : 'Reschedule'}
                          </button>
                        )}

                        {project.status === 'awaiting_countertop' && (
                          <button onClick={() => setCountertopTarget(project)} className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors">
                            <CheckSquare size={14} /> Verify Countertop
                          </button>
                        )}

                        {project.status === 'completed' && (
                          <button onClick={() => openSnag(project)} className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors">
                            <RotateCcw size={14} /> Reopen
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards View */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="px-4 py-16 text-center text-gray-400">
                <Package size={36} className="mx-auto mb-3 text-gray-200" />
                <p className="font-medium text-sm">No projects found.</p>
              </div>
            ) : filtered.map(project => (
              <div key={project.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-xs font-bold text-[#8ED26B] mb-1">{project.job_id || 'Pending Validation'}</p>
                    <p className="text-base font-black text-gray-900 truncate">{project.customer_name}</p>
                    <p className="text-xs text-gray-500 font-medium truncate mt-0.5">{project.client} · {project.city}</p>
                  </div>
                  <div className="shrink-0 pt-1">
                     <StatusBadge status={project.status} />
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-gray-100">
                  <button onClick={() => openView(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold transition-colors min-w-[120px]">
                    <Eye size={16} /> View
                  </button>

                  {project.status === 'submitted' && (
                    <button onClick={() => openAssign(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#8ED26B]/10 text-[#5f9c46] text-xs font-bold transition-colors min-w-[120px]">
                      <Calendar size={16} /> Schedule
                    </button>
                  )}

                  {['assigned', 'rejected', 'in_progress', 'snag_reopened'].includes(project.status) && (
                    <button onClick={() => openAssign(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-50 text-orange-700 text-xs font-bold transition-colors min-w-[120px]">
                      {project.status === 'rejected' ? <UserPlus size={16} /> : <CalendarDays size={16} />}
                      {project.status === 'rejected' ? 'Reassign' : 'Reschedule'}
                    </button>
                  )}

                  {project.status === 'awaiting_countertop' && (
                    <button onClick={() => setCountertopTarget(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold transition-colors min-w-[120px]">
                      <CheckSquare size={16} /> Verify
                    </button>
                  )}

                  {project.status === 'completed' && (
                    <button onClick={() => openSnag(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold transition-colors min-w-[120px]">
                      <RotateCcw size={16} /> Reopen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Showing {filtered.length} {filtered.length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ══ SCHEDULE / REASSIGN MODAL ══ */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                {assignTarget.status === 'submitted' ? <><UserCheck size={18} className="text-[#8ED26B]" /> Validate & Assign</> : <><UserPlus size={18} className="text-orange-500" /> Re-assign Team</>}
              </h2>
              <button onClick={() => setAssignTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-600">
                Selecting a team for <span className="font-bold text-gray-900">{assignTarget.customer_name}</span>.
              </p>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Carpenter / Executor</label>
                <select
                  value={assignForm.assigned_executor_id}
                  onChange={e => setAssignForm({ ...assignForm, assigned_executor_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900"
                >
                  <option value="">Select executor...</option>
                  {executors.map(ex => <option key={ex.id} value={ex.id}>{ex.full_name} ({ex.role})</option>)}
                </select>

                {/* Display Executor Details Dynamically */}
                {assignForm.assigned_executor_id && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    {(() => {
                      const selectedEx = executors.find(e => e.id === assignForm.assigned_executor_id);
                      if (!selectedEx) return null;
                      return (
                        <div className="text-xs text-blue-800 space-y-1.5">
                          <p><span className="font-semibold text-blue-900">Name:</span> {selectedEx.full_name}</p>
                          <p><span className="font-semibold text-blue-900">Role:</span> {selectedEx.role}</p>
                          <p><span className="font-semibold text-blue-900">Phone:</span> {selectedEx.phone || 'N/A'}</p>
                          <p><span className="font-semibold text-blue-900">Email:</span> {selectedEx.email || 'N/A'}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Installation Start Date</label>
                <input
                  type="date"
                  value={assignForm.scheduled_date}
                  onChange={e => setAssignForm({ ...assignForm, scheduled_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900"
                />
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 bg-gray-50/50">
              <button onClick={() => setAssignTarget(null)} className="flex-1 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition">
                Cancel
              </button>
              <button
                onClick={submitAssign}
                disabled={assigning || !assignForm.assigned_executor_id}
                className="flex-1 py-2.5 rounded-xl bg-[#8ED26B] text-white text-sm font-bold hover:brightness-95 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {assigning ? (<><Loader2 size={16} className="animate-spin" /> Saving…</>) : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ VERIFY COUNTERTOP MODAL ══ */}
      {countertopTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare size={18} className="text-purple-500" /> Verify Countertop
              </h2>
              <button onClick={() => setCountertopTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto text-purple-600 border border-purple-100">
                <CheckSquare size={24} />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Confirm Verification</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Mark countertop installation as completed for <span className="font-bold text-gray-800">{countertopTarget.job_id}</span>? This will unlock the carpenter app for final sign-off and notify the team.
              </p>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 bg-gray-50/50">
              <button onClick={() => setCountertopTarget(null)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-colors bg-white">
                Cancel
              </button>
              <button
                onClick={submitVerifyCountertop}
                disabled={verifyingCountertop}
                className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {verifyingCountertop ? (<><Loader2 size={16} className="animate-spin" /> Verifying…</>) : 'Yes, Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SNAG / REVISIT MODAL ══ */}
      {snagTarget && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setSnagTarget(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-lg sm:rounded-2xl shadow-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-10 h-10 rounded-full bg-red-50 border border-red-100 items-center justify-center shrink-0">
                  <AlertCircle size={18} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reopen for Snag Visit</p>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 truncate">{snagTarget.job_id}</h2>
                </div>
              </div>
              <button onClick={() => setSnagTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 flex-1">
              {errorMsg && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {errorMsg}
                </div>
              )}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">
                <p className="text-sm text-gray-600">
                  Reopening <span className="font-bold text-gray-900">{snagTarget.customer_name}'s</span> project. This creates a new snag visit linked to the original Job ID and moves the project back into active status.
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-blue-500" /> Reason Type
                  </label>
                  <select
                    value={snagForm.reason}
                    onChange={e => setSnagForm({ ...snagForm, reason: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition bg-gray-50 focus:bg-white text-gray-800"
                  >
                    <option value="Snag">Snag (Defect or Minor Issue)</option>
                    <option value="Complaint">Complaint (Major Issue)</option>
                    <option value="Additional Work">Additional Work Required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <PenLine size={14} className="text-gray-500" /> Remarks
                  </label>
                  <textarea
                    placeholder="Describe the issue or required work in detail..."
                    value={snagForm.remarks}
                    onChange={e => setSnagForm({ ...snagForm, remarks: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition resize-none bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end gap-3 z-20 shrink-0">
              <button onClick={() => setSnagTarget(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 bg-white transition-colors">Cancel</button>
              <button
                onClick={submitSnag}
                disabled={snagSaving || !snagForm.remarks.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {snagSaving ? (<><Loader2 size={16} className="animate-spin" /> Saving…</>) : (<><RotateCcw size={16} /> Reopen</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ VIEW PROJECT DETAILS MODAL ══ */}
      {viewProject && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewProject(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl h-full sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-10 h-10 rounded-full bg-[#f4fcf0] border border-green-100 items-center justify-center shrink-0">
                  <Eye size={18} className="text-[#5aaa3a]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">View Project • {viewProject.job_id || 'Pending assignment'}</p>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 truncate">{viewProject.customer_name || 'N/A'}</h2>
                </div>
              </div>
              <button onClick={() => setViewProject(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 flex-1">

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="col-span-2 lg:col-span-4 border-b border-gray-100 pb-3 mb-1">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><User size={12} className="text-blue-500" /> Customer Information</h3>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Phone</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{viewProject.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Email</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{viewProject.email || '—'}</p>
                </div>
                <div className="col-span-2 lg:col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Address</p>
                  <p className="text-sm font-medium text-gray-600 truncate">{viewProject.address || '—'}, {viewProject.city}, {viewProject.state}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><CalendarDays size={12} className="text-orange-500" /> Project Management</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Current Status</p>
                      <StatusBadge status={viewProject.status} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Submitted Date</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{formatDate(viewProject.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Scheduled Date</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{formatDate(viewProject.scheduled_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Executor ID</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{viewProject.assigned_executor_id || 'Unassigned'}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><FileText size={12} className="text-indigo-500" /> Client Uploaded Documents</h3>
                {viewDocs.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium italic">No documents uploaded by the client.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {viewDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between gap-2.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 hover:bg-gray-100 transition">
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText size={16} className="text-indigo-500 flex-shrink-0" />
                          <span className="truncate capitalize">{doc.doc_type.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors" title="View">
                            <Eye size={14} />
                          </a>
                          <button 
                            onClick={() => handleDownload(doc.file_url, doc.file_url.split('/').pop() || 'document')} 
                            className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors" 
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {viewProject.project_details && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ClipboardList size={12} className="text-teal-500" /> Project Notes / Scope</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{viewProject.project_details}</p>
                </div>
              )}

            </div>
            
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end z-20 shrink-0">
               <button onClick={() => setViewProject(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 bg-white">Close Viewer</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function ModularAdminSchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading module...
      </div>
    }>
      <ModularAdminScheduleContent />
    </Suspense>
  );
}