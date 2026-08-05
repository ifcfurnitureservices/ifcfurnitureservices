'use client';
import { useState, useRef, useEffect, Suspense, type RefObject } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, Package, Upload, Eye, X, AlertCircle,
  CheckCircle, Loader2, Calendar, List, FilePlus, FileText, Image as ImageIcon,
  ClipboardCheck, ClipboardList, Hammer, Wrench, RefreshCcw, Trash2,
  User, CalendarDays, PenLine, UploadCloud, Edit, Save, HelpCircle, XCircle
} from 'lucide-react';

// ══════════════════════════════════════════
// Types & constants
// ══════════════════════════════════════════
type Tab = 'list' | 'create';
type StatusFilter = 'all' | 'submitted' | 'assigned' | 'in_progress' | 'handed_to_countertop' | 'completed' | 'snag_reopened' | 'cancelled';
type DateFilter = 'all' | 'today' | '7days' | '30days' | 'custom';

const EMPTY_FORM = {
  customer_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  project_details: '',
};

type DocBucket = 'drawings' | 'hardware_checklist' | 'material_checklist' | 'site_photos';

const DOC_BUCKETS: { key: DocBucket; label: string; hint: string; icon: any; accept: string }[] = [
  { key: 'drawings', label: 'Drawings', hint: 'Layout & elevation drawings (PDF, image)', icon: FileText, accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.dwg,.dxf' },
  { key: 'hardware_checklist', label: 'Hardware Checklist', hint: 'Hinges, channels, handles etc.', icon: ClipboardCheck, accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt' },
  { key: 'material_checklist', label: 'Material Checklist', hint: 'Boards, laminates, finishes etc.', icon: ClipboardList, accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt' },
  { key: 'site_photos', label: 'Site Photos', hint: 'Current site condition photos', icon: ImageIcon, accept: 'image/*' },
];

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'submitted', label: 'Pending', icon: Calendar },
  { id: 'assigned', label: 'Assigned', icon: Wrench },
  { id: 'in_progress', label: 'In Progress', icon: Hammer },
  { id: 'handed_to_countertop', label: 'Countertop', icon: RefreshCcw },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
  { id: 'snag_reopened', label: 'Snag / Revisit', icon: AlertCircle },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  submitted: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: '○ Pending' },
  assigned: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● Assigned' },
  job_accepted: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● Job Accepted' },
  in_progress: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● In Progress' },
  handed_to_countertop: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: '⟳ Awaiting Countertop' },
  countertop_completed: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', label: '⟳ Countertop Done' },
  sign_off: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Sign-off Pending' },
  completed: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Completed' },
  cancelled: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Cancelled' },
  snag_reopened: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Snag / Revisit' },
};

const PROJECT_TABLE_COLUMNS = [
  { label: 'Job ID', key: 'job_id' },
  { label: 'Customer', key: 'customer_name' },
  { label: 'City', key: 'city' },
  { label: 'Status', key: 'status' },
  { label: 'Executor', key: 'executor' },
  { label: 'Submitted', key: 'created_at' },
];

