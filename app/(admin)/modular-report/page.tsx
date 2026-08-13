'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Package, Eye, X, AlertCircle, CheckCircle, Loader2, Calendar,
  List, FileText, Wrench, Hammer, RefreshCcw, UserCheck, ClipboardCheck,
  Lock, RotateCcw, UserPlus, Settings, CheckSquare, UploadCloud, Camera, Clock, MapPin, Mic, Play,
  Hash, User, CalendarDays, PenLine, ImageIcon, Edit, Save, Activity, CheckCircle2, Video, AlertTriangle,
  Filter, ClipboardList, XCircle, ChevronDown
} from 'lucide-react';

// ══════════════════════════════════════════
// Types & constants
// ══════════════════════════════════════════
type StatusFilter = 'all' | 'submitted' | 'assigned' | 'rejected' | 'in_progress' | 'awaiting_countertop' | 'countertop_completed' | 'sign_off' | 'completed' | 'snag_reopened' | 'cancelled';

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'submitted', label: 'Pending', icon: Calendar },
  { id: 'assigned', label: 'Assigned', icon: Wrench },
  { id: 'rejected', label: 'Rejected', icon: AlertTriangle },
  { id: 'in_progress', label: 'In Progress', icon: Hammer },
  { id: 'awaiting_countertop', label: 'Countertop', icon: RefreshCcw },
  { id: 'sign_off', label: 'Sign-off', icon: UserCheck },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'snag_reopened', label: 'Snag / Revisit', icon: AlertCircle },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  submitted: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: '○ pending' },
  assigned: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● Assigned' },
  rejected: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Rejected' },
  in_progress: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● In Progress' },
  awaiting_countertop: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: '⟳ Awaiting Countertop' },
  countertop_completed: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: '⟳ Countertop Done' },
  sign_off: { cls: 'bg-teal-50 text-teal-700 border border-teal-200', label: '✎ Sign-off Pending' },
  completed: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Completed' },
  cancelled: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Cancelled' }, 
  snag_reopened: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Snag / Revisit' },
};

const PROJECT_TABLE_COLUMNS = [
  { label: 'Job ID', key: 'job_id' },
  { label: 'Client', key: 'client' },
  { label: 'Customer', key: 'customer_name' },
  { label: 'City', key: 'city' },
  { label: 'Status', key: 'status' },
  { label: 'Executor', key: 'executor_status' },
  { label: 'Submitted', key: 'created_at' },
  { label: 'Duration', key: 'duration' },
];

