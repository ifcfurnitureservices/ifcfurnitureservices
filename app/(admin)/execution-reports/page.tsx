'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  Loader2,
  Navigation,
  Hammer,
  ImageIcon,
  PenLine,
  MapPin,
  MessageSquarePlus,
  FileText,
  Clock,
  Clock3,
  CheckCircle2,
  Package,
  ShieldCheck,
  X,
  Eye,
  Search,
  Filter,
  CalendarDays,
  Calendar,
  User,
  Briefcase,
  PauseCircle,
  Hash,
  Phone,
  Link as LinkIcon,
  Activity,
  Trash2,
  RefreshCw,
  Plus,
  Edit,
  Save,
  UploadCloud,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';

/* ─── Utilities ────────────────────────────────────────────────────────────── */
const fmtHuman = (ms: number) => {
  if (!ms || ms <= 0) return '--';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const fmtTime = (d: Date | null) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
const fmtDate = (d: Date | null) => d ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '--';
const fmtDateTime = (d: Date | null) => d ? `${fmtDate(d)} at ${fmtTime(d)}` : '--';

// Date converters for datetime-local inputs
const toLocalDT = (isoStr?: string) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalDT = (localStr?: string) => {
  if (!localStr) return undefined;
  return new Date(localStr).toISOString();
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=en`);
    const data = await res.json();
    return data?.display_name || 'Location details unavailable';
  } catch { return 'Location details unavailable'; }
};

// Human-friendly label for status option values
const statusLabel = (s?: string) => {
  if (!s) return 'N/A';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

type OrderRow = {
  id: string; job_id?: string; order_id?: string; customer_name?: string; phone?: string; email?: string;
  assigned_executor_id?: string; assigned_executor_name?: string; type_of_service?: string; product_name?: string;
  sku?: string; quantity?: number; product_link?: string; scheduled_date?: string; scheduled_time?: string;
  schedule_status?: string; status?: string; address?: string; city?: string; state?: string; pincode?: string;
  landmark?: string; location_details?: string; executive_response?: string | null; rejection_reason?: string | null;
  responded_at?: string | null; status_reason?: string | null; status_updated_at?: string | null; invoice_no?: string; invoice_date?: string; [key: string]: any;
};
type ExecRow = { order_id: string; travel_start_time?: string; travel_end_time?: string; travel_duration_ms?: number; start_time?: string; end_time?: string; total_paused_ms?: number; actual_worked_ms?: number; execution_notes?: string; progress_updates?: string[]; before_photos?: string[]; after_photos?: string[]; signature_url?: string; signature_latitude?: number; signature_longitude?: number; signature_timestamp?: string;[key: string]: any; };

// Status for the ORDER / JOB itself
const statusStyles = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('done')) return 'bg-green-50 text-green-700 border-green-200';
  if (s.includes('progress') || s.includes('working') || s.includes('started')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s.includes('cancel') || s.includes('reject')) return 'bg-red-50 text-red-700 border-red-200';
  if (s.includes('travel') || s.includes('reach')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

// Style for the EXECUTIVE RESPONSE (accepted / rejected / not yet set)
const responseStyles = (resp?: string | null) => {
  const r = (resp || '').toLowerCase();
  if (r === 'accepted') return 'bg-green-50 text-green-700 border-green-200';
  if (r === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-500 border-gray-200';
};
const responseLabel = (resp?: string | null) => {
  const r = (resp || '').toLowerCase();
  if (r === 'accepted') return 'Accepted';
  if (r === 'rejected') return 'Rejected';
  return 'Pending';
};

const STORAGE_BUCKET = 'job-proofs';

/* ─── Donut Ring ─────────────────────── */
function DonutRing({ value, total, colorFrom, colorTo, gradientId, trackColor = '#f1f4f8' }: { value: number; total: number; colorFrom: string; colorTo: string; gradientId: string; trackColor?: string }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0 -rotate-90" style={{ filter: `drop-shadow(0 2px 6px ${colorTo}33)` }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r={r} fill="none" stroke={trackColor} strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none" stroke={`url(#${gradientId})`} strokeWidth="7"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ExecutionReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [execMap, setExecMap] = useState<Record<string, ExecRow>>({});
  const [executorsMap, setExecutorsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Modal State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'none' | 'view' | 'manage'>('none');
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});
  const [locLoadingId, setLocLoadingId] = useState<string | null>(null);

  // Lightbox
  const [imgModal, setImgModal] = useState<{ open: boolean; src: string; label: string }>({ open: false, src: '', label: '' });

  // ────────────────────────────────────────────────────────
  // DRAFT STATE
  // ────────────────────────────────────────────────────────
  const [localOrderStatus, setLocalOrderStatus] = useState('pending');
  const [localBeforePhotos, setLocalBeforePhotos] = useState<string[]>([]);
  const [localAfterPhotos, setLocalAfterPhotos] = useState<string[]>([]);
  const [localSignature, setLocalSignature] = useState<string>('');

  const [localExecutiveResponse, setLocalExecutiveResponse] = useState<string>('');
  const [localRejectionReason, setLocalRejectionReason] = useState<string>('');

  const [travelStartDT, setTravelStartDT] = useState('');
  const [travelEndDT, setTravelEndDT] = useState('');
  const [workStartDT, setWorkStartDT] = useState('');
  const [workEndDT, setWorkEndDT] = useState('');

  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMediaChanges, setHasMediaChanges] = useState(false);

  // ── Status change confirmation flow ──
  // stage 'confirm' → "are you sure?" step. stage 'reason' → mandatory reason step.
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    stage: 'confirm' | 'reason';
    fromStatus: string;
    pendingStatus: string;
    reason: string;
    saving: boolean;
  }>({ open: false, stage: 'confirm', fromStatus: '', pendingStatus: '', reason: '', saving: false });

  const closeStatusModal = () => setStatusModal({ open: false, stage: 'confirm', fromStatus: '', pendingStatus: '', reason: '', saving: false });

  /* ── Fetch Data ── */
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const aUser = typeof window !== 'undefined' ? localStorage.getItem('adminUser') : null;
      if (!aUser) { if (!cancelled) setUnauthorized(true); setLoading(false); return; }

      const [
        { data: oData },
        { data: eData },
        { data: exData }
      ] = await Promise.all([
        supabase.from('orders').select('*').order('scheduled_date', { ascending: false }),
        supabase.from('job_execution').select('*'),
        supabase.from('executors').select('id, role, email, status')
      ]);

      if (!cancelled) {
        setOrders(oData || []);

        if (eData) {
          const map: Record<string, ExecRow> = {};
          eData.forEach((e: ExecRow) => { map[e.order_id] = e; });
          setExecMap(map);
        }

        if (exData) {
          const exMap: Record<string, any> = {};
          exData.forEach((e: any) => {
            if (e.id) exMap[e.id] = e;
          });
          setExecutorsMap(exMap);
        }

        setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [supabase]);

  /* ── Reverse Geocode on Open ── */
  useEffect(() => {
    if (!activeId || modalMode === 'none') return;
    const e = execMap[activeId];
    if (e?.signature_latitude && e?.signature_longitude && !locationMap[activeId]) {
      setLocLoadingId(activeId);
      reverseGeocode(e.signature_latitude, e.signature_longitude).then((n) => {
        setLocationMap((prev) => ({ ...prev, [activeId]: n }));
        setLocLoadingId(null);
      });
    }
  }, [activeId, modalMode, execMap, locationMap]);

  /* ── Sync Local State when modal opens ── */
  useEffect(() => {
    if (!activeId) {
      setLocalBeforePhotos([]); setLocalAfterPhotos([]); setLocalSignature('');
      setTravelStartDT(''); setTravelEndDT(''); setWorkStartDT(''); setWorkEndDT('');
      setLocalOrderStatus('pending');
      setLocalExecutiveResponse(''); setLocalRejectionReason('');
      setHasMediaChanges(false);
      closeStatusModal();
      return;
    }

    const o = orders.find(x => x.id === activeId);
    const e = execMap[activeId];

    setLocalOrderStatus(o?.status?.toLowerCase() || 'pending');

    setLocalBeforePhotos(e?.before_photos || []);
    setLocalAfterPhotos(e?.after_photos || []);
    setLocalSignature(e?.signature_url || '');

    setLocalExecutiveResponse(o?.executive_response || '');
    setLocalRejectionReason(o?.rejection_reason || '');

    setTravelStartDT(toLocalDT(e?.travel_start_time));
    setTravelEndDT(toLocalDT(e?.travel_end_time));
    setWorkStartDT(toLocalDT(e?.start_time));
    setWorkEndDT(toLocalDT(e?.end_time));
    setHasMediaChanges(false);

  }, [activeId, execMap, orders]);

  const openModal = (id: string, mode: 'view' | 'manage') => {
    setActiveId(id);
    setModalMode(mode);
  };
  const closeModal = () => {
    setActiveId(null);
    setModalMode('none');
  };

  /* ── Auto-Save Logic for Text & Select Fields ── */
  const handleAutoSave = async (field: string, value: string, reason?: string) => {
    if (!activeId) return;

    try {
      if (field === 'status') {
        setLocalOrderStatus(value);
        const updatePayload: any = { status: value };
        if (reason !== undefined) {
          updatePayload.status_reason = reason;
          updatePayload.status_updated_at = new Date().toISOString();
        }
        await supabase.from('orders').update(updatePayload).eq('id', activeId);
        setOrders(prev => prev.map(o => o.id === activeId ? { ...o, ...updatePayload } : o));
      }
      else if (field === 'executive_response') {
        setLocalExecutiveResponse(value);
        const updatePayload: any = {
          executive_response: value || null,
          responded_at: value ? new Date().toISOString() : null
        };
        if (value !== 'rejected') {
          updatePayload.rejection_reason = null;
          setLocalRejectionReason('');
        }
        await supabase.from('orders').update(updatePayload).eq('id', activeId);
        setOrders(prev => prev.map(o => o.id === activeId ? { ...o, ...updatePayload } : o));
      }
      else if (field === 'rejection_reason') {
        await supabase.from('orders').update({ rejection_reason: value || null }).eq('id', activeId);
        setOrders(prev => prev.map(o => o.id === activeId ? { ...o, rejection_reason: value || null } : o));
      }
      else if (['travel_start', 'travel_end', 'work_start', 'work_end'].includes(field)) {
        // Optimistic UI update
        if (field === 'travel_start') setTravelStartDT(value);
        if (field === 'travel_end') setTravelEndDT(value);
        if (field === 'work_start') setWorkStartDT(value);
        if (field === 'work_end') setWorkEndDT(value);

        const tsStr = field === 'travel_start' ? value : travelStartDT;
        const teStr = field === 'travel_end' ? value : travelEndDT;
        const wsStr = field === 'work_start' ? value : workStartDT;
        const weStr = field === 'work_end' ? value : workEndDT;

        const ts = fromLocalDT(tsStr);
        const te = fromLocalDT(teStr);
        const ws = fromLocalDT(wsStr);
        const we = fromLocalDT(weStr);

        const tDur = ts && te ? new Date(te).getTime() - new Date(ts).getTime() : 0;
        const wDur = ws && we ? new Date(we).getTime() - new Date(ws).getTime() : 0;

        const payload = {
          travel_start_time: ts,
          travel_end_time: te,
          travel_duration_ms: Math.max(0, tDur),
          start_time: ws,
          end_time: we,
          actual_worked_ms: Math.max(0, wDur),
        };

        const existing = execMap[activeId];
        let updatedRow;

        if (existing) {
          const { data } = await supabase.from('job_execution').update(payload).eq('order_id', activeId).select().single();
          updatedRow = data;
        } else {
          const { data } = await supabase.from('job_execution').insert({ order_id: activeId, ...payload }).select().single();
          updatedRow = data;
        }

        if (updatedRow) {
          setExecMap(prev => ({ ...prev, [activeId]: updatedRow as ExecRow }));
        }
      }
    } catch (err) {
      console.error(`Auto-save failed for ${field}`, err);
    }
  };

  /* ── Status change: select opens confirm step, never saves directly ── */
  const requestStatusChange = (newStatus: string) => {
    if (newStatus === localOrderStatus) return;
    setStatusModal({
      open: true,
      stage: 'confirm',
      fromStatus: localOrderStatus,
      pendingStatus: newStatus,
      reason: '',
      saving: false
    });
  };

  const confirmStatusChange = () => {
    setStatusModal(prev => ({ ...prev, stage: 'reason' }));
  };

  const submitStatusChange = async () => {
    if (!statusModal.reason.trim()) return;
    setStatusModal(prev => ({ ...prev, saving: true }));
    await handleAutoSave('status', statusModal.pendingStatus, statusModal.reason.trim());
    closeStatusModal();
  };

  /* ── Filter Logic ── */
  const serviceOptions = useMemo(() => Array.from(new Set(orders.map(o => o.type_of_service).filter(Boolean))).sort(), [orders]);
  const statusOptions = useMemo(() => Array.from(new Set(orders.map(o => o.status).filter(Boolean))).sort(), [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = [o.customer_name, o.assigned_executor_name, o.id, o.phone, o.address, o.product_name].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (serviceFilter !== 'all' && o.type_of_service !== serviceFilter) return false;
      if (dateFrom && o.scheduled_date && o.scheduled_date < dateFrom) return false;
      if (dateTo && o.scheduled_date && o.scheduled_date > dateTo) return false;
      return true;
    });
  }, [orders, search, statusFilter, serviceFilter, dateFrom, dateTo]);

  const activeFilterCount = [search, statusFilter !== 'all', serviceFilter !== 'all', dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setServiceFilter('all'); setDateFrom(''); setDateTo(''); };

  /* ── Header Stat Counts ── */
  const counts = useMemo(() => {
    const stats = { scheduled: 0, unscheduled: 0, accepted: 0, ongoing: 0, completed: 0 };
    orders.forEach((o) => {
      const isScheduled = o.schedule_status === 'scheduled' || !!o.scheduled_date;
      if (isScheduled) stats.scheduled++; else stats.unscheduled++;
      const s = (o.status || '').toLowerCase();
      if (s === 'accepted') stats.accepted++;
      if (s.includes('progress') || s === 'ongoing' || s.includes('started') || s.includes('travel') || s.includes('reach')) stats.ongoing++;
      if (s.includes('complete') || s.includes('done')) stats.completed++;
    });
    return stats;
  }, [orders]);
  const total = orders.length;
  const statCards = [
    { id: 'scheduled', label: 'Scheduled', count: counts.scheduled, from: '#60a5fa', to: '#2563eb', icon: Calendar, tint: '#eff6ff' },
    { id: 'unscheduled', label: 'Unscheduled', count: counts.unscheduled, from: '#fbbf24', to: '#d97706', icon: Clock3, tint: '#fffbeb' },
    { id: 'accepted', label: 'Accepted', count: counts.accepted, from: '#34d399', to: '#059669', icon: CheckCircle2, tint: '#ecfdf5' },
    { id: 'ongoing', label: 'Ongoing', count: counts.ongoing, from: '#a78bfa', to: '#6366f1', icon: Activity, tint: '#eef2ff' },
    { id: 'completed', label: 'Completed', count: counts.completed, from: '#475569', to: '#0f172a', icon: ShieldCheck, tint: '#f8fafc' },
  ];

  const activeOrder = activeId ? orders.find(o => o.id === activeId) || null : null;
  const activeExec = activeId ? execMap[activeId] : undefined;

  /* ── MANUAL PHOTO UPLOAD (Local State until submitted) ── */
  const uploadPhotoLocal = async (type: 'before' | 'after' | 'signature', file: File, replaceIndex?: number) => {
    if (!activeOrder) return;
    const slotKey = type === 'signature' ? 'signature' : replaceIndex !== undefined ? `${type}-${replaceIndex}` : `${type}-new`;
    setUploadingSlot(slotKey);

    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${activeOrder.id}/${type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;

      if (type === 'signature') {
        setLocalSignature(url);
      } else if (type === 'before') {
        const newArr = [...localBeforePhotos];
        if (replaceIndex !== undefined) newArr[replaceIndex] = url;
        else newArr.push(url);
        setLocalBeforePhotos(newArr);
      } else if (type === 'after') {
        const newArr = [...localAfterPhotos];
        if (replaceIndex !== undefined) newArr[replaceIndex] = url;
        else newArr.push(url);
        setLocalAfterPhotos(newArr);
      }
      setHasMediaChanges(true);
    } catch (err) {
      console.error(err);
      alert('Upload failed. Please check the file and try again.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const removePhotoLocal = (type: 'before' | 'after' | 'signature', index?: number) => {
    if (type === 'signature') {
      setLocalSignature('');
    } else if (type === 'before' && index !== undefined) {
      setLocalBeforePhotos(localBeforePhotos.filter((_, i) => i !== index));
    } else if (type === 'after' && index !== undefined) {
      setLocalAfterPhotos(localAfterPhotos.filter((_, i) => i !== index));
    }
    setHasMediaChanges(true);
  };

  /* ── MEDIA SUBMIT FUNCTION (Saves only images to DB) ── */
  const handleMediaSubmit = async () => {
    if (!activeOrder) return;
    setIsSubmitting(true);

    try {
      const payload = {
        before_photos: localBeforePhotos,
        after_photos: localAfterPhotos,
        signature_url: localSignature
      };

      const existing = execMap[activeOrder.id];
      let updatedExecRow: ExecRow | null = null;

      if (existing) {
        const { data, error } = await supabase.from('job_execution').update(payload).eq('order_id', activeOrder.id).select().single();
        if (error) throw error;
        if (data) updatedExecRow = data as ExecRow;
      } else {
        const { data, error } = await supabase.from('job_execution').insert({ order_id: activeOrder.id, ...payload }).select().single();
        if (error) throw error;
        if (data) updatedExecRow = data as ExecRow;
      }

      if (updatedExecRow) {
        setExecMap(prev => ({ ...prev, [activeOrder.id]: updatedExecRow! }));
      }

      setHasMediaChanges(false);
      alert('Media files saved successfully!');
      closeModal();
    } catch (error) {
      console.error("Error saving media:", error);
      alert('An error occurred while saving media. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Guards ── */
  if (unauthorized) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <ShieldCheck size={56} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Access Required</h2>
        <p className="text-sm text-gray-500 mb-6">You must be logged in as an administrator to view this page.</p>
        <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm" style={{ backgroundColor: '#8ED26B' }}>Go Back</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center overflow-hidden">
        <Loader2 size={40} className="animate-spin text-[#8ED26B] mb-4" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Generating Reports...</p>
      </div>
    );
  }

  /* ── Precompute derived values for modal view ── */
  let tStart: Date | null = null, tEnd: Date | null = null, wStart: Date | null = null, wEnd: Date | null = null;
  let pausedMs = 0, travelMs = 0, workedMs = 0, totalJobMs = 0;

  if (activeExec) {
    tStart = activeExec.travel_start_time ? new Date(activeExec.travel_start_time) : null;
    tEnd = activeExec.travel_end_time ? new Date(activeExec.travel_end_time) : null;
    wStart = activeExec.start_time ? new Date(activeExec.start_time) : null;
    wEnd = activeExec.end_time ? new Date(activeExec.end_time) : null;
    pausedMs = activeExec.total_paused_ms || 0;
    travelMs = activeExec.travel_duration_ms || (tStart && tEnd ? tEnd.getTime() - tStart.getTime() : 0);
    workedMs = activeExec.actual_worked_ms || (wStart && wEnd ? wEnd.getTime() - wStart.getTime() - pausedMs : 0);
    totalJobMs = tStart && wEnd ? wEnd.getTime() - tStart.getTime() : 0;
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] font-sans text-gray-800 pb-16 overflow-x-hidden">
      {/* Lightbox */}
      {imgModal.open && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={() => setImgModal({ open: false, src: '', label: '' })}>
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImgModal({ open: false, src: '', label: '' })} className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"><X size={20} /></button>
            <p className="text-sm font-bold text-white/70 text-center mb-3 uppercase tracking-wider">{imgModal.label}</p>
            <img src={imgModal.src} alt={imgModal.label} className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* ── Status Change Modal (two-step: confirm → mandatory reason) ── */}
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
                  Change job status from{' '}
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
                    onClick={confirmStatusChange}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: '#8ED26B' }}
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8ED26B] outline-none resize-none"
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
                    onClick={submitStatusChange}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{ backgroundColor: '#8ED26B' }}
                  >
                    {statusModal.saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Change'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 px-4 sm:px-6 lg:px-8 max-w-[96rem] mx-auto pt-8">
        <h1 className="text-2xl font-bold text-gray-900">Execution Reports</h1>
        <p className="text-sm text-gray-500 mt-1">System Overview & Analytics</p>
      </div>

       <main className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6 min-w-0">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const pct = total > 0 ? Math.round((stat.count / total) * 100) : 0;
            return (
              <div key={stat.id} className="relative flex items-center gap-3 p-4 sm:p-5 rounded-2xl border bg-white border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group">
                <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-70 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle, ${stat.tint} 0%, transparent 70%)` }} />
                <div className="relative flex items-center justify-center shrink-0">
                  <DonutRing value={stat.count} total={total} colorFrom={stat.from} colorTo={stat.to} gradientId={`grad-${stat.id}`} />
                  <div className="absolute flex items-center justify-center w-9 h-9 rounded-full" style={{ background: stat.tint }}><Icon size={16} style={{ color: stat.to }} strokeWidth={2.5} /></div>
                </div>
                <div className="relative z-10 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums leading-none">{stat.count}</h3>
                  <p className="text-xs font-bold text-gray-500 mt-1.5 truncate">{stat.label}</p>
                  <p className="text-[10px] font-bold mt-0.5" style={{ color: stat.to }}>{pct}% of total</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters Panel */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, customer, product, phone..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-[#8ED26B]/40 focus:border-[#8ED26B] focus:bg-white outline-none transition-all" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setFiltersOpen(!filtersOpen)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${filtersOpen || activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                <Filter size={16} /> Filters {activeFilterCount > 0 && <span className="bg-[#8ED26B] text-white text-[10px] px-1.5 py-0.5 rounded-md ml-1">{activeFilterCount}</span>}
              </button>
              {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors hidden sm:block">Clear</button>}
            </div>
          </div>
          {filtersOpen && (
            <div className="p-4 sm:p-5 bg-gray-50/50 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Service Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium bg-white outline-none focus:border-[#8ED26B]">
                  <option value="all">All Statuses</option>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Service Type</label>
                <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium bg-white outline-none focus:border-[#8ED26B]">
                  <option value="all">All Services</option>
                  {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Scheduled Date</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1 px-2.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium bg-white outline-none focus:border-[#8ED26B]" />
                  <span className="text-gray-300">-</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1 px-2.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium bg-white outline-none focus:border-[#8ED26B]" />
                </div>
              </div>
            </div>
          )}
        </section>

       {/* Reports Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-16 text-center">
            <Package size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">No execution records found</h3>
            <p className="text-sm text-gray-400">Try adjusting or clearing your filters.</p>
          </div>
        ) : (
          <>
            {/* MOBILE / TABLET */}
            <div className="lg:hidden space-y-3">
              {filteredOrders.map((order) => {
                const executorDetails = executorsMap[order.assigned_executor_id || ''];
                return (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex w-8 h-8 rounded-full bg-[#f4fcf0] border border-green-100 items-center justify-center shrink-0">
                          <User size={14} className="text-[#5aaa3a]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{order.customer_name || 'N/A'}</p>
                          <p className="text-xs text-gray-400 truncate">{order.product_name || '—'}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusStyles(order.status)}`}>
                        {order.status || 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-gray-100 pt-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Executor</p>
                        <p className="font-semibold text-gray-700 truncate">{order.assigned_executor_name || 'Unassigned'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Role</p>
                        <p className="font-semibold text-gray-700 truncate">{executorDetails?.role || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Area</p>
                        <p className="font-semibold text-gray-700 truncate">{order.city || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Response</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${responseStyles(order.executive_response)}`}>
                          {responseLabel(order.executive_response)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Email</p>
                        <p className="font-semibold text-gray-700 truncate">{executorDetails?.email || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                      <button onClick={() => openModal(order.id, 'view')} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                        <Eye size={14} /> View
                      </button>
                      <button onClick={() => openModal(order.id, 'manage')} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-gray-900 border border-gray-900 text-white hover:bg-gray-800 transition">
                        <Edit size={14} /> Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 shadow-sm w-full overflow-hidden">
              <table className="w-full table-fixed text-sm border-separate border-spacing-0">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-200 w-[23%]">Customer</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[12%]">Executor</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[7%]">Role</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[13%]">Email</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[7%]">Area</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[9%]">Job Status</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[9%]">Response</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-[20%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const executorDetails = executorsMap[order.assigned_executor_id || ''];
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 truncate">
                          <div className="flex items-center gap-2.5">
                            <div className="flex w-7 h-7 rounded-full bg-[#f4fcf0] border border-green-100 items-center justify-center shrink-0">
                              <User size={13} className="text-[#5aaa3a]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">{order.customer_name || 'N/A'}</p>
                              <p className="text-xs text-gray-400 truncate">{order.product_name || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 truncate">
                          {order.assigned_executor_name ? (
                            <span className="font-bold text-gray-700">{order.assigned_executor_name}</span>
                          ) : <span className="text-gray-400 font-normal">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 truncate">{executorDetails?.role || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 truncate">{executorDetails?.email || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 truncate">{order.city || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border inline-block whitespace-nowrap ${statusStyles(order.status)}`}>
                            {order.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border inline-block whitespace-nowrap ${responseStyles(order.executive_response)}`}>
                            {responseLabel(order.executive_response)}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openModal(order.id, 'view')} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
                              <Eye size={13} /> View
                            </button>
                            <button onClick={() => openModal(order.id, 'manage')} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-gray-900 border border-gray-900 text-white hover:bg-gray-800 transition whitespace-nowrap">
                              <Edit size={13} /> Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* ═══════════════════════════ MODAL WRAPPER ═══════════════════════════ */}
      {modalMode !== 'none' && activeOrder && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#f8fafc] w-full sm:max-w-5xl sm:rounded-2xl shadow-2xl h-full sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-10 h-10 rounded-full bg-[#f4fcf0] border border-green-100 items-center justify-center shrink-0">
                  {modalMode === 'view' ? <Eye size={18} className="text-[#5aaa3a]" /> : <Edit size={18} className="text-[#5aaa3a]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{modalMode === 'view' ? 'View Report' : 'Manage Execution'} • {activeOrder.order_id || activeOrder.id}</p>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 truncate">{activeOrder.customer_name || 'N/A'}</h2>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-6">

              {/* ──────────────── MANAGE MODE (AUTO-SAVE) ──────────────── */}
              {modalMode === 'manage' && (
                <div className="space-y-6">

                  <div className="grid grid-cols-1 gap-6">
                    {/* Order Status Manage Block */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Package size={14} className="text-orange-500" /> Job Status
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-600">Current Status:</span>
                        <select
                          value={localOrderStatus}
                          onChange={(e) => requestStatusChange(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold uppercase tracking-wider outline-none focus:border-[#8ED26B] bg-gray-50 flex-1"
                        >
                          <option value="pending">Pending</option>
                          <option value="travelling">Travelling</option>
                          <option value="reached">Reached</option>
                          <option value="work_started">Work Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Last Status Change Card */}
                  {activeOrder.status_reason && (
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
                          <AlertCircle size={14} /> Last Admin Override
                        </p>
                        {activeOrder.status_updated_at && (
                          <span className="text-[10px] font-bold text-amber-600 shrink-0">
                            {fmtDateTime(new Date(activeOrder.status_updated_at))}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-amber-800 font-medium">Status manually set to:</span>
                        <span className="px-2 py-1 bg-white border border-amber-200 text-amber-900 text-[10px] font-black uppercase rounded shadow-sm">
                          {statusLabel(activeOrder.status)}
                        </span>
                      </div>
                      <div className="bg-white/60 p-3 rounded-lg border border-amber-100">
                        <p className="text-sm text-amber-900 font-medium">
                          <span className="font-bold text-amber-700 block mb-0.5 text-xs">Reason provided:</span>
                          {activeOrder.status_reason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Executive Response Manage Block (manual admin override) */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <ThumbsUp size={14} className="text-teal-500" /> Executive Response
                    </h3>
                    <p className="text-[11px] text-gray-400 mb-4">Manually set the executive's acceptance decision for this order if it wasn't recorded through the app.</p>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">Decision:</span>
                      <select
                        value={localExecutiveResponse}
                        onChange={(e) => handleAutoSave('executive_response', e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold uppercase tracking-wider outline-none focus:border-[#8ED26B] bg-gray-50"
                      >
                        <option value="">Not Set</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    {localExecutiveResponse === 'rejected' && (
                      <div className="mt-4">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Rejection Reason</label>
                        <textarea
                          value={localRejectionReason}
                          onChange={(e) => setLocalRejectionReason(e.target.value)}
                          onBlur={(e) => handleAutoSave('rejection_reason', e.target.value)}
                          rows={3}
                          placeholder="Enter the reason the order was rejected..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8ED26B] outline-none resize-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Manual Timestamps Form */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Clock size={14} className="text-blue-500" /> Execution Timestamps</h3>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-4 -mt-2">Manually update the travel and working hours if the executor cannot log them via the app.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-3 p-4 rounded-xl border border-blue-50 bg-blue-50/20">
                        <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5"><Navigation size={14} /> Travel Phase</p>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Route Starting Time</label>
                          <input type="datetime-local" value={travelStartDT} onChange={(e) => handleAutoSave('travel_start', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8ED26B] outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Route Ending Time</label>
                          <input type="datetime-local" value={travelEndDT} onChange={(e) => handleAutoSave('travel_end', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8ED26B] outline-none" />
                        </div>
                      </div>

                      <div className="space-y-3 p-4 rounded-xl border border-green-50 bg-green-50/20">
                        <p className="text-xs font-bold text-green-800 flex items-center gap-1.5"><Hammer size={14} /> Work Phase</p>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Work Starting Time</label>
                          <input type="datetime-local" value={workStartDT} onChange={(e) => handleAutoSave('work_start', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8ED26B] outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Work Ending Time</label>
                          <input type="datetime-local" value={workEndDT} onChange={(e) => handleAutoSave('work_end', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8ED26B] outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual Photo Uploads */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><ImageIcon size={14} className="text-purple-500" /> Evidence Upload</h3>
                    <p className="text-[11px] text-gray-400 mb-5">Upload photos received from the technician. A minimum of 2 photos are required for both before and after.</p>

                    {[ { type: 'before', title: 'Before Work', arr: localBeforePhotos }, { type: 'after', title: 'After Completion', arr: localAfterPhotos } ].map(({ type, title, arr }) => {
                      const slots = Math.max(arr.length, 2);
                      const renderBlocks = [];

                      for (let i = 0; i < slots; i++) {
                        const hasImg = !!arr[i];
                        renderBlocks.push(
                          hasImg ? (
                            <div key={i} className="relative w-28 shrink-0 flex flex-col gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                              <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                <img src={arr[i]} alt={title} className="w-full h-full object-cover cursor-pointer" onClick={() => setImgModal({ open: true, src: arr[i], label: title })} />
                                {uploadingSlot === `${type}-${i}` && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <Loader2 size={18} className="text-white animate-spin" />
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between w-full">
                                <label className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1" title="Replace Image">
                                  <RefreshCw size={10} /> Replace
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhotoLocal(type as 'before'|'after', e.target.files[0], i); e.target.value = ''; }} />
                                </label>
                                <button onClick={() => removePhotoLocal(type as 'before'|'after', i)} className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1" title="Remove Image">
                                  <Trash2 size={10} /> Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label key={i} className="w-28 shrink-0 rounded-xl border-2 border-dashed border-red-300 hover:border-red-400 bg-red-50/50 flex flex-col items-center justify-center cursor-pointer transition-colors p-2 h-[126px]">
                              {uploadingSlot === `${type}-${i}` ? <Loader2 size={20} className="text-gray-400 animate-spin" /> : (
                                <>
                                  <UploadCloud size={20} className="text-red-400 mb-2" />
                                  <span className="text-[10px] font-bold text-red-500 text-center">Upload Required<br/>Image {i + 1}</span>
                                </>
                              )}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhotoLocal(type as 'before'|'after', e.target.files[0], i); e.target.value = ''; }} />
                            </label>
                          )
                        );
                      }

                      return (
                        <div key={type} className="mb-6 last:mb-0 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">{title} <span className={arr.length < 2 ? 'text-red-500' : 'text-green-500'}>({arr.length} / 2 Min)</span></p>
                          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                            {renderBlocks}
                            <label className="w-28 shrink-0 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#8ED26B] hover:bg-[#f4fcf0] flex flex-col items-center justify-center cursor-pointer transition-colors p-2 h-[126px]">
                              {uploadingSlot === `${type}-new` ? <Loader2 size={20} className="text-gray-400 animate-spin" /> : (
                                <><Plus size={20} className="text-gray-400 mb-2" /><span className="text-[10px] font-bold text-gray-500 text-center">Add Additional<br/>Image</span></>
                              )}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhotoLocal(type as 'before'|'after', e.target.files[0]); e.target.value = ''; }} />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual Signature Upload */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><PenLine size={14} className="text-[#8ED26B]" /> Signature Upload</h3>

                    {localSignature ? (
                      <div className="flex flex-col items-start gap-3 bg-gray-50 p-4 border border-gray-200 rounded-xl inline-block">
                        <img src={localSignature} alt="Signature" className="max-h-24 object-contain mix-blend-multiply bg-white rounded border border-gray-200 p-2" />
                        <button onClick={() => removePhotoLocal('signature')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-[10px] font-bold text-red-600 hover:bg-red-50 transition-colors">
                           <Trash2 size={12} /> Remove Signature
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full max-w-sm h-32 border-2 border-dashed border-gray-300 hover:border-[#8ED26B] rounded-xl cursor-pointer bg-gray-50 hover:bg-[#f4fcf0]/50 transition-colors">
                        {uploadingSlot === 'signature' ? (
                          <div className="flex flex-col items-center">
                            <Loader2 size={24} className="text-[#8ED26B] animate-spin mb-2" />
                            <span className="text-xs font-bold text-gray-500">Uploading...</span>
                          </div>
                        ) : (
                          <>
                            <UploadCloud size={24} className="text-gray-400 mb-2" />
                            <span className="text-sm font-bold text-gray-600">Click to Upload Signature</span>
                            <span className="text-[10px] text-gray-400 mt-1">PNG, JPG up to 5MB</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhotoLocal('signature', e.target.files[0]); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>

                  {/* ──────────────── MEDIA SUBMIT BUTTON ──────────────── */}
                  <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center justify-end gap-3 z-20">
                    <button onClick={closeModal} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                      {hasMediaChanges ? 'Cancel' : 'Close'}
                    </button>
                    {hasMediaChanges && (
                      <button
                        onClick={handleMediaSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm flex items-center gap-2 disabled:opacity-70 transition-colors hover:scale-[1.02]"
                        style={{ backgroundColor: '#8ED26B' }}
                      >
                        {isSubmitting ? (
                          <><Loader2 size={16} className="animate-spin" /> Saving Media...</>
                        ) : (
                          <><Save size={16} /> Submit Changes</>
                        )}
                      </button>
                    )}
                  </div>

                </div>
              )}

              {/* ──────────────── VIEW MODE (READ ONLY) ──────────────── */}
              {modalMode === 'view' && (
                <div className="space-y-6">
                  {/* Quick facts row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Hash size={10} /> Job ID</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{activeOrder.job_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><FileText size={10} /> Order ID</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{activeOrder.order_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><FileText size={10} /> Invoice No</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{activeOrder.invoice_no || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><CalendarDays size={10} /> Invoice Date</p>
                      <p className="text-sm font-medium text-gray-600 truncate">{activeOrder.invoice_date ? fmtDate(new Date(activeOrder.invoice_date)) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Hammer size={10} /> Executor</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{activeOrder.assigned_executor_name || 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><MapPin size={10} /> Area</p>
                      <p className="text-sm font-medium text-gray-600 truncate">{activeOrder.city || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Calendar size={10} /> Scheduled</p>
                      <p className="text-sm font-medium text-gray-600 truncate">{activeOrder.scheduled_date ? fmtDate(new Date(activeOrder.scheduled_date)) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Package size={10} /> Service</p>
                      <p className="text-sm font-medium text-gray-600 truncate">{activeOrder.type_of_service || 'N/A'}</p>
                    </div>
                  </div>

                  {activeExec && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><Navigation size={12} className="text-blue-500" /> Travel</span>
                        <span className="text-xl font-black text-gray-900 tabular-nums my-1">{fmtHuman(travelMs)}</span>
                        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1 text-[10px] font-medium text-gray-500">
                          <span className="flex justify-between"><span>Start:</span> <span className="text-gray-800">{fmtTime(tStart)}</span></span>
                          <span className="flex justify-between"><span>End:</span> <span className="text-gray-800">{fmtTime(tEnd)}</span></span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><Hammer size={12} className="text-[#8ED26B]" /> Work</span>
                        <span className="text-xl font-black text-gray-900 tabular-nums my-1">{fmtHuman(workedMs)}</span>
                        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1 text-[10px] font-medium text-gray-500">
                          <span className="flex justify-between"><span>Start:</span> <span className="text-gray-800">{fmtTime(wStart)}</span></span>
                          <span className="flex justify-between"><span>End:</span> <span className="text-gray-800">{fmtTime(wEnd)}</span></span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><PauseCircle size={12} className="text-amber-500" /> Paused</span>
                        <span className="text-xl font-black text-gray-900 tabular-nums my-1">{fmtHuman(pausedMs)}</span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><Clock size={12} className="text-purple-500" /> Total Duration</span>
                        <span className="text-xl font-black text-gray-900 tabular-nums my-1">{fmtHuman(totalJobMs)}</span>
                      </div>
                    </div>
                  )}

                  {/* READ ONLY Visual Proofs */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><ImageIcon size={14} className="text-purple-500" /> Visual Proofs</h3>

                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Before Work</p>
                      {activeExec?.before_photos && activeExec.before_photos.length > 0 ? (
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                          {activeExec?.before_photos?.map((src, i) => (
                            <img key={i} src={src} alt="Before" className="w-28 h-28 shrink-0 rounded-xl object-cover border border-gray-200 cursor-pointer" onClick={() => setImgModal({ open: true, src, label: 'Before Condition' })} />
                          ))}
                        </div>
                      ) : <p className="text-xs text-gray-400 italic">No before photos uploaded.</p>}
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">After Completion</p>
                      {activeExec?.after_photos && activeExec.after_photos.length > 0 ? (
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                          {activeExec?.after_photos?.map((src, i) => (
                            <img key={i} src={src} alt="After" className="w-28 h-28 shrink-0 rounded-xl object-cover border border-gray-200 cursor-pointer" onClick={() => setImgModal({ open: true, src, label: 'Finished Result' })} />
                          ))}
                        </div>
                      ) : <p className="text-xs text-gray-400 italic">No after photos uploaded.</p>}
                    </div>
                  </div>

                  {/* READ ONLY Signature */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><PenLine size={14} className="text-[#8ED26B]" /> Customer Signature</h3>
                    {activeExec?.signature_url ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center">
                        <img src={activeExec.signature_url} alt="Signature" className="max-h-24 object-contain mix-blend-multiply" />
                        {activeExec.signature_timestamp && <p className="text-[10px] text-gray-400 mt-2">Signed on {fmtDateTime(new Date(activeExec.signature_timestamp))}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No signature captured.</p>
                    )}
                  </div>

                  {/* READ ONLY Last Status Change */}
                  {activeOrder.status_reason && (
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
                          <AlertCircle size={14} /> Last Admin Override
                        </p>
                        {activeOrder.status_updated_at && (
                          <span className="text-[10px] font-bold text-amber-600 shrink-0">
                            {fmtDateTime(new Date(activeOrder.status_updated_at))}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-amber-800 font-medium">Status manually set to:</span>
                        <span className="px-2 py-1 bg-white border border-amber-200 text-amber-900 text-[10px] font-black uppercase rounded shadow-sm">
                          {statusLabel(activeOrder.status)}
                        </span>
                      </div>
                      <div className="bg-white/60 p-3 rounded-lg border border-amber-100">
                        <p className="text-sm text-amber-900 font-medium">
                          <span className="font-bold text-amber-700 block mb-0.5 text-xs">Reason provided:</span>
                          {activeOrder.status_reason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* READ ONLY Executive Response (bottom of status section) */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      {activeOrder.executive_response === 'rejected' ? <ThumbsDown size={14} className="text-red-500" /> : <ThumbsUp size={14} className="text-teal-500" />} Executive Response
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border inline-block ${responseStyles(activeOrder.executive_response)}`}>
                        {responseLabel(activeOrder.executive_response)}
                      </span>
                      {activeOrder.responded_at && (
                        <span className="text-[11px] text-gray-400">Responded on {fmtDateTime(new Date(activeOrder.responded_at))}</span>
                      )}
                    </div>
                    {activeOrder.executive_response === 'rejected' && activeOrder.rejection_reason && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Rejection Reason</p>
                        <p className="text-sm text-gray-700">{activeOrder.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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