// ══════════════════════════════════════════
// Inner component (logic + UI)
// ══════════════════════════════════════════
function ModularProjectsContent() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');

  const [clientData, setClientData] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeTab, setActiveTab] = useState<Tab>('list');

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [files, setFiles] = useState<Record<DocBucket, File[]>>({
    drawings: [], hardware_checklist: [], material_checklist: [], site_photos: [],
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // ── Modal States ──
  const [viewProject, setViewProject] = useState<any>(null);
  const [viewDocs, setViewDocs] = useState<any[]>([]);

  const [countertopTarget, setCountertopTarget] = useState<any>(null);
  const [countertopFiles, setCountertopFiles] = useState<File[]>([]);
  const [countertopUploading, setCountertopUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit Modal State
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(false);
  
  // Edit Modal - Document States
  const [editExistingDocs, setEditExistingDocs] = useState<any[]>([]);
  const [editDocsToDelete, setEditDocsToDelete] = useState<any[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<Record<DocBucket, File[]>>({
    drawings: [], hardware_checklist: [], material_checklist: [], site_photos: [],
  });

  // Snag Modal State
  const [snagTarget, setSnagTarget] = useState<any>(null);
  const [snagType, setSnagType] = useState('Snag');
  const [snagReason, setSnagReason] = useState('');
  const [submittingSnag, setSubmittingSnag] = useState(false);

  const fileRefs: Record<DocBucket, RefObject<HTMLInputElement | null>> = {
    drawings: useRef<HTMLInputElement>(null),
    hardware_checklist: useRef<HTMLInputElement>(null),
    material_checklist: useRef<HTMLInputElement>(null),
    site_photos: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (urlStatus) {
      setStatusFilter(urlStatus as StatusFilter);
      setActiveTab('list');
    }
  }, [urlStatus]);

  useEffect(() => {
    const storedUser = localStorage.getItem('clientUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    setClientData(JSON.parse(storedUser));
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (clientData?.id) fetchProjects(clientData.id);
  }, [clientData]);

  const fetchProjects = async (clientId: string) => {
    const { data, error } = await supabase
      .from('modular_projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
      setErrorMsg('Failed to load your projects. Please contact support.');
    } else if (data) {
      setProjects(data);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setFiles({ drawings: [], hardware_checklist: [], material_checklist: [], site_photos: [] });
    Object.values(fileRefs).forEach(r => { if (r.current) r.current.value = ''; });
    setErrorMsg('');
  };

  const handleFilePick = (bucket: DocBucket, list: FileList | null) => {
    if (!list) return;
    setFiles(prev => ({ ...prev, [bucket]: [...prev[bucket], ...Array.from(list)] }));
  };

  const removeFile = (bucket: DocBucket, idx: number) => {
    setFiles(prev => ({ ...prev, [bucket]: prev[bucket].filter((_, i) => i !== idx) }));
  };

  const uploadDoc = async (projectId: string, bucket: DocBucket, file: File) => {
    // Sanitize the file name to remove special characters and spaces
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${projectId}/${bucket}/${Date.now()}_${safeFileName}`;
    
    const { error: upErr } = await supabase.storage
      .from('modular-project-docs')
      .upload(path, file, { upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from('modular-project-docs').getPublicUrl(path);

    const { error: insErr } = await supabase.from('modular_project_documents').insert([{
      project_id: projectId,
      doc_type: bucket,
      file_url: urlData.publicUrl,
      uploaded_by: clientData?.id || null,
    }]);
    if (insErr) throw insErr;
  };

  const handleSave = async () => {
    if (!clientData?.id) {
      setErrorMsg('You must be logged in to submit a project.');
      return;
    }

    const required = [
      { key: 'customer_name', name: 'Customer Name' },
      { key: 'phone', name: 'Phone Number' },
      { key: 'address', name: 'Address' },
      { key: 'city', name: 'City' },
      { key: 'state', name: 'State' },
      { key: 'pincode', name: 'Pincode' },
    ];
    const missing = required.find(f => !formData[f.key as keyof typeof formData]?.toString().trim());
    if (missing) {
      setErrorMsg(`${missing.name} is required to submit a project.`);
      return;
    }
    
    // Validate mandatory documents
    if (files.drawings.length === 0) {
      setErrorMsg('At least one drawing is required to submit a project.');
      return;
    }
    if (files.site_photos.length === 0) {
      setErrorMsg('At least one site photo is required to submit a project.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const { data: inserted, error } = await supabase
        .from('modular_projects')
        .insert([{
          client_id: clientData.id,
          client: clientData?.full_name || '',
          customer_name: formData.customer_name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          landmark: formData.landmark,
          project_details: formData.project_details,
          status: 'submitted',
        }])
        .select()
        .single();

      if (error) throw error;

      const projectId = inserted.id;
      const uploadTasks: Promise<void>[] = [];
      (Object.keys(files) as DocBucket[]).forEach(bucket => {
        files[bucket].forEach(file => uploadTasks.push(uploadDoc(projectId, bucket, file)));
      });
      await Promise.all(uploadTasks);

      showSuccess('Project submitted successfully! Our team will review and assign a Job ID shortly.');
      resetForm();
      fetchProjects(clientData.id);
      setActiveTab('list');
    } catch (error: any) {
      setErrorMsg('Error submitting project: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const openView = async (project: any) => {
    setViewProject(project);
    const { data } = await supabase
      .from('modular_project_documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    setViewDocs(data || []);
  };

  const openEdit = async (project: any) => {
    setEditTarget(project);
    setEditForm({
      customer_name: project.customer_name || '',
      phone: project.phone || '',
      email: project.email || '',
      address: project.address || '',
      city: project.city || '',
      state: project.state || '',
      pincode: project.pincode || '',
      landmark: project.landmark || '',
      project_details: project.project_details || '',
    });
    
    const { data } = await supabase
      .from('modular_project_documents')
      .select('*')
      .eq('project_id', project.id);
      
    setEditExistingDocs(data || []);
    setEditDocsToDelete([]);
    setEditNewFiles({ drawings: [], hardware_checklist: [], material_checklist: [], site_photos: [] });
  };

  const submitEdit = async () => {
    if (!editTarget) return;

    const finalDrawingsCount = editExistingDocs.filter(d => d.doc_type === 'drawings').length + editNewFiles.drawings.length;
    if (finalDrawingsCount === 0) {
      setErrorMsg('At least one drawing is required for the project.');
      return;
    }
    const finalPhotosCount = editExistingDocs.filter(d => d.doc_type === 'site_photos').length + editNewFiles.site_photos.length;
    if (finalPhotosCount === 0) {
      setErrorMsg('At least one site photo is required for the project.');
      return;
    }

    setEditing(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('modular_projects')
        .update({
          customer_name: editForm.customer_name,
          phone: editForm.phone,
          email: editForm.email,
          address: editForm.address,
          city: editForm.city,
          state: editForm.state,
          pincode: editForm.pincode,
          landmark: editForm.landmark,
          project_details: editForm.project_details,
          updated_at: new Date().toISOString()
        })
        .eq('id', editTarget.id);

      if (error) throw error;

      if (editDocsToDelete.length > 0) {
        const idsToDelete = editDocsToDelete.map(d => d.id);
        const pathsToDelete = editDocsToDelete.map(d => {
          const parts = d.file_url.split('/modular-project-docs/');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean);

        await supabase.from('modular_project_documents').delete().in('id', idsToDelete);
        
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('modular-project-docs').remove(pathsToDelete);
        }
      }

      const uploadTasks: Promise<void>[] = [];
      (Object.keys(editNewFiles) as DocBucket[]).forEach(bucket => {
        editNewFiles[bucket].forEach(file => uploadTasks.push(uploadDoc(editTarget.id, bucket, file)));
      });
      await Promise.all(uploadTasks);

      showSuccess('Project details and documents updated successfully.');
      setEditTarget(null);
      fetchProjects(clientData.id);
    } catch (err: any) {
      setErrorMsg('Failed to update project: ' + err.message);
    } finally {
      setEditing(false);
    }
  };

  const openCountertopUpload = (project: any) => {
    setCountertopTarget(project);
    setCountertopFiles([]);
  };

  const submitCountertopPhotos = async () => {
    if (!countertopTarget || countertopFiles.length === 0) {
      setErrorMsg('Please select at least one countertop completion photo.');
      return;
    }
    setCountertopUploading(true);
    setErrorMsg('');
    try {
      await Promise.all(
        countertopFiles.map(f => uploadDoc(countertopTarget.id, 'site_photos', f))
      );
      const { error } = await supabase
        .from('modular_projects')
        .update({ status: 'countertop_completed' })
        .eq('id', countertopTarget.id)
        .eq('client_id', clientData.id);
      if (error) throw error;

      showSuccess('Countertop completion photos submitted!');
      setCountertopTarget(null);
      setCountertopFiles([]);
      fetchProjects(clientData.id);
    } catch (error: any) {
      setErrorMsg('Error uploading countertop photos: ' + error.message);
    } finally {
      setCountertopUploading(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('modular_projects').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showSuccess('Project deleted successfully.');
      setDeleteTarget(null);
      fetchProjects(clientData.id);
    } catch (err: any) {
      setErrorMsg('Failed to delete project: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const submitSnag = async () => {
    if (!snagTarget || !snagReason.trim()) {
      setErrorMsg('Please provide a reason for the revisit.');
      return;
    }
    setSubmittingSnag(true);
    setErrorMsg('');
    try {
      const timestamp = new Date().toLocaleString('en-IN');
      
      const baseId = snagTarget.job_id || 'PENDING';
      const snagVisitId = baseId.includes('-SNAG') ? baseId : `${baseId}-SNAG`;

      const updatedDetails = `${snagTarget.project_details || ''}\n\n[${snagType.toUpperCase()} REPORTED - ${timestamp}]\nSnag Visit ID: ${snagVisitId}\nDetails: ${snagReason}`;

      const { error } = await supabase.from('modular_projects')
        .update({ 
          status: 'snag_reopened', 
          job_id: snagVisitId, 
          project_details: updatedDetails 
        })
        .eq('id', snagTarget.id);

      if (error) throw error;
      showSuccess(`${snagType} reported successfully. A revisit has been scheduled.`);
      setSnagTarget(null);
      setSnagReason('');
      setSnagType('Snag');
      fetchProjects(clientData.id);
    } catch (err: any) {
      setErrorMsg('Failed to report snag: ' + err.message);
    } finally {
      setSubmittingSnag(false);
    }
  };

  const filtered = projects.filter(p => {
    const matchesSearch =
      p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.job_id?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all' && p.created_at) {
      const pDate = new Date(p.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        matchesDate = pDate >= today;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        matchesDate = pDate >= sevenDaysAgo;
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        matchesDate = pDate >= thirtyDaysAgo;
      } else if (dateFilter === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (pDate < start) matchesDate = false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (pDate > end) matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalProjects = projects.length;
  // Make sure to exclude 'cancelled' from the inProgress count
  const inProgress = projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length;
  const completed = projects.filter(p => p.status === 'completed').length;

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_BADGE[status] ?? STATUS_BADGE['submitted'];
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  // ── Helper to determine Executor Accept/Reject status ──
  const getExecutorStatus = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'submitted') return { label: '— Not Assigned', color: 'text-gray-400 bg-gray-50 border-gray-200' };
    if (s === 'assigned') return { label: 'Pending Accept', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    if (s === 'rejected') return { label: 'Rejected', color: 'text-red-700 bg-red-50 border-red-200' };
    return { label: 'Accepted', color: 'text-green-700 bg-green-50 border-green-200' };
  };

  const truncate = (val: any, len = 20) => {
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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading your workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-16">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modular Interior Installation</h1>
            <p className="text-sm text-gray-500 mt-1">Submit and track your modular interior projects</p>
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
            <CheckCircle size={16} className="flex-shrink-0" /> {successMsg}
          </div>
        )}
        {errorMsg && !deleteTarget && !snagTarget && !countertopTarget && !viewProject && !editTarget && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Projects', value: totalProjects, icon: Package, color: 'text-[#8ED26B]', bg: 'bg-[#8ED26B]/10' },
            { label: 'In Progress', value: inProgress, icon: Hammer, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

        {/* Tabs container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 p-4 gap-4">
            <div className="flex gap-0">
              {([
                { id: 'list', label: 'My Projects', icon: List },
                { id: 'create', label: 'New Project', icon: FilePlus },
              ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { if (id === 'create') resetForm(); setActiveTab(id); }}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap
                    ${activeTab === id
                      ? 'border-[#8ED26B] text-[#8ED26B] bg-[#8ED26B]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                  {id === 'list' && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold
                      ${activeTab === 'list' ? 'bg-[#8ED26B] text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {filtered.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 flex-wrap">
              {STATUS_FILTERS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap
                    ${statusFilter === id
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ══ TAB — LIST ══ */}
          {activeTab === 'list' && (
            <div>
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative w-full sm:max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by Job ID, customer, city…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 focus:bg-white transition-all placeholder-gray-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition-all text-gray-900"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="custom">Custom Date</option>
                  </select>

                  {dateFilter === 'custom' && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#8ED26B] transition-all text-gray-900 bg-white"
                      />
                      <span className="text-gray-400 text-sm font-medium">to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#8ED26B] transition-all text-gray-900 bg-white"
                      />
                    </div>
                  )}
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
                      <th className="px-4 py-3 border-b border-gray-200 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={PROJECT_TABLE_COLUMNS.length + 1} className="px-5 py-16 text-center text-gray-400">
                          <Package size={36} className="mx-auto mb-3 text-gray-200" />
                          <p className="font-medium">No projects found</p>
                          {projects.length === 0 && (
                            <button
                              onClick={() => { resetForm(); setActiveTab('create'); }}
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8ED26B] text-white text-sm font-semibold hover:brightness-95 transition"
                            >
                              <Plus size={15} /> Submit First Project
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : filtered.map(project => (
                      <tr key={project.id} className="hover:bg-gray-50/70 transition-colors">
                        {PROJECT_TABLE_COLUMNS.map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.key === 'status' ? (
                              <StatusBadge status={project.status} />
                            ) : col.key === 'executor' ? (
                              <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${getExecutorStatus(project.status).color}`}>
                                {getExecutorStatus(project.status).label}
                              </span>
                            ) : col.key === 'created_at' ? (
                              <span className="text-xs text-gray-700">{formatDate(project[col.key])}</span>
                            ) : col.key === 'job_id' ? (
                              <span className="text-xs font-bold text-gray-700">{project.job_id || 'Pending'}</span>
                            ) : (
                              <span className="text-xs text-gray-700 block truncate">{truncate(project[col.key])}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {project.status === 'handed_to_countertop' && (
                              <button
                                onClick={() => openCountertopUpload(project)}
                                title="Upload countertop completion photos"
                                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 transition whitespace-nowrap"
                              >
                                <Upload size={13} /> Countertop
                              </button>
                            )}

                            {['completed', 'sign_off'].includes(project.status) && (
                              <button
                                onClick={() => { setSnagTarget(project); setSnagReason(''); setSnagType('Snag'); }}
                                title="Report Snag or Revisit"
                                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition whitespace-nowrap"
                              >
                                <AlertCircle size={13} /> Snag / Revisit
                              </button>
                            )}

                            <button
                              onClick={() => openView(project)}
                              title="View"
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition whitespace-nowrap"
                            >
                              <Eye size={13} /> View
                            </button>

                            {/* Ensure Cancelled projects cannot be edited or snagged */}
                            {!['completed', 'sign_off', 'cancelled'].includes(project.status) && (
                              <button
                                onClick={() => openEdit(project)}
                                title="Edit"
                                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition whitespace-nowrap"
                              >
                                <Edit size={13} /> Edit
                              </button>
                            )}

                            <button
                              onClick={() => setDeleteTarget(project)}
                              title="Delete"
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition whitespace-nowrap"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
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
                    {projects.length === 0 && (
                      <button
                        onClick={() => { resetForm(); setActiveTab('create'); }}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8ED26B] text-white text-sm font-semibold hover:brightness-95 transition"
                      >
                        <Plus size={15} /> Submit First Project
                      </button>
                    )}
                  </div>
                ) : filtered.map(project => (
                  <div key={project.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#8ED26B]">{project.job_id || 'Pending assignment'}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{project.customer_name}</p>
                        <p className="text-xs text-gray-500 truncate">{project.city}</p>
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
                    
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      {project.status === 'handed_to_countertop' && (
                        <button
                          onClick={() => openCountertopUpload(project)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600 text-xs font-semibold transition min-w-[140px]"
                        >
                          <Upload size={14} /> Countertop
                        </button>
                      )}

                      {['completed', 'sign_off'].includes(project.status) && (
                        <button
                          onClick={() => { setSnagTarget(project); setSnagReason(''); setSnagType('Snag'); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 text-xs font-semibold transition min-w-[140px]"
                        >
                          <AlertCircle size={14} /> Snag / Revisit
                        </button>
                      )}

                      <button
                        onClick={() => openView(project)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition"
                      >
                        <Eye size={14} /> View
                      </button>

                      {/* Ensure Cancelled projects cannot be edited or snagged */}
                      {!['completed', 'sign_off', 'cancelled'].includes(project.status) && (
                        <button
                          onClick={() => openEdit(project)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition"
                        >
                          <Edit size={14} /> Edit
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteTarget(project)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-semibold transition"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
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
          )}

          {/* ══ TAB — CREATE ══ */}
          {activeTab === 'create' && (
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
              <div className="mb-8 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">New Modular Interior Installation Request</h2>
                <p className="text-xs text-gray-400 mt-1">Fill in the project details and attach the required documents.</p>
              </div>

              <div className="space-y-6 sm:space-y-8">
                {/* Customer Info */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Customer Info
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Customer Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={formData.customer_name}
                        onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Phone Number <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter phone number"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                      <input
                        type="email"
                        placeholder="Enter email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </section>

                {/* Site Address */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Site Address
                  </p>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Address *"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="City *"
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={formData.state}
                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Pincode *"
                        value={formData.pincode}
                        onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Landmark (Optional)"
                        value={formData.landmark}
                        onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </section>

                {/* Documents */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Documents
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {DOC_BUCKETS.map(({ key, label, hint, icon: Icon, accept }) => (
                      <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={15} className="text-[#8ED26B]" />
                          <p className="text-sm font-semibold text-gray-800">
                            {label} {(key === 'drawings' || key === 'site_photos') && <span className="text-red-400">*</span>}
                          </p>
                        </div>
                        <p className="text-[11px] text-gray-400 mb-3">{hint}</p>

                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-50 border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 transition">
                          <Upload size={13} /> Choose files
                          <input
                            ref={fileRefs[key]}
                            type="file"
                            multiple
                            accept={accept}
                            onChange={e => handleFilePick(key, e.target.files)}
                            className="hidden"
                          />
                        </label>

                        {files[key].length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {files[key].map((f, i) => (
                              <li key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                <span className="truncate">{f.name}</span>
                                <button onClick={() => removeFile(key, i)} className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">
                                  <X size={12} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Project details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Project Details
                  </p>
                  <textarea
                    placeholder="Describe the scope of the modular interior project (Optional)"
                    value={formData.project_details}
                    onChange={e => setFormData({ ...formData, project_details: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white placeholder:text-gray-400 resize-none"
                  />
                </section>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { resetForm(); setActiveTab('list'); }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 bg-white transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-2.5 rounded-lg text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm bg-[#8ED26B] hover:brightness-95"
                >
                  {saving ? (<><Loader2 size={16} className="animate-spin" /> Submitting…</>) : (<><Plus size={16} /> Submit Project</>)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ══ MODALS: VIEW DETAILS ══ */}
      {/* ══════════════════════════════════════════ */}
      {viewProject && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewProject(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl h-full sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            
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

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><CalendarDays size={12} className="text-orange-500" /> Project Management</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Status</p>
                      <StatusBadge status={viewProject.status} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Scheduled Date</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{formatDate(viewProject.scheduled_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">PM Name (Sign-off)</p>
                      <p className="text-sm font-bold text-gray-900 break-all">{viewProject.pm_name || '—'}</p>
                    </div>
                 </div>
                 {viewProject.pm_signature_url && (
                   <div className="mt-4 pt-4 border-t border-gray-100">
                     <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5"><PenLine size={12} className="text-gray-500" /> PM Signature</p>
                     <img src={viewProject.pm_signature_url} alt="Signature" className="max-h-24 bg-gray-50 border border-gray-200 rounded-lg px-4 object-contain mix-blend-multiply" />
                   </div>
                 )}
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><FileText size={12} className="text-indigo-500" /> Intake Documents</h3>
                {viewDocs.length === 0 ? (
                  <p className="text-xs text-gray-400 font-medium italic">No documents uploaded during intake.</p>
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

              {viewProject.project_details && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ClipboardList size={12} className="text-teal-500" /> Project Details</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{viewProject.project_details}</p>
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

      {/* ══ MODALS: EDIT PROJECT ══ */}
      {editTarget && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl h-full sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-10 h-10 rounded-full bg-blue-50 border border-blue-100 items-center justify-center shrink-0">
                  <Edit size={18} className="text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Edit Project • {editTarget.job_id || 'Pending assignment'}</p>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 truncate">{editTarget.customer_name || 'N/A'}</h2>
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 flex-1">
              
              {/* Form Grid */}
              <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-3 rounded-full bg-blue-400" /> Project Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer Name</label>
                    <input
                      type="text"
                      value={editForm.customer_name}
                      onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pincode</label>
                    <input
                      type="text"
                      value={editForm.pincode}
                      onChange={e => setEditForm({ ...editForm, pincode: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Landmark</label>
                    <input
                      type="text"
                      value={editForm.landmark}
                      onChange={e => setEditForm({ ...editForm, landmark: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Project Scope</label>
                    <textarea
                      value={editForm.project_details}
                      onChange={e => setEditForm({ ...editForm, project_details: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 focus:bg-white resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* Edit Documents Section */}
              <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-3 rounded-full bg-blue-400" /> Document Management
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {DOC_BUCKETS.map(({ key, label, hint, icon: Icon, accept }) => {
                    const bucketExisting = editExistingDocs.filter(d => d.doc_type === key);
                    const bucketNew = editNewFiles[key] || [];

                    return (
                      <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={15} className="text-blue-500" />
                          <p className="text-sm font-semibold text-gray-800">
                            {label} {(key === 'drawings' || key === 'site_photos') && <span className="text-red-400">*</span>}
                          </p>
                        </div>
                        <p className="text-[11px] text-gray-400 mb-3">{hint}</p>

                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 border border-dashed border-blue-300 text-blue-600 hover:bg-blue-100 transition">
                          <Upload size={13} /> Add {label}
                          <input
                            type="file"
                            multiple
                            accept={accept}
                            onChange={e => {
                              if (!e.target.files) return;
                              setEditNewFiles(prev => ({ ...prev, [key]: [...prev[key], ...Array.from(e.target.files!)] }));
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>

                        {(bucketExisting.length > 0 || bucketNew.length > 0) && (
                          <ul className="mt-3 space-y-1.5">
                            {/* Existing Files */}
                            {bucketExisting.map((doc) => (
                              <li key={doc.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                                <span className="truncate flex-1 pr-2">{doc.file_url.split('/').pop() || 'Existing File'}</span>
                                <button 
                                  onClick={() => {
                                    setEditExistingDocs(prev => prev.filter(d => d.id !== doc.id));
                                    setEditDocsToDelete(prev => [...prev, doc]);
                                  }} 
                                  className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                >
                                  <X size={12} />
                                </button>
                              </li>
                            ))}
                            {/* New Files */}
                            {bucketNew.map((f, i) => (
                              <li key={`new-${i}`} className="flex items-center justify-between text-xs text-gray-600 bg-green-50 rounded-lg px-2.5 py-1.5 border border-green-100">
                                <span className="truncate flex-1 pr-2 text-green-700">{f.name} (New)</span>
                                <button 
                                  onClick={() => {
                                    setEditNewFiles(prev => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));
                                  }} 
                                  className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                >
                                  <X size={12} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>
            
            {/* Sticky bottom save */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end gap-3 z-20 shrink-0">
               <button onClick={() => setEditTarget(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 bg-white">Cancel</button>
               <button onClick={submitEdit} disabled={editing} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                 {editing ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
               </button>
            </div>

          </div>
        </div>
      )}

      {/* ══ Countertop Completion Upload Modal ══ */}
      {countertopTarget && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setCountertopTarget(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-md sm:rounded-2xl shadow-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><UploadCloud size={18} className="text-purple-500" /> Upload Countertop</h2>
              <button onClick={() => setCountertopTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-6 flex-1">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                <p className="text-sm text-gray-600 mb-5">
                  Upload photos of the completed countertop installation for <span className="font-bold text-gray-900">{countertopTarget.job_id}</span>.
                </p>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl cursor-pointer bg-gray-50 hover:bg-purple-50/50 transition-colors">
                  <UploadCloud size={24} className="text-purple-400 mb-2" />
                  <span className="text-sm font-bold text-gray-700">Choose Photos</span>
                  <span className="text-[10px] font-semibold text-gray-400 mt-1">Any image or document</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={e => setCountertopFiles(e.target.files ? Array.from(e.target.files) : [])}
                    className="hidden"
                  />
                </label>
                {countertopFiles.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-left">
                    {countertopFiles.map((f, i) => (
                      <li key={i} className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 truncate">{f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end gap-3 z-20 shrink-0">
               <button onClick={() => setCountertopTarget(null)} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
               <button onClick={submitCountertopPhotos} disabled={countertopUploading || countertopFiles.length === 0} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                 {countertopUploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Upload size={16} /> Submit</>}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete Confirmation Modal ══ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-md sm:rounded-2xl shadow-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Trash2 size={18} className="text-red-500" /> Delete Project</h2>
              <button onClick={() => setDeleteTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-6 flex-1">
              <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500 mb-4 border border-red-100">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-2">Delete Project?</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Are you sure you want to delete <span className="font-bold text-gray-800">{deleteTarget.customer_name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end gap-3 z-20 shrink-0">
               <button onClick={() => setDeleteTarget(null)} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 bg-white transition-colors">Cancel</button>
               <button onClick={submitDelete} disabled={deleting} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                 {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting...</> : 'Yes, Delete'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Report Snag Modal ══ */}
      {snagTarget && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={() => setSnagTarget(null)}>
          <div className="bg-[#f8fafc] w-full sm:max-w-lg sm:rounded-2xl shadow-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><AlertCircle size={18} className="text-orange-500" /> Request Revisit</h2>
              <button onClick={() => setSnagTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-6 flex-1">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">
                <p className="text-sm text-gray-600">
                  Please specify the reason for reopening <span className="font-bold text-gray-900">{snagTarget.customer_name}'s</span> project. Our team will review and schedule a revisit.
                </p>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-blue-500" /> Reason Type
                  </label>
                  <select
                    value={snagType}
                    onChange={(e) => setSnagType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition bg-gray-50 focus:bg-white text-gray-800"
                  >
                    <option value="Snag">Snag (Defect or Minor Issue)</option>
                    <option value="Complaint">Complaint (Major Issue)</option>
                    <option value="Additional Work">Additional Work Required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <PenLine size={14} className="text-gray-500" /> Description
                  </label>
                  <textarea
                    placeholder="Describe the issue or required work in detail..."
                    value={snagReason}
                    onChange={e => setSnagReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition resize-none bg-gray-50 focus:bg-white text-gray-700"
                  />
                </div>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 sm:px-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end gap-3 z-20 shrink-0">
               <button onClick={() => setSnagTarget(null)} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 bg-white transition-colors">Cancel</button>
               <button onClick={submitSnag} disabled={submittingSnag || !snagReason.trim()} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                 {submittingSnag ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Request'}
               </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
  html, body {
    overflow-x: hidden;
    color-scheme: light;
  }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #d1d5db; }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════
// Main export (Suspense wrapper for useSearchParams)
// ══════════════════════════════════════════
export default function ModularProjectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading module...
      </div>
    }>
      <ModularProjectsContent />
    </Suspense>
  );
}