// Human-friendly label for status option values (e.g. "in_progress" -> "In Progress")
const statusLabel = (s?: string) => {
  if (!s) return 'N/A';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// ══════════════════════════════════════════
// Inner component
// ══════════════════════════════════════════
function ModularAdminContent() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');

  const [adminData, setAdminData] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);

  // ── Filters State ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [executorFilter, setExecutorFilter] = useState('all');
  
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Dropdown toggles
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Modals Data ──
  const [viewProject, setViewProject] = useState<any>(null);
  const [viewDocs, setViewDocs] = useState<any[]>([]);
  const [viewLogs, setViewLogs] = useState<any[]>([]);   
  const [viewTasks, setViewTasks] = useState<any[]>([]); 
  const [viewSnags, setViewSnags] = useState<any[]>([]); 

  const [closeTarget, setCloseTarget] = useState<any>(null);
  const [closing, setClosing] = useState(false);

  // ── Manage Portal Data (Single Page) ──
  const [manageTarget, setManageTarget] = useState<any>(null);
  const [manageCheckedInToday, setManageCheckedInToday] = useState(false); 
  const [existingCheckin, setExistingCheckin] = useState<any>(null);
  
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingExecAction, setSubmittingExecAction] = useState(false);

  const [adminStatusOverride, setAdminStatusOverride] = useState(''); 
  
  const [manageExecAction, setManageExecAction] = useState('pending');
  const [manageExecReason, setManageExecReason] = useState('');

  const [adminSelfie, setAdminSelfie] = useState<File | null>(null);
  const [adminSitePhoto, setAdminSitePhoto] = useState<File | null>(null);
  
  const [adminTaskCategory, setAdminTaskCategory] = useState('');
  const [adminTaskProductPhotos, setAdminTaskProductPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [adminTaskVideo, setAdminTaskVideo] = useState<File | null>(null);
  const [adminTaskRemarks, setAdminTaskRemarks] = useState('');

  // ── Status override confirmation flow ──
  // stage 'confirm' = "are you sure?" step. stage 'reason' = mandatory reason step.
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    stage: 'confirm' | 'reason';
    fromStatus: string;
    pendingStatus: string;
    reason: string;
    saving: boolean;
  }>({ open: false, stage: 'confirm', fromStatus: '', pendingStatus: '', reason: '', saving: false });

  const closeStatusModal = () => setStatusModal({ open: false, stage: 'confirm', fromStatus: '', pendingStatus: '', reason: '', saving: false });

  // ── Helper: Resolve Storage URLs ──
  const resolveUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path === 'admin_override') return path;
    try {
      return supabase.storage.from('modular-project-docs').getPublicUrl(path).data.publicUrl;
    } catch {
      return path;
    }
  };

  useEffect(() => {
    if (urlStatus && urlStatus !== 'snag_reopened') setStatusFilter(urlStatus as StatusFilter);
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
    }
  }, [authChecked]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('modular_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Fetch error:', error);
      setErrorMsg('Failed to load projects.');
    } else if (data) {
      const cleanedData = data.map(p => ({
        ...p,
        status: p.status === 'handed_to_countertop' ? 'awaiting_countertop' : p.status
      }));
      setProjects(cleanedData);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const getDuration = (startStr: string, endStr: string, status: string) => {
    if (status !== 'completed') return '—';
    if (!startStr || !endStr) return '—';
    
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const diffMs = end - start;
    
    if (diffMs <= 0) return '0 Hrs';
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0 && hours > 0) return `${days} Days, ${hours} Hrs`;
    if (days > 0) return `${days} Days`;
    if (hours > 0) return `${hours} Hrs`;
    return '< 1 Hour';
  };

  const getCheckInOutDuration = (checkInStr: string, checkOutStr: string) => {
    if (!checkInStr || !checkOutStr) return null;

    const start = new Date(checkInStr).getTime();
    const end = new Date(checkOutStr).getTime();
    const diffMs = end - start;

    if (diffMs <= 0) return '0 Hrs';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) return `${hours} Hrs ${minutes} Min`;
    if (hours > 0) return `${hours} Hrs`;
    if (minutes > 0) return `${minutes} Min`;
    return '< 1 Min';
  };

  const getExecutorStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'submitted') return { label: '—', color: 'text-gray-400 bg-gray-50 border border-gray-200' };
    if (s === 'assigned') return { label: 'Pending', color: 'text-amber-700 bg-amber-50 border border-amber-200' };
    if (s === 'rejected') return { label: 'Rejected', color: 'text-red-700 bg-red-50 border border-red-200' };
    return { label: 'Accepted', color: 'text-green-700 bg-green-50 border border-green-200' };
  };

  // ══════════════════════════════════════════
  // Action Handlers
  // ══════════════════════════════════════════

  const openView = async (project: any) => {
    setViewProject(project);
    
    const [docsRes, logsRes, tasksRes, snagsRes] = await Promise.all([
      supabase.from('modular_project_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('modular_daily_logs').select('*').eq('project_id', project.id).order('log_date', { ascending: false }),
      supabase.from('modular_task_updates').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('modular_snag_visits').select('*').eq('project_id', project.id).order('created_at', { ascending: false })
    ]);

    const formattedDocs = (docsRes.data || []).map(d => ({ ...d, file_url: resolveUrl(d.file_url) }));
    const formattedLogs = (logsRes.data || []).map(l => ({ 
      ...l, 
      selfie_url: resolveUrl(l.selfie_url), 
      site_photo_url: resolveUrl(l.site_photo_url) 
    }));
    const formattedTasks = (tasksRes.data || []).map(t => ({ 
      ...t, 
      media_url: resolveUrl(t.media_url), 
      voice_note_url: resolveUrl(t.voice_note_url) 
    }));

    setViewDocs(formattedDocs);
    setViewLogs(formattedLogs);
    setViewTasks(formattedTasks);
    setViewSnags(snagsRes.data || []);
  };

  const openClose = (project: any) => setCloseTarget(project);

  const submitClose = async () => {
    if (!closeTarget?.pm_name) {
      setErrorMsg('PM name and signature must be recorded before closing.');
      return;
    }
    setClosing(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('modular_projects')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', closeTarget.id);
      if (error) throw error;

      showSuccess('Project closed and marked Completed.');
      setCloseTarget(null);
      fetchProjects();
    } catch (error: any) {
      setErrorMsg('Error closing project: ' + error.message);
    } finally {
      setClosing(false);
    }
  };

  // ── Manage Portal Single Page Handlers ──
  const openManage = async (project: any) => {
    setManageTarget(project);
    setAdminStatusOverride(project.status);
    setErrorMsg('');
    
    // Executor Action override state
    if (project.status === 'assigned') setManageExecAction('pending');
    else if (project.status === 'rejected') setManageExecAction('rejected');
    else if (project.status !== 'submitted') setManageExecAction('accepted');
    else setManageExecAction('');
    setManageExecReason(project.rejection_reason || '');

    setManageCheckedInToday(false);
    setExistingCheckin(null);
    closeStatusModal();

    const todayStr = new Date().toISOString().split('T')[0];
    const { data: todayLog } = await supabase
      .from('modular_daily_logs')
      .select('*')
      .eq('project_id', project.id)
      .eq('log_date', todayStr)
      .limit(1)
      .maybeSingle();
      
    if (todayLog) {
      setManageCheckedInToday(true);
      setExistingCheckin({
        ...todayLog,
        selfie_url: resolveUrl(todayLog.selfie_url),
        site_photo_url: resolveUrl(todayLog.site_photo_url)
      });
    }
  };

  // Force Update button now opens the confirm step instead of saving directly.
  const requestStatusOverride = () => {
    if (!adminStatusOverride || adminStatusOverride === manageTarget.status) {
      setErrorMsg('Select a different status before updating.');
      return;
    }
    setErrorMsg('');
    setStatusModal({
      open: true,
      stage: 'confirm',
      fromStatus: manageTarget.status,
      pendingStatus: adminStatusOverride,
      reason: '',
      saving: false
    });
  };

  const confirmStatusOverride = () => {
    setStatusModal(prev => ({ ...prev, stage: 'reason' }));
  };

  // Does the actual write, now requiring and persisting a reason.
  const submitStatusOverride = async (reason: string) => {
    setSubmittingStatus(true);
    setErrorMsg('');
    try {
      const updatePayload: any = {
        status: statusModal.pendingStatus,
        updated_at: new Date().toISOString(),
        status_reason: reason,
        status_updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('modular_projects')
        .update(updatePayload)
        .eq('id', manageTarget.id);
      if (error) throw error;
      showSuccess(`Project status manually overridden to ${statusLabel(statusModal.pendingStatus)}.`);
      fetchProjects();
      setManageTarget((prev: any) => ({ ...prev, ...updatePayload }));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const submitStatusModalReason = async () => {
    if (!statusModal.reason.trim()) return;
    setStatusModal(prev => ({ ...prev, saving: true }));
    await submitStatusOverride(statusModal.reason.trim());
    closeStatusModal();
  };

  const submitExecutorAction = async () => {
    setSubmittingExecAction(true);
    setErrorMsg('');
    try {
      let newStatus = manageTarget.status;
      let reason = manageExecReason;

      if (manageExecAction === 'pending') {
        newStatus = 'assigned';
        reason = '';
      } else if (manageExecAction === 'accepted') {
        newStatus = 'in_progress';
        reason = '';
      } else if (manageExecAction === 'rejected') {
        newStatus = 'rejected';
        if (!reason.trim()) throw new Error("Please provide a rejection reason.");
      }

      const { error } = await supabase.from('modular_projects').update({
        status: newStatus,
        rejection_reason: reason || null,
        updated_at: new Date().toISOString()
      }).eq('id', manageTarget.id);

      if (error) throw error;
      showSuccess('Executor status updated successfully.');
      fetchProjects();
      setManageTarget({ ...manageTarget, status: newStatus, rejection_reason: reason });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating executor action.');
    } finally {
      setSubmittingExecAction(false);
    }
  };

  const submitCheckin = async () => {
    if (!adminSelfie || !adminSitePhoto) {
      setErrorMsg('Both Selfie and Site Photo are required for Check-in.');
      return;
    }
    setSubmittingCheckin(true);
    setErrorMsg('');
    try {
      const selfiePath = `${manageTarget.id}/admin-upload-selfie-${Date.now()}.jpg`;
      const sitePath = `${manageTarget.id}/admin-upload-site-${Date.now()}.jpg`;
      await supabase.storage.from('modular-project-docs').upload(selfiePath, adminSelfie);
      await supabase.storage.from('modular-project-docs').upload(sitePath, adminSitePhoto);
      
      const selfieUrl = supabase.storage.from('modular-project-docs').getPublicUrl(selfiePath).data.publicUrl;
      const siteUrl = supabase.storage.from('modular-project-docs').getPublicUrl(sitePath).data.publicUrl;

      const { error } = await supabase.from('modular_daily_logs').insert({
        project_id: manageTarget.id,
        executor_id: manageTarget.assigned_executor_id || manageTarget.supervisor_id,
        log_date: new Date().toISOString().split('T')[0],
        check_in_time: new Date().toISOString(),
        selfie_url: selfieUrl,
        site_photo_url: siteUrl,
      });
      if (error) throw error;

      if (manageTarget.status === 'assigned') {
          await supabase.from('modular_projects').update({ status: 'in_progress' }).eq('id', manageTarget.id);
      }
      showSuccess('Check-in photos uploaded successfully.');
      
      setExistingCheckin({ selfie_url: selfieUrl, site_photo_url: siteUrl });
      setManageCheckedInToday(true);
      setAdminSelfie(null);
      setAdminSitePhoto(null);
      fetchProjects();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading check-in.');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  // Multiple Product Photos Implementation
  const handleAdminProductPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setAdminTaskProductPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removeAdminProductPhoto = (index: number) => {
    setAdminTaskProductPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submitTask = async () => {
    if (!adminTaskCategory || adminTaskProductPhotos.length < 2 || !adminTaskVideo) {
      setErrorMsg('Category, at least 2 Product Photos, and Site Video are required to manually upload a task.');
      return;
    }
    setSubmittingTask(true);
    setErrorMsg('');
    try {
      let logId = null;
      const { data: logs } = await supabase.from('modular_daily_logs').select('id').eq('project_id', manageTarget.id).order('created_at', { ascending: false }).limit(1);
      if (logs && logs.length > 0) {
        logId = logs[0].id;
      } else {
        const { data: newLog } = await supabase.from('modular_daily_logs').insert({
          project_id: manageTarget.id,
          executor_id: manageTarget.assigned_executor_id || manageTarget.supervisor_id,
          log_date: new Date().toISOString().split('T')[0],
          selfie_url: 'admin_override',
          site_photo_url: 'admin_override'
        }).select().single();
        if (newLog) logId = newLog.id;
      }

      const productPhotoUrls: string[] = [];
      for (const photo of adminTaskProductPhotos) {
        const photoPath = `${manageTarget.id}/admin-task-product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        await supabase.storage.from('modular-project-docs').upload(photoPath, photo.file);
        const photoUrl = supabase.storage.from('modular-project-docs').getPublicUrl(photoPath).data.publicUrl;
        productPhotoUrls.push(photoUrl);
      }

      const videoExt = adminTaskVideo.name.split('.').pop();
      const videoPath = `${manageTarget.id}/admin-task-video-${Date.now()}.${videoExt}`;
      await supabase.storage.from('modular-project-docs').upload(videoPath, adminTaskVideo);
      const videoUrl = supabase.storage.from('modular-project-docs').getPublicUrl(videoPath).data.publicUrl;

      const formattedRemarks = `[Uploaded by Admin] [ProductPhotos: ${productPhotoUrls.join('|')}] ${adminTaskRemarks.trim()}`;

      const { error } = await supabase.from('modular_task_updates').insert({
        project_id: manageTarget.id,
        daily_log_id: logId,
        category: adminTaskCategory,
        media_url: videoUrl,
        media_type: adminTaskVideo.type.includes('video') ? 'video' : 'image',
        remarks: formattedRemarks
      });

      if (error) throw error;
      showSuccess('Task uploaded successfully.');
      setAdminTaskCategory('');
      setAdminTaskProductPhotos([]);
      setAdminTaskVideo(null);
      setAdminTaskRemarks('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading task.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // ══════════════════════════════════════════
  // Filters & Formatting
  // ══════════════════════════════════════════
  const filtered = projects.filter(p => {
    // 1. Search filter
    const matchesSearch =
      p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.job_id?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase());
    
    // 2. Status filter
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    // 3. Executor Response Filter
    let matchesExecutor = true;
    if (executorFilter !== 'all') {
       if (executorFilter === 'pending') matchesExecutor = p.status === 'assigned';
       else if (executorFilter === 'rejected') matchesExecutor = p.status === 'rejected';
       else if (executorFilter === 'accepted') matchesExecutor = !['submitted', 'assigned', 'rejected'].includes(p.status);
       else if (executorFilter === 'unassigned') matchesExecutor = p.status === 'submitted';
    }

    // 4. Custom Date Filter (Matches the Dropdown implementation)
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

    return matchesSearch && matchesStatus && matchesExecutor && matchesDate;
  });

  const submittedCount = projects.filter(p => p.status === 'submitted').length;
  const activeCount = projects.filter(p => !['completed', 'submitted'].includes(p.status)).length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_BADGE[status] ?? STATUS_BADGE['submitted'];
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

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    return `${formatDate(isoString)} at ${formatTime(isoString)}`;
  };

  if (!authChecked) return <Loader2 className="animate-spin mx-auto mt-20 text-[#8ED26B]" size={40} />;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-16">
      
      {/* Click-away backdrop for dropdowns */}
      {(isStatusOpen || isDateOpen) && (
        <div className="fixed inset-0 z-30" onClick={() => { setIsStatusOpen(false); setIsDateOpen(false); }} />
      )}

      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Modular Interior Installation — Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Validate projects, assign teams, and track progress to close-out</p>
        </div>

        {successMsg && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
            <CheckCircle size={16} className="flex-shrink-0" /> {successMsg}
          </div>
        )}
        {errorMsg && !manageTarget && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Stats */}
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
          
          {/* Main Controls Header with nice dropdowns */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-200 p-4 gap-4 bg-white relative z-40">
            
            {/* Search Input */}
            <div className="relative w-full lg:max-w-xs flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search Job ID, client, customer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 focus:bg-white transition-all text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 relative z-50">
              
              {/* Executor Dropdown */}
              <select 
                value={executorFilter} 
                onChange={(e) => setExecutorFilter(e.target.value)} 
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition-all text-gray-900 shadow-sm shrink-0"
              >
                <option value="all">All Executors</option>
                <option value="unassigned">Not Assigned</option>
                <option value="pending">Pending Accept</option>
                <option value="accepted">Accepted / Working</option>
                <option value="rejected">Rejected</option>
              </select>

              {/* Separate Date Filter Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsDateOpen(!isDateOpen); setIsStatusOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border shadow-sm
                    ${dateFilter !== 'all' ? 'bg-[#8ED26B]/10 border-[#8ED26B]/30 text-[#5f9c46]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Calendar size={16} className={dateFilter !== 'all' ? 'text-[#8ED26B]' : 'text-gray-400'} />
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
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-[#8ED26B] mb-3 text-gray-900"
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
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-[#8ED26B] text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">End Date</label>
                          <input 
                            type="date" 
                            value={customEndDate} 
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-[#8ED26B] text-gray-900 bg-white"
                          />
                        </div>
                        <div className="col-span-2 mt-1">
                          <button 
                            type="button" 
                            onClick={() => setIsDateOpen(false)} 
                            className="w-full py-2 bg-[#8ED26B] hover:brightness-95 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Apply Range
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Separate Status Filter Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsStatusOpen(!isStatusOpen); setIsDateOpen(false); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border shadow-sm
                    ${statusFilter !== 'all' ? 'bg-[#8ED26B]/10 border-[#8ED26B]/30 text-[#5f9c46]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Filter size={16} className={statusFilter !== 'all' ? 'text-[#8ED26B]' : 'text-gray-400'} />
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
                            ${statusFilter === s.id ? 'bg-[#8ED26B]/10 text-[#5f9c46]' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          <s.icon size={15} className={statusFilter === s.id ? 'text-[#8ED26B]' : 'text-gray-400'} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">
                <tr>
                  {PROJECT_TABLE_COLUMNS.map(col => (
                    <th key={col.key} className="px-4 py-3 border-b border-gray-200 whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="px-4 py-3 border-b border-gray-200 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={PROJECT_TABLE_COLUMNS.length + 1} className="px-5 py-16 text-center text-gray-400">
                      <Package size={36} className="mx-auto mb-3 text-gray-200" />
                      <p className="font-medium">No projects found</p>
                    </td>
                  </tr>
                ) : filtered.map(project => (
                  <tr key={project.id} className="hover:bg-gray-50/70 transition-colors">
                    {PROJECT_TABLE_COLUMNS.map(col => (
                      <td key={col.key} className="px-4 py-3">
                        {col.key === 'status' ? (
                          <StatusBadge status={project.status} />
                        ) : col.key === 'executor_status' ? (
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${getExecutorStatus(project.status).color}`}>
                            {getExecutorStatus(project.status).label}
                          </span>
                        ) : col.key === 'created_at' ? (
                          <span className="text-xs text-gray-700">{formatDate(project[col.key])}</span>
                        ) : col.key === 'job_id' ? (
                          <span className="text-xs font-bold text-gray-700">{project.job_id || 'Pending'}</span>
                        ) : col.key === 'duration' ? (
                          <span className="text-xs font-bold text-gray-700">{getDuration(project.created_at, project.updated_at, project.status)}</span>
                        ) : (
                          <span className="text-xs text-gray-700 block truncate">{truncate(project[col.key])}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">

                        {project.status === 'sign_off' && (
                          <button onClick={() => openClose(project)} className="px-2.5 h-8 flex items-center gap-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition">
                            <Lock size={13} /> Close
                          </button>
                        )}

                        <button onClick={() => openView(project)} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
                          <Eye size={13} /> View
                        </button>
                        
                        {project.status !== 'submitted' && (
                          <button onClick={() => openManage(project)} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-gray-900 border border-gray-900 text-white hover:bg-gray-800 transition whitespace-nowrap">
                            <Settings size={13} /> Manage
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="px-4 py-16 text-center text-gray-400">
                <Package size={36} className="mx-auto mb-3 text-gray-200" />
                <p className="font-medium">No projects found</p>
              </div>
            ) : filtered.map(project => (
              <div key={project.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#8ED26B]">{project.job_id || 'Pending'}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{project.customer_name}</p>
                    <p className="text-xs text-gray-500 truncate">{project.client} · {project.city}</p>
                    
                    {project.status === 'completed' && (
                      <div className="mt-2 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md inline-flex items-center gap-1">
                        <Clock size={10} /> Completed in: {getDuration(project.created_at, project.updated_at, project.status)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={project.status} />
                    {project.status !== 'submitted' && (
                      <span className={`px-2 py-1 rounded-md text-[9px] font-bold border ${getExecutorStatus(project.status).color}`}>
                          Exec: {getExecutorStatus(project.status).label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">

                  {project.status === 'sign_off' && (
                    <button onClick={() => openClose(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold transition">
                      <Lock size={14} /> Close
                    </button>
                  )}
                  
                  <div className="w-full flex gap-2 pt-1 border-t border-gray-100 mt-2">
                    <button onClick={() => openView(project)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                      <Eye size={14} /> View
                    </button>
                    
                    {project.status !== 'submitted' && (
                      <button onClick={() => openManage(project)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-gray-900 border border-gray-900 text-white hover:bg-gray-800 transition">
                        <Settings size={14} /> Manage
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="px-4 sm:px-5 py-3 border-t border-gray-100 text-xs text-gray-400 font-medium">
              Showing {filtered.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ══ MODALS: VIEW DETAILS ══ */}
      {/* ══════════════════════════════════════════ */}
      {viewProject && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewProject(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-5xl sm:rounded-2xl shadow-2xl h-full sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
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
              
              {/* Rejection Alert Banner (if executor rejected) */}
              {viewProject.status === 'rejected' && viewProject.rejection_reason && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm flex items-start gap-3">
                   <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                   <div>
                     <h4 className="text-sm font-bold text-red-800">Project Rejected by Executor</h4>
                     <p className="text-sm text-red-600 mt-1 font-medium">{viewProject.rejection_reason}</p>
                   </div>
                </div>
              )}

              {/* Quick Facts Grid */}
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

              {/* Management & Status Details */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><CalendarDays size={12} className="text-orange-500" /> Project Management</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Current Status</p>
                      <StatusBadge status={viewProject.status} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Executor Action</p>
                      <p className="text-sm font-bold break-all">
                        {viewProject.status === 'assigned' ? <span className="text-amber-600 font-extrabold">Pending Accept</span> : 
                         viewProject.status === 'rejected' ? <span className="text-red-600 font-extrabold">Rejected</span> : 
                         viewProject.status === 'submitted' ? <span className="text-gray-400">—</span> :
                         <span className="text-green-600 font-extrabold">Accepted</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Scheduled Date</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{formatDate(viewProject.scheduled_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Executor ID</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{viewProject.assigned_executor_id || 'Unassigned'}</p>
                    </div>
                    {viewProject.status === 'completed' && (
                      <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                        <p className="text-[10px] text-emerald-600 font-bold uppercase mb-0.5">Time Taken</p>
                        <p className="text-sm font-black text-emerald-700 break-all">{getDuration(viewProject.created_at, viewProject.updated_at, viewProject.status)}</p>
                      </div>
                    )}
                 </div>

                 {/* Last Status Change (admin override reason) */}
                 {viewProject.status_reason && (
                   <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
                     <div className="flex items-center justify-between mb-2">
                       <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
                         <AlertCircle size={12} /> Last Admin Override
                       </p>
                       {viewProject.status_updated_at && (
                         <span className="text-[10px] font-bold text-amber-600 shrink-0">{formatDateTime(viewProject.status_updated_at)}</span>
                       )}
                     </div>
                     <div className="flex flex-wrap items-center gap-2 mb-2">
                       <span className="text-xs text-amber-800 font-medium">Status manually set to:</span>
                       <span className="px-2 py-1 bg-white border border-amber-200 text-amber-900 text-[10px] font-black uppercase rounded shadow-sm">
                         {statusLabel(viewProject.status)}
                       </span>
                     </div>
                     <div className="bg-white/60 p-3 rounded-lg border border-amber-100">
                       <p className="text-sm text-amber-900 font-medium">
                         <span className="font-bold text-amber-700 block mb-0.5 text-xs">Reason provided:</span>
                         {viewProject.status_reason}
                       </p>
                     </div>
                   </div>
                 )}
                 
                 {/* Signatures displayed neatly side-by-side if they exist */}
                 {(viewProject.pm_signature_url || viewProject.customer_ack_signature_url) && (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
                     {viewProject.pm_signature_url && (
                       <div>
                         <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5"><PenLine size={12} className="text-gray-500" /> PM Signature</p>
                         <img src={resolveUrl(viewProject.pm_signature_url)} alt="PM Signature" className="h-24 w-full bg-gray-50 border border-gray-200 rounded-lg p-2 object-contain mix-blend-multiply" />
                       </div>
                     )}
                     {viewProject.customer_ack_signature_url && (
                       <div>
                         <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5"><PenLine size={12} className="text-gray-500" /> Customer Acknowledgement</p>
                         <img src={resolveUrl(viewProject.customer_ack_signature_url)} alt="Customer Signature" className="h-24 w-full bg-gray-50 border border-gray-200 rounded-lg p-2 object-contain mix-blend-multiply" />
                       </div>
                     )}
                   </div>
                 )}
              </div>

              {/* Uploaded Documents */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><FileText size={12} className="text-indigo-500" /> Client Uploaded Documents</h3>
                {viewDocs.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium italic">No documents uploaded by the client.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {viewDocs.map(doc => (
                      <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 hover:bg-gray-100 transition truncate">
                        <FileText size={16} className="text-indigo-500 flex-shrink-0" />
                        <span className="truncate capitalize">{doc.doc_type.replace(/_/g, ' ')}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily Check-in Logs */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Clock size={12} className="text-teal-500" /> Daily Check-in Logs</h3>
                {viewLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium italic">No active work logs recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {viewLogs.map(log => (
                      <div key={log.id} className="flex flex-col sm:flex-row gap-4 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-black text-gray-900 mb-2">{formatDate(log.log_date)}</p>
                           <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                              <span className="flex items-center gap-2"><Clock size={12} className="text-green-500"/> Check-in: <span className="font-bold text-gray-800">{formatTime(log.check_in_time)}</span></span>
                              <span className="flex items-center gap-2"><Clock size={12} className={log.check_out_time ? 'text-gray-500' : 'text-amber-500'}/> Check-out: <span className="font-bold text-gray-800">{log.check_out_time ? formatTime(log.check_out_time) : 'Working...'}</span></span>
                           </div>
                           {log.check_out_time ? (
                             <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-md w-max">
                               <Clock size={10} /> Duration: {getCheckInOutDuration(log.check_in_time, log.check_out_time)}
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md w-max">
                               <Clock size={10} /> Still checked in
                             </span>
                           )}
                           {(log.gps_latitude && log.gps_longitude) && (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${log.gps_latitude},${log.gps_longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors px-2.5 py-1.5 rounded-lg border border-blue-100">
                                <MapPin size={10} /> View GPS Location
                              </a>
                           )}
                         </div>
                         <div className="flex gap-2 shrink-0 border-l border-gray-200 pl-4">
                           {log.selfie_url && log.selfie_url !== 'admin_override' && (
                             <a href={log.selfie_url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:opacity-80 transition-opacity">
                               <img src={log.selfie_url} alt="Selfie" className="w-full h-full object-cover" />
                               <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-[8px] text-white text-center font-bold py-0.5">Selfie</div>
                             </a>
                           )}
                           {log.site_photo_url && log.site_photo_url !== 'admin_override' && (
                             <a href={log.site_photo_url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:opacity-80 transition-opacity">
                               <img src={log.site_photo_url} alt="Site" className="w-full h-full object-cover" />
                               <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-[8px] text-white text-center font-bold py-0.5">Site</div>
                             </a>
                           )}
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Execution Task Updates */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><ImageIcon size={12} className="text-purple-500" /> Execution Task Updates</h3>
                {viewTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium italic">No tasks recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {viewTasks.map(task => {
                      // Prefer the new multi-photo "ProductPhotos" format written by the
                      // carpenter execution page; fall back to the older single-photo
                      // "Selfie" format (still used by the admin's own manual task
                      // upload above, and by any tasks submitted before this change).
                      const productPhotosMatch = task.remarks ? task.remarks.match(/\[ProductPhotos:\s*(.*?)\]/) : null;
                      const legacySelfieMatch = task.remarks ? task.remarks.match(/\[Selfie:\s*(.*?)\]/) : null;
                      const taskPhotoUrls = productPhotosMatch
                        ? productPhotosMatch[1].split('|').filter(Boolean)
                        : (legacySelfieMatch ? [legacySelfieMatch[1]] : []);
                      const cleanRemarks = task.remarks
                        ? task.remarks.replace(/\[ProductPhotos:\s*.*?\]\s*/g, '').replace(/\[Selfie:\s*.*?\]\s*/g, '').trim()
                        : 'No remarks';

                      return (
                        <div key={task.id} className="flex gap-4 border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                           <div className="flex gap-1.5 shrink-0 flex-wrap max-w-[6.5rem]">
                             {taskPhotoUrls.map((url: string, idx: number) => (
                               <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-black relative hover:opacity-90 transition-opacity">
                                 <img src={url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                                 <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-[8px] text-white text-center font-bold py-[1px]">Photo</div>
                               </a>
                             ))}
                             {task.media_url && (
                               <a href={task.media_url} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-black relative hover:opacity-90 transition-opacity">
                                  {task.media_type === 'video' ? (
                                     <video src={task.media_url} className="w-full h-full object-cover opacity-80" />
                                  ) : (
                                     <img src={task.media_url} alt="Site" className="w-full h-full object-cover" />
                                  )}
                                  {task.media_type === 'video' && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-md shadow-sm"><Play size={10} className="text-white fill-white" /></div></div>}
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-[8px] text-white text-center font-bold py-[1px]">Site</div>
                               </a>
                             )}
                           </div>
                           
                           <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                             <p className="text-xs font-black text-gray-900 truncate">{task.category}</p>
                             <p className="text-[10px] font-bold text-gray-500 mt-0.5">{formatDate(task.created_at)}</p>
                             {cleanRemarks && <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-snug">{cleanRemarks}</p>}
                             {task.voice_note_url && (
                               <a href={task.voice_note_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold text-green-700 bg-green-50 hover:green-100 border border-green-200 px-2.5 py-1 rounded-md w-max transition-colors">
                                  <Mic size={12} /> Play Voice
                               </a>
                             )}
                           </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Snags History */}
              {viewSnags.length > 0 && (
                <div className="bg-red-50/50 p-5 rounded-xl border border-red-100 shadow-sm">
                  <h3 className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Snag / Revisit History
                  </h3>
                  <div className="space-y-3">
                    {viewSnags.map(snag => (
                      <div key={snag.id} className="bg-white border border-red-100 rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-black text-gray-900">{snag.snag_visit_id}</p>
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{formatDate(snag.created_at)}</span>
                        </div>
                        <p className="text-xs font-bold text-red-600 mb-1.5 flex items-center gap-1.5">Reason: {snag.reason}</p>
                        <p className="text-xs font-medium text-gray-700 bg-red-50 p-2.5 rounded-md border border-red-50">{snag.remarks || 'No additional remarks provided.'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Scope / Client Notes */}
              {viewProject.project_details && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ClipboardList size={12} className="text-teal-500" /> Project Notes / Scope</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{viewProject.project_details}</p>
                </div>
              )}

            </div>
            
            {/* Sticky bottom close */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end z-20 shrink-0">
               <button onClick={() => setViewProject(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 bg-white">Close Viewer</button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ══ MODALS: ADMIN MANAGE WORKSPACE (SINGLE PAGE) ══ */}
      {/* ══════════════════════════════════════════ */}
      {manageTarget && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setManageTarget(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl h-full sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-10 h-10 rounded-full bg-[#f4fcf0] border border-green-100 items-center justify-center shrink-0">
                  <Edit size={18} className="text-[#5aaa3a]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Manage Workspace • {manageTarget.job_id || 'Pending'}</p>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 truncate">{manageTarget.customer_name || 'N/A'}</h2>
                </div>
              </div>
              <button onClick={() => setManageTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>

            {errorMsg && (
              <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold shrink-0">
                <AlertCircle size={16} className="flex-shrink-0" /> {errorMsg}
              </div>
            )}

            {manageTarget.status === 'completed' && (
              <div className="mx-4 sm:mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl shrink-0">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Job Completed</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">
                    All necessary tasks for this project have been completed and closed out.
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-6 space-y-6 flex-1">

               {/* SECTION 1: STATUS OVERRIDE */}
               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                   <Package size={14} className="text-orange-500" /> Update Project Status
                 </h3>
                 <p className="text-[11px] text-gray-400 mb-5">Manually override and force the project status to a new state if needed.</p>
                 
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                   <select 
                     value={adminStatusOverride} 
                     onChange={e => setAdminStatusOverride(e.target.value)} 
                     className="flex-1 px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm font-bold focus:border-[#8ED26B] focus:bg-white outline-none transition-all uppercase tracking-wide text-gray-900"
                   >
                     <option value="submitted">Pending</option>
                     <option value="assigned">Assigned</option>
                     <option value="in_progress">Installation (In Progress)</option>
                     <option value="awaiting_countertop">Awaiting Countertop</option>
                     <option value="countertop_completed">Countertop Done</option>
                     <option value="sign_off">Sign-off Pending</option>
                     <option value="completed">Completed</option>
                     <option value="cancelled">Cancelled</option>
                   </select>
                   <button
                     onClick={requestStatusOverride}
                     disabled={submittingStatus}
                     className="px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60 flex items-center justify-center gap-2 shrink-0"
                   >
                     {submittingStatus ? (<><Loader2 size={15} className="animate-spin" /> Updating…</>) : (<><Save size={15} /> Force Update</>)}
                   </button>
                 </div>

                 {/* Last Status Change Card */}
                 {manageTarget.status_reason && (
                   <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
                     <div className="flex items-center justify-between mb-2">
                       <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
                         <AlertCircle size={12} /> Last Admin Override
                       </p>
                       {manageTarget.status_updated_at && (
                         <span className="text-[10px] font-bold text-amber-600 shrink-0">{formatDateTime(manageTarget.status_updated_at)}</span>
                       )}
                     </div>
                     <div className="flex flex-wrap items-center gap-2 mb-2">
                       <span className="text-xs text-amber-800 font-medium">Status manually set to:</span>
                       <span className="px-2 py-1 bg-white border border-amber-200 text-amber-900 text-[10px] font-black uppercase rounded shadow-sm">
                         {statusLabel(manageTarget.status)}
                       </span>
                     </div>
                     <div className="bg-white/60 p-3 rounded-lg border border-amber-100">
                       <p className="text-sm text-amber-900 font-medium">
                         <span className="font-bold text-amber-700 block mb-0.5 text-xs">Reason provided:</span>
                         {manageTarget.status_reason}
                       </p>
                     </div>
                   </div>
                 )}
               </div>

               {/* SECTION 1.5: EXECUTOR ACTION OVERRIDE */}
               {manageTarget.status !== 'submitted' && (
                 <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                     <User size={14} className="text-blue-500" /> Executor Action Override
                   </h3>
                   <p className="text-[11px] text-gray-400 mb-5">Force the executor's acceptance or rejection manually.</p>
                   
                   <div className="space-y-3">
                     <select
                       value={manageExecAction}
                       onChange={e => { setManageExecAction(e.target.value); setErrorMsg(''); }}
                       className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm font-bold focus:border-blue-400 focus:bg-white outline-none transition-all text-gray-900"
                     >
                       <option value="pending">Pending Accept (Set to Assigned)</option>
                       <option value="accepted">Accepted (Start Job / In Progress)</option>
                       <option value="rejected">Rejected</option>
                     </select>
                     
                     {manageExecAction === 'rejected' && (
                       <textarea
                         value={manageExecReason}
                         onChange={e => setManageExecReason(e.target.value)}
                         placeholder="Reason for rejection..."
                         rows={2}
                         className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:border-red-400 focus:bg-white outline-none resize-none transition-all text-gray-900 placeholder-gray-400"
                       />
                     )}
                     
                     <button
                       onClick={submitExecutorAction}
                       disabled={submittingExecAction || (manageExecAction === 'rejected' && !manageExecReason.trim())}
                       className="w-full py-2.5 rounded-xl text-white text-sm font-bold bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                     >
                       {submittingExecAction ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Executor Action
                     </button>
                   </div>
                 </div>
               )}

               {/* SECTION 2: MANUAL CHECK-IN */}
               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                   <MapPin size={14} className="text-[#8ED26B]" /> Manual Check-in
                 </h3>
                 <p className="text-[11px] text-gray-400 mb-4">Upload morning check-in proofs manually on behalf of the executor.</p>
                 
                 {manageCheckedInToday && existingCheckin && (
                   <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
                     <p className="text-xs font-bold text-green-700 mb-3 flex items-center gap-1.5"><CheckCircle2 size={14}/> Already checked in today</p>
                     <div className="flex gap-4">
                        {existingCheckin.selfie_url && existingCheckin.selfie_url !== 'admin_override' && (
                          <div className="flex flex-col gap-1.5">
                            <a href={existingCheckin.selfie_url} target="_blank" rel="noopener noreferrer">
                              <img src={existingCheckin.selfie_url} className="w-16 h-16 rounded-lg object-cover border border-green-200 shadow-sm hover:opacity-80 transition-opacity" />
                            </a>
                            <span className="text-[9px] font-bold text-green-700 text-center uppercase">Selfie</span>
                          </div>
                        )}
                        {existingCheckin.site_photo_url && existingCheckin.site_photo_url !== 'admin_override' && (
                          <div className="flex flex-col gap-1.5">
                            <a href={existingCheckin.site_photo_url} target="_blank" rel="noopener noreferrer">
                              <img src={existingCheckin.site_photo_url} className="w-16 h-16 rounded-lg object-cover border border-green-200 shadow-sm hover:opacity-80 transition-opacity" />
                            </a>
                            <span className="text-[9px] font-bold text-green-700 text-center uppercase">Site</span>
                          </div>
                        )}
                     </div>
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Selfie Photo</label>
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#8ED26B] hover:bg-[#f4fcf0]/50 overflow-hidden relative bg-gray-50 transition-colors">
                        {adminSelfie ? (
                          <img src={URL.createObjectURL(adminSelfie)} alt="Selfie" className="w-full h-full object-cover" />
                        ) : (
                          <><Camera size={24} className="text-gray-400 mb-2" /><span className="text-[10px] text-gray-500 font-bold">Select File</span></>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => setAdminSelfie(e.target.files?.[0] || null)} className="hidden" />
                      </label>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Site Photo</label>
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#8ED26B] hover:bg-[#f4fcf0]/50 overflow-hidden relative bg-gray-50 transition-colors">
                        {adminSitePhoto ? (
                          <img src={URL.createObjectURL(adminSitePhoto)} alt="Site" className="w-full h-full object-cover" />
                        ) : (
                          <><Hammer size={24} className="text-gray-400 mb-2" /><span className="text-[10px] text-gray-500 font-bold">Select File</span></>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => setAdminSitePhoto(e.target.files?.[0] || null)} className="hidden" />
                      </label>
                    </div>
                 </div>
                 <button
                   onClick={submitCheckin}
                   disabled={submittingCheckin || !adminSelfie || !adminSitePhoto}
                   className="w-full py-3 rounded-xl text-white text-sm font-bold bg-[#8ED26B] hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
                 >
                   {submittingCheckin ? (<><Loader2 size={16} className="animate-spin" /> Uploading Check-in…</>) : (<><UploadCloud size={16} /> Upload Check-in</>)}
                 </button>
               </div>

               {/* SECTION 3: UPLOAD TASK */}
               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                   <ImageIcon size={14} className="text-purple-500" /> Upload Task Execution
                 </h3>
                 <p className="text-[11px] text-gray-400 mb-5">Upload a specific task update manually with photos or videos.</p>
                 
                 <div className="space-y-4 mb-5">
                   <div>
                     <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Task Category</label>
                     <select 
                       value={adminTaskCategory} 
                       onChange={e => setAdminTaskCategory(e.target.value)} 
                       className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm font-semibold focus:border-blue-400 focus:bg-white outline-none transition-all text-gray-900"
                     >
                       <option value="" disabled>Select task category...</option>
                       <option value="Site Preparation">Site Preparation</option>
                       <option value="Kitchen Carcass Installation">Kitchen Carcass Installation</option>
                       <option value="Furniture Installation">Furniture Installation</option>
                       <option value="Wall Panels">Wall Panels</option>
                       <option value="Other">Other / General</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                       Product Photos (Min 2) * {adminTaskProductPhotos.length > 0 && `— ${adminTaskProductPhotos.length} selected`}
                     </label>
                     <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                       {adminTaskProductPhotos.map((photo, idx) => (
                         <div key={idx} className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200">
                           <img src={photo.preview} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                           <button
                             type="button"
                             onClick={() => removeAdminProductPhoto(idx)}
                             className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                           >
                             <X size={12} />
                           </button>
                         </div>
                       ))}
                       <label className="relative border-2 border-dashed border-gray-300 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors group">
                         <Camera size={18} className="text-gray-400 group-hover:text-blue-500 mb-1" />
                         <span className="text-[9px] font-bold text-gray-500 group-hover:text-blue-600 text-center px-1">Add Product Photos</span>
                         <input type="file" accept="image/*" multiple onChange={handleAdminProductPhotosChange} className="hidden" />
                       </label>
                     </div>
                     {adminTaskProductPhotos.length > 0 && adminTaskProductPhotos.length < 2 && (
                       <p className="text-[10px] text-red-400 font-bold mt-1.5">At least 2 photos required</p>
                     )}
                   </div>

                   <div>
                     <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Site Video *</label>
                     <label className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 h-28 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors overflow-hidden group">
                       {adminTaskVideo ? (
                         adminTaskVideo.type.includes('video') ? (
                           <div className="flex flex-col items-center justify-center bg-gray-100 w-full h-full">
                             <Play size={24} className="text-blue-500 mb-1 fill-blue-500" />
                             <span className="text-[10px] font-bold text-gray-600">Video Selected</span>
                           </div>
                         ) : (
                           <img src={URL.createObjectURL(adminTaskVideo)} alt="Site Preview" className="w-full h-full object-cover" />
                         )
                       ) : (
                         <div className="flex flex-col items-center justify-center gap-1">
                           <Video size={20} className="text-gray-400 group-hover:text-blue-500" />
                           <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Site Video</span>
                         </div>
                       )}
                       <input type="file" accept="video/*, image/*" onChange={e => setAdminTaskVideo(e.target.files?.[0] || null)} className="hidden" />
                     </label>
                   </div>

                   <div>
                     <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Remarks / Admin Note (Optional)</label>
                     <textarea 
                       value={adminTaskRemarks} 
                       onChange={e => setAdminTaskRemarks(e.target.value)} 
                       rows={3} 
                       placeholder="Type any remarks..." 
                       className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:border-blue-400 focus:bg-white outline-none resize-none transition-all text-gray-900 placeholder-gray-400" 
                     />
                   </div>
                 </div>
                 
                 <button
                   onClick={submitTask}
                   disabled={submittingTask || !adminTaskCategory || adminTaskProductPhotos.length < 2 || !adminTaskVideo}
                   className="w-full py-3 rounded-xl text-white text-sm font-bold bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                 >
                   {submittingTask ? (<><Loader2 size={16} className="animate-spin" /> Uploading Task…</>) : (<><UploadCloud size={16} /> Submit Task Update</>)}
                 </button>
               </div>

            </div>

            {/* Sticky bottom close */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end z-20 shrink-0">
               <button onClick={() => setManageTarget(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Close Workspace</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ══ MODAL: STATUS OVERRIDE CONFIRM → REASON ══ */}
      {/* ══════════════════════════════════════════ */}
      {statusModal.open && (
        <div
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !statusModal.saving && closeStatusModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>

            {statusModal.stage === 'confirm' ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-amber-500" />
                  </div>
                  <h3 className="text-base font-black text-gray-900">Are you sure?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  Force this project's status from{' '}
                  <span className="font-bold uppercase text-gray-800">{statusLabel(statusModal.fromStatus)}</span>
                  {' '}to{' '}
                  <span className="font-bold uppercase text-gray-800">{statusLabel(statusModal.pendingStatus)}</span>?
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={closeStatusModal}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    No, cancel
                  </button>
                  <button
                    onClick={confirmStatusOverride}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm bg-gray-900 hover:bg-gray-800"
                  >
                    Yes, continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-black text-gray-900 mb-1">Reason for Change</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Confirm why status is moving to{' '}
                  <span className="font-bold uppercase">{statusLabel(statusModal.pendingStatus)}</span>. This is required.
                </p>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  autoFocus
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  placeholder="Why is this status being changed?"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-gray-400 outline-none resize-none text-gray-900 placeholder-gray-400"
                  disabled={statusModal.saving}
                />
                <div className="flex items-center justify-end gap-3 mt-5">
                  <button
                    onClick={() => setStatusModal(prev => ({ ...prev, stage: 'confirm' }))}
                    disabled={statusModal.saving}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    disabled={!statusModal.reason.trim() || statusModal.saving}
                    onClick={submitStatusModalReason}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {statusModal.saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Change'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ══ MODALS: CLOSE ══ */}
      {/* ══════════════════════════════════════════ */}
      {closeTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Lock size={18} className="text-teal-600" /> Close Project</h2>
              <button onClick={() => setCloseTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                This marks <span className="font-bold text-gray-900">{closeTarget.job_id}</span> as Completed. PM sign-off must already be recorded before closing.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">PM Name Verification</span>
                <span className="text-base font-black text-gray-900">{closeTarget.pm_name || 'Not recorded yet'}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 bg-gray-50/50">
              <button onClick={() => setCloseTarget(null)} className="flex-1 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition">
                Cancel
              </button>
              <button
                onClick={submitClose}
                disabled={closing || !closeTarget.pm_name}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {closing ? (<><Loader2 size={16} className="animate-spin" /> Closing…</>) : 'Confirm Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        html, body {
          overflow-x: hidden;
        }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #d1d5db; }
      `}</style>
    </div>
  );
}

export default function ModularAdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading module...
      </div>
    }>
      <ModularAdminContent />
    </Suspense>
  );
}