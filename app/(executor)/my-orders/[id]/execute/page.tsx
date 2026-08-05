'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  ArrowLeft, Loader2, CheckCircle2, Camera, Image as ImageIcon,
  X, AlertTriangle, PenLine, RotateCcw, Package, Lock, MapPin,
  SwitchCamera, Circle, PauseCircle, MessageSquarePlus,
  ChevronDown, ChevronUp, Settings, Plus, Trash2, Navigation, Hammer,
  Route, Flag, FileText, Eye, ClipboardList, Phone, User, Info
} from 'lucide-react';

const MIN_PHOTOS = 2;
const GPS_INTERVAL_MS = 5 * 60 * 1000;
let globalLastPingTime = 0;

type Phase = 'idle' | 'traveling' | 'arrived' | 'working' | 'paused' | 'completed';

const PHASE_STEPS = [
  { key: 'traveling', label: 'Travel', icon: Navigation },
  { key: 'arrived', label: 'Arrive', icon: MapPin },
  { key: 'working', label: 'Work', icon: Hammer },
  { key: 'completed', label: 'Done', icon: CheckCircle2 },
];

const TRAVEL_NOTIFICATIONS = [
  { delay: 600, msg: 'Heading to the job location...', icon: Navigation },
  { delay: 8000, msg: 'On the way — GPS tracking is active', icon: Route },
  { delay: 20000, msg: 'Almost there, reaching soon!', icon: MapPin },
  { delay: 35000, msg: "We're near the location!", icon: Flag },
  { delay: 48000, msg: 'You should be at the location now. Tap "Mark as Arrived" below.', icon: CheckCircle2 },
];

/* ─── Utilities ────────────────────────────────────────────────────────────── */
const compressImage = (file: File, mw = 1280, q = 0.75): Promise<File> =>
  new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, mw / img.width);
      const c = document.createElement('canvas');
      c.width = img.width * s; c.height = img.height * s;
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); resolve(new File([b!], file.name, { type: 'image/jpeg' })); }, 'image/jpeg', q);
    };
    img.src = url;
  });

const fmtTimer = (ms: number) => {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtHuman = (ms: number) => {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 30) return `${m}m ${s}s`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
};

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ─── Reverse Geocode ─────────────────────────────────────────────────────── */
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=en`);
    const data = await res.json();
    return data?.display_name || '';
  } catch {
    return '';
  }
};

/* ─── Camera Modal ─────────────────────────────────────────────────────────── */
function CameraModal({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (f: File) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = async () => {
      setError(''); setStarting(true);
      try {
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      } catch (err: any) {
        setError(err?.name === 'NotAllowedError' ? 'Camera permission denied.' : err?.name === 'NotFoundError' ? 'No camera found.' : `Camera error: ${err?.message || err}`);
      } finally { setStarting(false); }
    };
    start();
    return () => { cancelled = true; if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; } };
  }, [open, facing]);

  const capture = async () => {
    const v = videoRef.current; if (!v || v.videoWidth === 0) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.9));
    if (!blob) return;
    onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20"><X size={20} /></button>
        <p className="text-sm font-bold uppercase tracking-wider">Camera</p>
        <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20"><SwitchCamera size={20} /></button>
      </div>
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {error ? <div className="text-center px-6 text-white"><AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" /><p className="text-sm font-semibold">{error}</p></div> : <video ref={videoRef} playsInline muted autoPlay className="max-h-full max-w-full object-contain" />}
        {starting && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 size={32} className="animate-spin text-white" /></div>}
      </div>
      <div className="flex items-center justify-center py-6 bg-black">
        <button onClick={capture} disabled={!!error || starting} className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:scale-95 active:scale-90 transition-transform disabled:opacity-40">
          <Circle size={56} className="text-gray-300" fill="white" />
        </button>
      </div>
    </div>
  );
}

/* ─── Section Header (shared) ──────────────────────────────────────────────── */
function SectionHeader({ icon, color, title, tag, action }: { icon: React.ReactNode; color: string; title: string; tag?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h2>
        {tag}
      </div>
      {action}
    </div>
  );
}

type PhotoItem = { id: string; file?: File; preview: string; url?: string };

/* ─── Photo Section ─────────────────────────────────────────────────────────── */
function PhotoSection({ title, hint, photos, onCameraAdd, onGalleryAdd, onRemove, onCameraRetake, onGalleryRetake, inputId, accent }: {
  title: string; hint: string; photos: PhotoItem[];
  onCameraAdd: () => void; onGalleryAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void; onCameraRetake: (i: number) => void; onGalleryRetake: (i: number) => void; inputId: string;
  accent?: 'green' | 'amber';
}) {
  const met = photos.length >= MIN_PHOTOS;
  const isAmber = accent === 'amber';
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-slate-200/40">
      <SectionHeader
        icon={<ImageIcon size={15} className={isAmber ? 'text-amber-500' : 'text-emerald-500'} />}
        color={isAmber ? 'bg-amber-50' : 'bg-emerald-50'}
        title={title}
        tag={<span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${met ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
          {photos.length}/{MIN_PHOTOS} {met && '✓'}
        </span>}
      />
      <p className="text-xs text-gray-400 font-medium mb-3 ml-[42px]">{hint}</p>
      <div className="grid grid-cols-3 xs:grid-cols-4 sm:flex sm:flex-wrap gap-3">
        {photos.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-1 items-center">
            <div className="relative w-full aspect-square sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => onRemove(i)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"><X size={12} /></button>
              {!p.url && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-white" /></div>}
            </div>
            <div className="flex gap-2 mt-0.5">
              <button onClick={() => onCameraRetake(i)} className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800"><Camera size={10} /> Retake</button>
              <span className="text-[10px] text-gray-300">|</span>
              <button onClick={() => onGalleryRetake(i)} className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800"><ImageIcon size={10} /> Replace</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={onCameraAdd} className="w-full aspect-square sm:w-28 sm:h-28 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-[#8ED26B] hover:text-[#5aaa3a] transition-colors cursor-pointer">
          <Camera size={22} /><span className="text-[10px] font-bold">Camera</span>
        </button>
        <label htmlFor={inputId} className="w-full aspect-square sm:w-28 sm:h-28 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer">
          <ImageIcon size={22} /><span className="text-[10px] font-bold">Gallery</span>
          <span className="text-[9px] text-gray-300 font-semibold">multi-select</span>
        </label>
        <input id={inputId} type="file" accept="image/*" multiple onChange={onGalleryAdd} className="hidden" />
      </div>
    </section>
  );
}

/* ─── Progress Updates ──────────────────────────────────────────────────────── */
function ProgressUpdates({ updates, onAdd, onRemove, disabled }: { updates: string[]; onAdd: (t: string) => void; onRemove: (i: number) => void; disabled: boolean }) {
  const [input, setInput] = useState('');
  const [exp, setExp] = useState(true);
  const submit = () => { if (!input.trim()) return; onAdd(input.trim()); setInput(''); };
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-slate-200/40">
      <button onClick={() => setExp(!exp)} className="w-full flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><MessageSquarePlus size={15} className="text-blue-500" /></div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Progress Updates</h2>
          {updates.length > 0 && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">{updates.length}</span>}
        </div>
        {exp ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
      </button>
      <p className="text-xs text-gray-400 font-medium mb-3 ml-[42px]">Log parts needed, findings, or follow-up tasks</p>
      {exp && (<>
        {updates.length > 0 && <div className="space-y-2 mb-3">{updates.map((u, i) => (
          <div key={i} className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5">
            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
            <p className="text-sm text-gray-700 font-medium flex-1 leading-snug">{u}</p>
            <button onClick={() => onRemove(i)} disabled={disabled} className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
          </div>
        ))}</div>}
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()} disabled={disabled} placeholder="e.g. Extra bracket needed, wiring issue found..." className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:opacity-50" />
          <button onClick={submit} disabled={disabled || !input.trim()} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-40 shrink-0"><Plus size={16} /> Add</button>
        </div>
      </>)}
    </section>
  );
}

/* ─── Phase Stepper (sidebar) ──────────────────────────────────────────────── */
function PhaseStepper({ phase }: { phase: Phase }) {
  const idxMap: Record<string, number> = { idle: -1, traveling: 0, arrived: 1, working: 2, paused: 2, completed: 3 };
  const current = idxMap[phase] ?? -1;
  return (
    <div className="flex flex-row lg:flex-col gap-0 overflow-x-auto lg:overflow-visible">
      {PHASE_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center lg:items-start gap-2 lg:gap-3 min-w-[80px] lg:min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-[#8ED26B] border-[#8ED26B] text-white ring-4 ring-[#8ED26B]/20' : 'bg-gray-50 border-gray-200 text-gray-300'
              }`}>
                {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
              </div>
              {i < PHASE_STEPS.length - 1 && <div className={`w-6 lg:w-0.5 h-0.5 lg:h-6 mt-1 lg:mt-2 rounded-full ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
            <span className={`text-[11px] font-bold whitespace-nowrap lg:whitespace-normal ${done ? 'text-green-600' : active ? 'text-gray-800' : 'text-gray-300'}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Job Info Card ───────────────── */
function JobInfoCard({ order }: { order: any }) {
  const address = order?.address || order?.location || '';
  return (
    <div className="space-y-6 anim-fade">
      <section className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-gray-100 p-6 sm:p-7 shadow-sm shadow-slate-200/40">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#8ED26B]/15 flex items-center justify-center shrink-0">
            <ClipboardList size={22} className="text-[#5aaa3a]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Job Summary</p>
            <h3 className="text-lg font-black text-gray-900 truncate">{order?.product_name || 'Service Job'}</h3>
            <p className="text-sm text-gray-500 mt-1">Follow the steps to complete this job — travel, arrive, work, and wrap up.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5">
            <MapPin size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</p>
              <p className="text-sm font-semibold text-gray-700 truncate">{address || 'Not provided'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5">
            <User size={16} className="text-blue-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</p>
              <p className="text-sm font-semibold text-gray-700 truncate">{order?.customer_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5">
            <Phone size={16} className="text-green-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact</p>
              <p className="text-sm font-semibold text-gray-700 truncate">{order?.customer_phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5">
            <Package size={16} className="text-purple-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order ID</p>
              <p className="text-sm font-semibold text-gray-700 truncate">{order?.job_id || order?.order_id || '—'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm shadow-slate-200/40">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Info size={15} className="text-blue-500" /></div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">How This Works</h2>
        </div>
        <ol className="space-y-3">
          {[
            { icon: Navigation, text: 'Start your journey — we track travel time and GPS automatically.' },
            { icon: MapPin, text: 'Mark as arrived once you reach the job location.' },
            { icon: Camera, text: 'Take before photos, then start work on the job.' },
            { icon: PenLine, text: 'Wrap up with after photos and the customer\'s signature.' },
          ].map((step, i) => {
            const StepIcon = step.icon;
            return (
              <li key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 text-[11px] font-black text-gray-500">{i + 1}</div>
                <div className="flex items-center gap-2 pt-0.5">
                  <StepIcon size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-600 font-medium leading-snug">{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/* ─── Issue / Reason Reports (optional, shown once work has started) ───────── */
type ReportedIssue = { id: string; reason: string; note: string; photo: { file: File; preview: string } | null };
const ISSUE_PRESETS = ['Defective Product', 'Installation Issue', 'Missing Piece'];

function IssueReportSection({ issues, onAdd, onRemove }: { issues: ReportedIssue[]; onAdd: (i: ReportedIssue) => void; onRemove: (id: string) => void }) {
  const [exp, setExp] = useState(false);
  const [activeReason, setActiveReason] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const camInputRef = useRef<HTMLInputElement | null>(null);
  const galInputRef = useRef<HTMLInputElement | null>(null);

  const isOther = activeReason === 'Other Reason';
  const reasonLabel = isOther ? customText.trim() : (activeReason || '');

  const resetComposer = () => { setActiveReason(null); setCustomText(''); setNote(''); setPhoto(null); };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const c = await compressImage(f);
    setPhoto({ file: c, preview: URL.createObjectURL(c) });
    e.target.value = '';
  };

  const submit = () => {
    if (!reasonLabel || !photo) return;
    onAdd({ id: `issue-${Date.now()}-${Math.random()}`, reason: reasonLabel, note: note.trim(), photo });
    resetComposer();
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-slate-200/40">
      <button onClick={() => setExp(!exp)} className="w-full flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><AlertTriangle size={15} className="text-red-500" /></div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report an Issue</h2>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">Optional</span>
          {issues.length > 0 && <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-md border border-red-100">{issues.length}</span>}
        </div>
        {exp ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
      </button>
      <p className="text-xs text-gray-400 font-medium mb-3 ml-[42px]">Flag a defective product, installation problem, or missing piece — a photo is required, notes are optional</p>

      {exp && (<>
        {issues.length > 0 && (
          <div className="space-y-2 mb-3">
            {issues.map((it) => (
              <div key={it.id} className="flex items-start gap-3 bg-red-50/50 border border-red-100 rounded-xl px-3 py-2.5">
                {it.photo && <img src={it.photo.preview} alt={it.reason} className="w-12 h-12 rounded-lg object-cover border border-red-100 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800">{it.reason}</p>
                  {it.note && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{it.note}</p>}
                </div>
                <button onClick={() => onRemove(it.id)} className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {!activeReason ? (
          <div className="flex flex-wrap gap-2">
            {ISSUE_PRESETS.map((r) => (
              <button key={r} type="button" onClick={() => setActiveReason(r)} className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                {r}
              </button>
            ))}
            <button type="button" onClick={() => setActiveReason('Other Reason')} className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-500 bg-white border-2 border-dashed border-gray-200 hover:border-red-300 hover:text-red-600 transition-colors">
              Other Reason
            </button>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">{isOther ? 'Other Reason' : activeReason}</span>
              <button onClick={resetComposer} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>

            {isOther && (
              <input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Type the reason..." className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300" />
            )}

            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add details (optional)..." className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 resize-none" />

            <div className="flex items-center gap-2">
              {photo ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                  <img src={photo.preview} alt="Issue" className="w-full h-full object-cover" />
                  <button onClick={() => setPhoto(null)} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-600"><X size={10} /></button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => camInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-500 bg-white border border-gray-200 hover:border-gray-300"><Camera size={13} /> Camera</button>
                  <button type="button" onClick={() => galInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-500 bg-white border border-gray-200 hover:border-gray-300"><ImageIcon size={13} /> Gallery</button>
                  <span className="text-[10px] text-red-500 font-bold">Photo required</span>
                </>
              )}
              <input ref={camInputRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="hidden" />
              <input ref={galInputRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
            </div>

            <button onClick={submit} disabled={!reasonLabel || !photo} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"><Plus size={15} /> Add Issue</button>
          </div>
        )}
      </>)}
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ─── Main Page ─────────────────────────────────────────────────────────────── */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function JobExecutionPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  /* ── Core state ── */
  const [order, setOrder] = useState<any>(null);
  const [execRec, setExecRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /* ── Phase ── */
  const [phase, setPhase] = useState<Phase>('idle');

  /* ── Travel ── */
  const [travelStart, setTravelStart] = useState<Date | null>(null);
  const travelStartRef = useRef<Date | null>(null);
  const [travelEnd, setTravelEnd] = useState<Date | null>(null);
  const [travelDurMs, setTravelDurMs] = useState(0);
  const [travelDisplay, setTravelDisplay] = useState('00:00');

  /* ── Work timer ── */
  const [workStart, setWorkStart] = useState<Date | null>(null);
  const workStartRef = useRef<Date | null>(null);
  const [workEnd, setWorkEnd] = useState<Date | null>(null);
  const [workPaused, setWorkPaused] = useState(false);
  const [pauseStart, setPauseStart] = useState<Date | null>(null);
  const pauseStartRef = useRef<Date | null>(null);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [workDisplay, setWorkDisplay] = useState('00:00');

  /* ── Photos (Now persist immediately to DB) ── */
  const [beforePhotos, setBeforePhotos] = useState<PhotoItem[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<PhotoItem[]>([]);
  
  const beforePhotosRef = useRef(beforePhotos);
  useEffect(() => { beforePhotosRef.current = beforePhotos; }, [beforePhotos]);
  
  const afterPhotosRef = useRef(afterPhotos);
  useEffect(() => { afterPhotosRef.current = afterPhotos; }, [afterPhotos]);

  /* ── Progress & Notes ── */
  const [progressUpdates, setProgressUpdates] = useState<string[]>([]);
  const [execNotes, setExecNotes] = useState('');
  const [travelIssueNotes, setTravelIssueNotes] = useState('');

  /* ── Reported Issues (optional — defective/installation/missing piece, with optional photo) ── */
  const [reportedIssues, setReportedIssues] = useState<ReportedIssue[]>([]);

  /* ── Timer UI is intentionally hidden from the executor (still tracked/saved as before for admin) ── */
  const SHOW_TIMER_UI = false;

  /* ── Signature ── */
  const [hasSig, setHasSig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  /* ── Notifications ── */
  const [toasts, setToasts] = useState<{ id: string; msg: string; icon: React.ReactNode }[]>([]);
  const toastTimers = useRef<NodeJS.Timeout[]>([]);

  /* ── Submission ── */
  const [submitting, setSubmitting] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [actionError, setActionError] = useState('');

  /* ── GPS ── */
  const gpsRef = useRef<NodeJS.Timeout | null>(null);
  const [gpsOn, setGpsOn] = useState(false);

  /* ── Camera ── */
  const [camOpen, setCamOpen] = useState(false);
  const camTarget = useRef<{ mode: 'add' | 'retake'; type: 'before' | 'after'; index?: number } | null>(null);
  const retakeRef = useRef<HTMLInputElement | null>(null);
  const retakeTarget = useRef<{ type: 'before' | 'after'; index: number } | null>(null);

  /* ── Notes expanded ── */
  const [notesExp, setNotesExp] = useState(true);

  /* ── Wrap-up step: reveals After Photos + Signature once work is finished ── */
  const [finishingUp, setFinishingUp] = useState(false);

  /* ── Confirm Preview Modal ── */
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [previewLocName, setPreviewLocName] = useState('');
  const [previewLocLoading, setPreviewLocLoading] = useState(false);
  const [sigPreviewUrl, setSigPreviewUrl] = useState('');

  /* ── Location name for completed dashboard ── */
  const [locationName, setLocationName] = useState('');

  /* ─── Timer Effect ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const interval = setInterval(() => {
      if (phase === 'traveling' && travelStartRef.current) {
        setTravelDisplay(fmtTimer(Date.now() - travelStartRef.current.getTime()));
      }
      if ((phase === 'working' || phase === 'paused') && workStartRef.current) {
        const paused = phase === 'paused' && pauseStartRef.current ? totalPausedMs + (Date.now() - pauseStartRef.current.getTime()) : totalPausedMs;
        setWorkDisplay(fmtTimer(Math.max(0, Date.now() - workStartRef.current.getTime() - paused)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, totalPausedMs]);

  /* ─── GPS ───────────────────────────────────────────────────────────────── */
  const pingGps = async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - globalLastPingTime < 10000) return;
    globalLastPingTime = now;
    try {
      await supabase.from('job_locations').insert({ order_id: orderId, latitude: lat, longitude: lng, recorded_at: new Date().toISOString() });
    } catch {
      // GPS ping failed silently — non-critical
    }
  };

  const startGps = () => {
    if (!navigator.geolocation || gpsRef.current) return;
    setGpsOn(true);
    navigator.geolocation.getCurrentPosition((p) => pingGps(p.coords.latitude, p.coords.longitude), () => {});
    gpsRef.current = setInterval(() => navigator.geolocation.getCurrentPosition((p) => pingGps(p.coords.latitude, p.coords.longitude), () => {}), GPS_INTERVAL_MS);
  };
  const stopGps = () => { if (gpsRef.current) { clearInterval(gpsRef.current); gpsRef.current = null; } setGpsOn(false); };
  useEffect(() => () => stopGps(), []);

  const getLoc = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((r) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => r({ lat: p.coords.latitude, lng: p.coords.longitude }), () => r(null), { timeout: 8000 }) : r(null));

  /* ─── Toast System ──────────────────────────────────────────────────────── */
  const addToast = (msg: string, icon: React.ReactNode) => {
    const id = `t-${Date.now()}-${Math.random()}`;
    setToasts((p) => [...p.slice(-2), { id, msg, icon }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  };

  const fireTravelNotifications = () => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
    TRAVEL_NOTIFICATIONS.forEach((n) => {
      const t = setTimeout(() => {
        if (n.icon === Navigation) addToast(n.msg, <Navigation size={16} className="text-blue-500" />);
        else if (n.icon === Route) addToast(n.msg, <Route size={16} className="text-indigo-500" />);
        else if (n.icon === MapPin) addToast(n.msg, <MapPin size={16} className="text-amber-500" />);
        else if (n.icon === Flag) addToast(n.msg, <Flag size={16} className="text-orange-500" />);
        else addToast(n.msg, <CheckCircle2 size={16} className="text-green-500" />);
      }, n.delay);
      toastTimers.current.push(t);
    });
  };

  /* ─── Fetch location name for completed dashboard ──────────────────────── */
  useEffect(() => {
    if (phase === 'completed' && execRec?.signature_latitude && execRec?.signature_longitude && !locationName) {
      reverseGeocode(execRec.signature_latitude, execRec.signature_longitude).then((name) => {
        if (name) setLocationName(name);
      });
    }
  }, [phase, execRec?.signature_latitude, execRec?.signature_longitude]);

  /* ─── Data Fetch ────────────────────────────────────────────────────────── */
  useEffect(() => { if (orderId) fetchOrder(); }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (error || !data) { setNotFound(true); setLoading(false); return; }
    setOrder(data);

    let exData: any = null;
    const { data: existingEx } = await supabase.from('job_execution').select('*').eq('order_id', orderId).maybeSingle();
    if (existingEx) {
      exData = existingEx;
    } else {
      const { data: newEx } = await supabase.from('job_execution').insert({ order_id: orderId }).select().single();
      exData = newEx;
    }

    let p: Phase = 'idle';

    if (exData) {
      setExecRec(exData);
      if (exData.execution_notes) setExecNotes(exData.execution_notes);
      if (exData.progress_updates) setProgressUpdates(exData.progress_updates);
      setTotalPausedMs(exData.total_paused_ms || 0);

      // Load saved photos from DB into state
      if (exData.before_photos) {
        setBeforePhotos(exData.before_photos.map((url: string) => ({ id: `db-${url}`, preview: url, url })));
      }
      if (exData.after_photos) {
        setAfterPhotos(exData.after_photos.map((url: string) => ({ id: `db-${url}`, preview: url, url })));
      }

      if (exData.end_time) {
        p = 'completed';
        setWorkEnd(new Date(exData.end_time));
      } else if (exData.start_time) {
        const st = new Date(exData.start_time);
        workStartRef.current = st; setWorkStart(st);
        p = exData.is_paused ? 'paused' : 'working';
        if (exData.is_paused && exData.paused_at) { const pt = new Date(exData.paused_at); pauseStartRef.current = pt; setPauseStart(pt); }
      } else if (exData.travel_end_time) {
        p = 'arrived';
        if (exData.travel_start_time) { const ts = new Date(exData.travel_start_time); travelStartRef.current = ts; setTravelStart(ts); }
        setTravelEnd(new Date(exData.travel_end_time));
        setTravelDurMs(exData.travel_duration_ms || 0);
        setTravelDisplay(fmtTimer(exData.travel_duration_ms || 0));
      } else if (exData.travel_start_time) {
        p = 'traveling';
        const ts = new Date(exData.travel_start_time);
        travelStartRef.current = ts; setTravelStart(ts);
      }
    }

    const status = (data.status || '').toLowerCase();
    if (status === 'completed' || status === 'done') p = 'completed';

    setPhase(p);
    if (p === 'working' || p === 'traveling') startGps();
    if (p === 'traveling') fireTravelNotifications();
    setLoading(false);
  };

  /* ─── Actions ───────────────────────────────────────────────────────────── */

  const handleMarkArrived = async () => {
    if (submitting || phase !== 'traveling') return;
    setSubmitting(true); setActionError('');
    toastTimers.current.forEach(clearTimeout); toastTimers.current = [];
    const now = new Date();
    const dur = travelStartRef.current ? now.getTime() - travelStartRef.current.getTime() : 0;

    const { error } = await supabase.from('job_execution').update({
      travel_end_time: now.toISOString(), travel_duration_ms: dur
    }).eq('order_id', orderId);
    if (error) { setActionError(error.message); setSubmitting(false); return; }

    travelStartRef.current = travelStart; setTravelEnd(now); setTravelDurMs(dur);
    setTravelDisplay(fmtTimer(dur)); setPhase('arrived');
    setExecRec((pr: any) => ({ ...pr, travel_end_time: now.toISOString(), travel_duration_ms: dur }));
    setSubmitting(false);
  };

  const handleStartWork = async () => {
    if (submitting || phase !== 'arrived' || beforePhotos.length < MIN_PHOTOS) return;
    setSubmitting(true); setActionError('');
    const now = new Date();
    const { error } = await supabase.from('job_execution').update({ start_time: now.toISOString() }).eq('order_id', orderId);
    if (error) { setActionError(error.message); setSubmitting(false); return; }

    workStartRef.current = now; setWorkStart(now);
    setPhase('working'); startGps();
    setExecRec((pr: any) => ({ ...pr, start_time: now.toISOString() }));
    setSubmitting(false);
  };

  const handlePauseResume = async () => {
    if (phase !== 'working' && phase !== 'paused') return;
    if (phase === 'working') {
      const now = new Date();
      pauseStartRef.current = now; setPauseStart(now); setWorkPaused(true); setPhase('paused'); stopGps();
      await supabase.from('job_execution').update({ paused_at: now.toISOString(), is_paused: true }).eq('order_id', orderId);
    } else {
      const now = new Date();
      const dur = pauseStartRef.current ? now.getTime() - pauseStartRef.current.getTime() : 0;
      const newTotal = totalPausedMs + dur;
      setTotalPausedMs(newTotal); pauseStartRef.current = null; setPauseStart(null); setWorkPaused(false); setPhase('working'); startGps();
      await supabase.from('job_execution').update({ resumed_at: now.toISOString(), is_paused: false, total_paused_ms: newTotal }).eq('order_id', orderId);
    }
  };

  /* ── Photo DB Sync Helpers ── */
  const uploadSinglePhoto = async (type: 'before' | 'after', item: PhotoItem): Promise<PhotoItem> => {
    if (!item.file) return item;
    try {
      const ext = item.file.name.split('.').pop() || 'jpg';
      const path = `${orderId}/${type}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from('job-proofs').upload(path, item.file);
      if (error) throw error;
      const url = supabase.storage.from('job-proofs').getPublicUrl(path).data.publicUrl;
      return { ...item, url, file: undefined };
    } catch (err) {
      console.error('Upload failed', err);
      return item;
    }
  };

  const syncPhotosToDb = async (type: 'before' | 'after', currentPhotos: PhotoItem[]) => {
    const urls = currentPhotos.map(p => p.url).filter(Boolean) as string[];
    const updateObj = type === 'before' ? { before_photos: urls } : { after_photos: urls };
    try {
      await supabase.from('job_execution').update(updateObj).eq('order_id', orderId);
    } catch (err) {
      console.error("Failed to sync photos", err);
    }
  };

  /* ── Photos ── */
  const handleGallery = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = e.target.files; if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImage(f)));
    const newItems: PhotoItem[] = compressed.map((c) => ({
      id: `${type}-${Date.now()}-${Math.random()}`,
      file: c,
      preview: URL.createObjectURL(c)
    }));

    if (type === 'before') setBeforePhotos((pr) => [...pr, ...newItems]);
    else setAfterPhotos((pr) => [...pr, ...newItems]);

    for (const item of newItems) {
      const uploadedItem = await uploadSinglePhoto(type, item);
      if (type === 'before') {
        setBeforePhotos((pr) => {
          const updated = pr.map(p => p.id === item.id ? uploadedItem : p);
          syncPhotosToDb('before', updated);
          return updated;
        });
      } else {
        setAfterPhotos((pr) => {
          const updated = pr.map(p => p.id === item.id ? uploadedItem : p);
          syncPhotosToDb('after', updated);
          return updated;
        });
      }
    }
    e.target.value = '';
  };

  const openCam = (mode: 'add' | 'retake', type: 'before' | 'after', index?: number) => { camTarget.current = { mode, type, index }; setCamOpen(true); };
  
  const handleCamCapture = async (raw: File) => {
    const c = await compressImage(raw); 
    const p = URL.createObjectURL(c); 
    const t = camTarget.current; 
    if (!t) return;

    const newItem: PhotoItem = { id: `${t.type}-${Date.now()}-${Math.random()}`, file: c, preview: p };

    if (t.mode === 'add') {
      if (t.type === 'before') setBeforePhotos((pr) => [...pr, newItem]);
      else setAfterPhotos((pr) => [...pr, newItem]);
    } else if (t.index !== undefined) {
      if (t.type === 'before') setBeforePhotos((pr) => pr.map((ph, i) => i === t.index ? newItem : ph));
      else setAfterPhotos((pr) => pr.map((ph, i) => i === t.index ? newItem : ph));
    }
    camTarget.current = null;

    const uploadedItem = await uploadSinglePhoto(t.type, newItem);
    if (t.type === 'before') {
      setBeforePhotos((pr) => {
        const updated = pr.map(p => p.id === newItem.id ? uploadedItem : p);
        syncPhotosToDb('before', updated);
        return updated;
      });
    } else {
      setAfterPhotos((pr) => {
        const updated = pr.map(p => p.id === newItem.id ? uploadedItem : p);
        syncPhotosToDb('after', updated);
        return updated;
      });
    }
  };

  const handleRetakeGal = (type: 'before' | 'after', i: number) => { retakeTarget.current = { type, index: i }; retakeRef.current?.click(); };
  
  const handleRetakeGalSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !retakeTarget.current) return;
    const c = await compressImage(f); const p = URL.createObjectURL(c); 
    const { type, index } = retakeTarget.current;
    
    const newItem: PhotoItem = { id: `${type}-${Date.now()}-${Math.random()}`, file: c, preview: p };
    
    if (type === 'before') setBeforePhotos((pr) => pr.map((ph, i) => i === index ? newItem : ph));
    else setAfterPhotos((pr) => pr.map((ph, i) => i === index ? newItem : ph));
    
    retakeTarget.current = null; e.target.value = '';

    const uploadedItem = await uploadSinglePhoto(type, newItem);
    if (type === 'before') {
      setBeforePhotos((pr) => {
        const updated = pr.map(p => p.id === newItem.id ? uploadedItem : p);
        syncPhotosToDb('before', updated);
        return updated;
      });
    } else {
      setAfterPhotos((pr) => {
        const updated = pr.map(p => p.id === newItem.id ? uploadedItem : p);
        syncPhotosToDb('after', updated);
        return updated;
      });
    }
  };

  const removePhoto = async (type: 'before' | 'after', i: number) => {
    if (type === 'before') {
      setBeforePhotos((pr) => {
        const updated = pr.filter((_, idx) => idx !== i);
        syncPhotosToDb('before', updated);
        return updated;
      });
    } else {
      setAfterPhotos((pr) => {
        const updated = pr.filter((_, idx) => idx !== i);
        syncPhotosToDb('after', updated);
        return updated;
      });
    }
  };

  /* ── Signature ── */
  const getPtr = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => { if (phase !== 'working' && phase !== 'paused') return; isDrawing.current = true; const c = canvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); const p = getPtr(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!isDrawing.current) return; const c = canvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return; const p = getPtr(e); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f2937'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => { 
    if (!isDrawing.current) return; 
    isDrawing.current = false; 
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ } 
    const c = canvasRef.current; 
    const ctx = c?.getContext('2d'); 
    if (c && ctx) {
      const imgData = ctx.getImageData(0, 0, c.width, c.height).data;
      const hasContent = imgData.some((pixel, index) => index % 4 === 3 && pixel > 0);
      if (hasContent) setHasSig(true);
    }
  };
  
  const clearSig = () => { const c = canvasRef.current; const ctx = c?.getContext('2d'); if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); ctx.beginPath(); } setHasSig(false); };

  /* ── Complete — opens preview modal ── */
  const isUploading = beforePhotos.some(p => !p.url) || afterPhotos.some(p => !p.url);
  const canComplete = beforePhotos.length >= MIN_PHOTOS && afterPhotos.length >= MIN_PHOTOS && hasSig && !isUploading;

  const handleComplete = async () => {
    if (!canComplete) { 
      let msg = 'Missing requirements: ';
      if (beforePhotos.length < MIN_PHOTOS) msg += `${MIN_PHOTOS} before photos, `;
      if (afterPhotos.length < MIN_PHOTOS) msg += `${MIN_PHOTOS - afterPhotos.length} after photo(s), `;
      if (!hasSig) msg += 'customer signature, ';
      msg = msg.slice(0, -2) + '.';
      setActionError(msg); 
      return; 
    }
    setActionError('');
    setPreviewLocName('');
    setPreviewLocLoading(true);
    setConfirmModalOpen(true);

    if (canvasRef.current) {
      setSigPreviewUrl(canvasRef.current.toDataURL('image/png'));
    }

    const loc = await getLoc();
    if (loc) {
      const name = await reverseGeocode(loc.lat, loc.lng);
      if (name) setPreviewLocName(name);
    }
    setPreviewLocLoading(false);
  };

  /* ── Actual submission (after confirm) ── */
  const executeSubmit = async () => {
    setConfirmModalOpen(false);
    setSubmitting(true); setUploadStage('Uploading signature...');
    try {
      const bUrls = beforePhotos.map(p => p.url).filter(Boolean) as string[];
      const aUrls = afterPhotos.map(p => p.url).filter(Boolean) as string[];

      const c = canvasRef.current; if (!c) throw new Error('Signature missing.');
      const blob: Blob | null = await new Promise((r) => c.toBlob((b) => r(b), 'image/png'));
      if (!blob) throw new Error('Could not read signature.');
      const sigPath = `${orderId}/signature-${Date.now()}.png`;
      const { error: sErr } = await supabase.storage.from('job-proofs').upload(sigPath, blob, { contentType: 'image/png' });
      if (sErr) throw new Error(`Signature: ${sErr.message}`);
      const sigUrl = supabase.storage.from('job-proofs').getPublicUrl(sigPath).data.publicUrl;

      setUploadStage('Uploading issue reports...');
      const issueReportsPayload: { reason: string; note: string; photo_url: string | null }[] = [];
      for (let i = 0; i < reportedIssues.length; i++) {
        const it = reportedIssues[i];
        let photoUrl: string | null = null;
        if (it.photo) {
          const ext = it.photo.file.name.split('.').pop() || 'jpg';
          const path = `${orderId}/issue-${Date.now()}-${i}.${ext}`;
          const { error: e } = await supabase.storage.from('job-proofs').upload(path, it.photo.file);
          if (!e) photoUrl = supabase.storage.from('job-proofs').getPublicUrl(path).data.publicUrl;
        }
        issueReportsPayload.push({ reason: it.reason, note: it.note, photo_url: photoUrl });
      }

      setUploadStage('Saving job record...');
      const finishedAt = new Date();
      const loc = await getLoc();
      const paused = (phase === 'paused' && pauseStartRef.current) ? totalPausedMs + (Date.now() - pauseStartRef.current.getTime()) : totalPausedMs;
      const workedMs = workStartRef.current ? finishedAt.getTime() - workStartRef.current.getTime() - paused : null;

      const finalCombinedNotes = [
        travelIssueNotes.trim() ? `[Travel Notes]: ${travelIssueNotes.trim()}` : '',
        execNotes.trim(),
      ].filter(Boolean).join('\n\n');

      const { data: exD, error: exE } = await supabase.from('job_execution').update({
        before_photos: bUrls, after_photos: aUrls, signature_url: sigUrl,
        signature_timestamp: finishedAt.toISOString(), signature_latitude: loc?.lat ?? null, signature_longitude: loc?.lng ?? null,
        end_time: finishedAt.toISOString(), execution_notes: finalCombinedNotes || null,
        progress_updates: progressUpdates.length > 0 ? progressUpdates : null,
        reported_issues: issueReportsPayload.length > 0 ? issueReportsPayload : null,
        total_paused_ms: totalPausedMs, actual_worked_ms: workedMs, is_paused: false,
      }).eq('order_id', orderId).select().single();
      if (exE) throw new Error(exE.message);

      const { error: stE } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
      if (stE) throw new Error(stE.message);

      if (previewLocName) setLocationName(previewLocName);

      setExecRec(exD); setWorkEnd(finishedAt); setPhase('completed');
      setOrder((pr: any) => ({ ...pr, status: 'completed' })); stopGps();
    } catch (err: any) { setActionError(err.message || 'Could not complete job.'); } finally { setUploadStage(''); setSubmitting(false); }
  };

  /* ─── Gate Renders ──────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
      <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Job...</p>
    </div>
  );
  if (notFound || !order) return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-center px-6">
      <Package size={56} className="text-gray-200 mb-4" />
      <h2 className="text-lg font-bold text-gray-700 mb-2">Job Not Found</h2>
      <Link href="/my-orders" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm mt-4" style={{ backgroundColor: '#8ED26B' }}><ArrowLeft size={16} /> Back to Dashboard</Link>
    </div>
  );
  if (order.executive_response !== 'accepted') return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-center px-6">
      <Lock size={48} className="text-gray-300 mb-4" />
      <h2 className="text-lg font-bold text-gray-700 mb-2">Accept This Job First</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm">Accept this job from the Job Detail page before execution.</p>
      <Link href={`/my-orders/${orderId}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm" style={{ backgroundColor: '#8ED26B' }}><ArrowLeft size={16} /> Go to Job Detail</Link>
    </div>
  );

  /* ─── Computed values for completion dashboard ── */
  const dbBeforePhotos = execRec?.before_photos || [];
  const dbAfterPhotos = execRec?.after_photos || [];
  const dbSigUrl = execRec?.signature_url || '';
  const dbTravelStart = execRec?.travel_start_time ? new Date(execRec.travel_start_time) : travelStart;
  const dbTravelEnd = execRec?.travel_end_time ? new Date(execRec.travel_end_time) : travelEnd;
  const dbTravelDur = execRec?.travel_duration_ms || travelDurMs;
  const dbWorkStart = execRec?.start_time ? new Date(execRec.start_time) : workStart;
  const dbWorkEnd = execRec?.end_time ? new Date(execRec.end_time) : workEnd;
  const dbPausedMs = execRec?.total_paused_ms || totalPausedMs;
  const dbWorkedMs = execRec?.actual_worked_ms || (dbWorkStart && dbWorkEnd ? dbWorkEnd.getTime() - dbWorkStart.getTime() - dbPausedMs : 0);
  const dbNotes = execRec?.execution_notes || execNotes;
  const dbUpdates = execRec?.progress_updates || progressUpdates;
  const dbReportedIssues: { reason: string; note: string; photo_url: string | null }[] = execRec?.reported_issues || [];

  const showBeforeImgs: string[] = phase === 'completed' && dbBeforePhotos.length > 0 ? dbBeforePhotos : beforePhotos.map(p => p.preview);
  const showAfterImgs: string[] = phase === 'completed' && dbAfterPhotos.length > 0 ? dbAfterPhotos : afterPhotos.map(p => p.preview);

  /* ─── Preview computed values ── */
  const previewPaused = (phase === 'paused' && pauseStartRef.current) ? totalPausedMs + (Date.now() - pauseStartRef.current.getTime()) : totalPausedMs;
  const previewWorkMs = workStartRef.current ? Date.now() - workStartRef.current.getTime() - previewPaused : 0;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /* ─── RENDER ────────────────────────────────────────────────────────────── */
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-gray-800">
      <style>{`
        @keyframes slideInR { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .anim-slide { animation: slideInR 0.35s ease-out; }
        .anim-fade { animation: fadeInUp 0.5s ease-out both; }
        .anim-fade-d1 { animation: fadeInUp 0.5s ease-out 0.1s both; }
        .anim-fade-d2 { animation: fadeInUp 0.5s ease-out 0.2s both; }
        .anim-fade-d3 { animation: fadeInUp 0.5s ease-out 0.3s both; }
      `}</style>

      {/* ── Toasts ── */}
      <div className="fixed top-20 right-4 z-[200] space-y-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="anim-slide pointer-events-auto flex items-center gap-3 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">{t.icon}</div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Travel Update</p>
              <p className="text-sm text-gray-700 font-medium leading-snug">{t.msg}</p>
            </div>
          </div>
        ))}
      </div>

{/* ── Header ── */}
      <header className="sticky top-16 lg:top-20 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center gap-4">
          <button onClick={() => router.push('/my-orders')} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-gray-100 transition-all text-gray-600 shrink-0"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Job ID: <span className="text-gray-600">{order.job_id || order.order_id}</span></p>
            <h1 className="text-base lg:text-lg font-black text-gray-900 truncate">{order.product_name || 'Job Execution'}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {gpsOn && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> GPS</div>}
            <Link href="/settings" className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-gray-100 transition-all text-gray-500"><Settings size={16} /></Link>
          </div>
        </div>
      </header>

      {/* ═══════════════ COMPLETED DASHBOARD ═══════════════ */}
      {phase === 'completed' ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="text-center mb-10 anim-fade">
            <div className="w-20 h-20 rounded-full bg-green-50 border-4 border-green-200 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={44} className="text-green-500" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-gray-900 mb-2">Job Completed Successfully</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">All proofs have been synced. Here is the full execution summary.</p>
          </div>

          {/* Stats Grid — Travel/Work timer cards hidden from the executor (kept in code, unused here) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${SHOW_TIMER_UI ? 'xl:grid-cols-4' : 'xl:grid-cols-2 max-w-xl mx-auto'} gap-4 mb-8 anim-fade-d1`}>
            {SHOW_TIMER_UI && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Navigation size={16} className="text-blue-500" /></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Travel</span>
              </div>
              {dbTravelStart ? (<>
                <p className="text-2xl font-black text-gray-900 tabular-nums mb-2">{fmtHuman(dbTravelDur)}</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>Left: <span className="font-semibold text-gray-700">{fmtTime(dbTravelStart)}</span></p>
                  <p>Arrived: <span className="font-semibold text-gray-700">{dbTravelEnd ? fmtTime(dbTravelEnd) : '—'}</span></p>
                </div>
              </>) : <p className="text-sm text-gray-400">Not recorded</p>}
            </div>
            )}
            {SHOW_TIMER_UI && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><Hammer size={16} className="text-green-500" /></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Work</span>
              </div>
              {dbWorkStart ? (<>
                <p className="text-2xl font-black text-gray-900 tabular-nums mb-2">{fmtHuman(dbWorkedMs)}</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>Started: <span className="font-semibold text-gray-700">{fmtTime(dbWorkStart)}</span></p>
                  <p>Ended: <span className="font-semibold text-gray-700">{dbWorkEnd ? fmtTime(dbWorkEnd) : '—'}</span></p>
                  {dbPausedMs > 0 && <p>Paused: <span className="font-semibold text-amber-600">{fmtHuman(dbPausedMs)}</span></p>}
                </div>
              </>) : <p className="text-sm text-gray-400">Not recorded</p>}
            </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><ImageIcon size={16} className="text-purple-500" /></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Photos</span>
              </div>
              <p className="text-2xl font-black text-gray-900 tabular-nums mb-2">{showBeforeImgs.length + showAfterImgs.length}</p>
              <div className="space-y-1 text-xs text-gray-500">
                <p>Before: <span className="font-semibold text-gray-700">{showBeforeImgs.length}</span></p>
                <p>After: <span className="font-semibold text-gray-700">{showAfterImgs.length}</span></p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><PenLine size={16} className="text-amber-500" /></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Signature</span>
              </div>
              {dbSigUrl ? (
                <img src={dbSigUrl} alt="Signature" className="w-full h-16 object-contain rounded-lg border border-gray-100 bg-gray-50" />
              ) : <p className="text-sm text-gray-400 mt-1">Not captured</p>}
              {execRec?.signature_timestamp && <p className="text-[10px] text-gray-400 mt-1">{fmtTime(new Date(execRec.signature_timestamp))}</p>}
            </div>
          </div>

          {/* Before Photos */}
          {showBeforeImgs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6 anim-fade-d2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Eye size={14} /> Before Photos</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {showBeforeImgs.map((src: string, i: number) => (
                  <img key={i} src={src} alt={`Before ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-gray-200" />
                ))}
              </div>
            </div>
          )}

          {/* After Photos */}
          {showAfterImgs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6 anim-fade-d2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Eye size={14} /> After Photos</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {showAfterImgs.map((src: string, i: number) => (
                  <img key={i} src={src} alt={`After ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-gray-200" />
                ))}
              </div>
            </div>
          )}

          {/* Bottom grid: Updates + Notes + Location */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 anim-fade-d3">
            {dbUpdates.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><MessageSquarePlus size={14} className="text-blue-500" /> Progress Updates</h3>
                <div className="space-y-2">
                  {dbUpdates.map((u: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-sm text-gray-700 font-medium">{u}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {dbNotes && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><FileText size={14} className="text-gray-400" /> Notes</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{dbNotes}</p>
              </div>
            )}
            {dbReportedIssues.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> Reported Issues</h3>
                <div className="space-y-2">
                  {dbReportedIssues.map((it, i) => (
                    <div key={i} className="flex items-start gap-2 bg-red-50/60 border border-red-100 rounded-xl px-3 py-2">
                      {it.photo_url && <img src={it.photo_url} alt={it.reason} className="w-10 h-10 rounded-md object-cover border border-red-100 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800">{it.reason}</p>
                        {it.note && <p className="text-xs text-gray-500 mt-0.5">{it.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(execRec?.signature_latitude || execRec?.signature_longitude) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><MapPin size={14} className="text-red-400" /> Completion Location</h3>
                {locationName ? (
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">{locationName}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                    <p className="text-sm text-gray-400">Loading location...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-center mt-10">
            <Link href="/my-orders" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all" style={{ backgroundColor: '#8ED26B' }}>
              <ArrowLeft size={18} /> Back to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        /* ═══════════════ ACTIVE EXECUTION ═══════════════ */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-32 lg:pb-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

            {/* ── Left Sidebar ── */}
            <aside className="w-full lg:w-[320px] xl:w-[360px] lg:shrink-0">
              <div className="lg:sticky lg:top-24 space-y-4">

                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">Progress</h2>
                  <PhaseStepper phase={phase} />
                </div>

                {/* Timer display is hidden from the executor on purpose — the underlying tracking/logic below is untouched and still feeds the admin panel */}
                {SHOW_TIMER_UI && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">

                  {phase === 'traveling' && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Navigation size={14} className="text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Travel Time</span>
                      </div>
                      <p className="text-4xl font-black text-gray-900 tabular-nums tracking-tight mb-3">{travelDisplay}</p>
                      {travelStart && <p className="text-xs text-gray-400">Left at {fmtTime(travelStart)}</p>}
                    </div>
                  )}

                  {phase === 'arrived' && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Travel Done</span>
                      </div>
                      <p className="text-4xl font-black text-gray-900 tabular-nums tracking-tight mb-3">{fmtTimer(travelDurMs)}</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p>Left: {travelStart ? fmtTime(travelStart) : '—'}</p>
                        <p>Arrived: {travelEnd ? fmtTime(travelEnd) : '—'}</p>
                      </div>
                    </div>
                  )}

                  {(phase === 'working' || phase === 'paused') && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Hammer size={14} className="text-[#8ED26B]" />
                        <span className="text-[10px] font-bold text-[#8ED26B] uppercase tracking-wider">Work Time</span>
                        {phase === 'paused' && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-200 ml-auto">PAUSED</span>}
                      </div>
                      <p className="text-4xl font-black text-gray-900 tabular-nums tracking-tight mb-2">{workDisplay}</p>
                      {workStart && <p className="text-xs text-gray-400">Started at {fmtTime(workStart)}</p>}
                      {totalPausedMs > 0 && <p className="text-xs text-amber-500 mt-1">Paused: {fmtHuman(totalPausedMs)}</p>}
                    </div>
                  )}
                </div>
                )}

                {/* Desktop-only action buttons (mobile uses the sticky bottom bar) */}
                <div className="hidden lg:block">

                  {phase === 'traveling' && (
                    <button onClick={handleMarkArrived} disabled={submitting} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black text-white shadow-lg disabled:opacity-60 transition-all hover:shadow-xl active:scale-[0.98] bg-blue-500 hover:bg-blue-600">
                      {submitting ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={22} />} Mark as Arrived
                    </button>
                  )}

                  {phase === 'arrived' && (
                    <button onClick={handleStartWork} disabled={submitting || beforePhotos.length < MIN_PHOTOS || isUploading} className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl active:scale-[0.98]`} style={{ backgroundColor: beforePhotos.length >= MIN_PHOTOS && !isUploading ? '#8ED26B' : '#9ca3af' }}>
                      {submitting ? <Loader2 size={20} className="animate-spin" /> : <Hammer size={22} />}
                      {isUploading ? 'Uploading...' : beforePhotos.length < MIN_PHOTOS ? `Add ${MIN_PHOTOS - beforePhotos.length} more before photo${MIN_PHOTOS - beforePhotos.length > 1 ? 's' : ''}` : 'Start Work'}
                    </button>
                  )}

                  {(phase === 'working' || phase === 'paused') && (
                    <div className="space-y-3">
                      {/* Pause/Resume control removed per request — handlePauseResume is kept intact for backward compatibility */}

                      {!finishingUp && (
                        <button onClick={() => setFinishingUp(true)} className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-black text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98] bg-slate-900 hover:bg-slate-800">
                          <Flag size={18} /> Finish Work
                        </button>
                      )}

                      {finishingUp && (
                        <>
                          <button 
                            onClick={handleComplete} 
                            disabled={submitting} 
                            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98] ${canComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
                          >
                            {submitting ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle2 size={22} />} Complete Job
                          </button>
                          {!canComplete && (
                            <div className="flex flex-wrap justify-center gap-2 mt-2">
                              {isUploading && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">Uploading photos...</span>}
                              {afterPhotos.length < MIN_PHOTOS && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100">{MIN_PHOTOS - afterPhotos.length} after photo{MIN_PHOTOS - afterPhotos.length > 1 ? 's' : ''}</span>}
                              {!hasSig && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100">Signature</span>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {(phase === 'traveling' || phase === 'working' || phase === 'paused') && (
                  <div className="bg-blue-50/60 border border-blue-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                      {phase === 'traveling' ? <><Navigation size={14} className="animate-pulse" /> GPS tracking active during travel</> : <><MapPin size={14} className="animate-pulse" /> GPS tracking active during work</>}
                    </div>
                  </div>
                )}
                {phase === 'paused' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                      <PauseCircle size={14} /> Job paused — GPS stopped
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0 space-y-6">

              {submitting && uploadStage && (
                <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-4 py-3 rounded-xl">
                  <Loader2 size={15} className="shrink-0 animate-spin" /> {uploadStage}
                </div>
              )}
              {actionError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" /> <span>{actionError}</span>
                  <button onClick={() => setActionError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              )}

              {/* Ensure JobInfoCard remains visible during the initial travel phase */}
              {(phase === 'idle' || phase === 'traveling') && <JobInfoCard order={order} />}

              {phase === 'arrived' && (
                <PhotoSection
                  title="Before Photos"
                  hint={`Take at least ${MIN_PHOTOS} photos before starting work`}
                  photos={beforePhotos}
                  onCameraAdd={() => openCam('add', 'before')}
                  onGalleryAdd={(e) => handleGallery(e, 'before')}
                  onRemove={(i) => removePhoto('before', i)}
                  onCameraRetake={(i) => openCam('retake', 'before', i)}
                  onGalleryRetake={(i) => handleRetakeGal('before', i)}
                  inputId="before-photo-gallery"
                  accent="green"
                />
              )}

              {(phase === 'working' || phase === 'paused') && !finishingUp && (
                <>
                  <ProgressUpdates updates={progressUpdates} onAdd={(t) => setProgressUpdates((p) => [...p, t])} onRemove={(i) => setProgressUpdates((p) => p.filter((_, idx) => idx !== i))} disabled={false} />

                  <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-slate-200/40">
                    <button onClick={() => setNotesExp(!notesExp)} className="w-full flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><FileText size={14} className="text-slate-500" /></div>
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</h2>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">Optional</span>
                      </div>
                      {notesExp ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                    </button>
                    {notesExp && (
                      <textarea value={execNotes} onChange={(e) => setExecNotes(e.target.value)} rows={3} placeholder="Overall job notes, follow-up required, materials used..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300 resize-none mt-2" />
                    )}
                  </section>

                  <IssueReportSection
                    issues={reportedIssues}
                    onAdd={(it) => setReportedIssues((p) => [...p, it])}
                    onRemove={(id) => setReportedIssues((p) => p.filter((x) => x.id !== id))}
                  />
                </>
              )}

              {/* Wrap-up step: ONLY after photos + signature are shown — everything else is hidden */}
              {(phase === 'working' || phase === 'paused') && finishingUp && (
                <>
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-4 py-3 rounded-xl">
                    <Flag size={15} className="shrink-0" /> Wrapping up — add after photos and collect a signature to finish.
                  </div>

                  {/* Display Before Photos that were already saved to DB */}
                  {beforePhotos.length > 0 && (
                    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-slate-200/40">
                      <SectionHeader
                        icon={<ImageIcon size={15} className="text-emerald-500" />}
                        color="bg-emerald-50"
                        title="Before Photos"
                        tag={<span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-600 border border-green-200">{beforePhotos.length} ✓</span>}
                      />
                      <div className="grid grid-cols-3 xs:grid-cols-4 sm:flex sm:flex-wrap gap-3 mt-3">
                        {beforePhotos.map((p, i) => (
                          <div key={p.id} className="relative w-full aspect-square sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <img src={p.preview} alt={`Before ${i + 1}`} className="w-full h-full object-cover" />
                            {!p.url && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-white" /></div>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <PhotoSection
                    title="After Photos"
                    hint={`Take at least ${MIN_PHOTOS} photos after completing the work`}
                    photos={afterPhotos}
                    onCameraAdd={() => openCam('add', 'after')}
                    onGalleryAdd={(e) => handleGallery(e, 'after')}
                    onRemove={(i) => removePhoto('after', i)}
                    onCameraRetake={(i) => openCam('retake', 'after', i)}
                    onGalleryRetake={(i) => handleRetakeGal('after', i)}
                    inputId="after-photo-gallery"
                    accent="amber"
                  />

                  <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-slate-200/40">
                    <SectionHeader
                      icon={<PenLine size={15} className="text-purple-500" />}
                      color="bg-purple-50"
                      title="Customer Signature"
                      action={<button onClick={clearSig} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-700"><RotateCcw size={13} /> Clear</button>}
                    />
                    <canvas ref={canvasRef} width={600} height={180} className="w-full h-40 lg:h-44 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-crosshair touch-none mt-2" style={{ touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerOut={onUp} onPointerCancel={onUp} />
                    <p className="text-xs text-gray-400 font-medium mt-2 ml-[42px]">
                      {hasSig ? <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 size={13} /> Signature captured</span> : 'Ask the customer to sign above to confirm job completion.'}
                    </p>
                  </section>
                </>
              )}

              {phase === 'traveling' && (
                <div className="space-y-6">
                  {/* Map Section */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm anim-fade">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <MapPin size={14} className="text-blue-500" /> Job Location Map
                      </h3>
                    </div>
                    <div className="w-full h-56 sm:h-64 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 relative">
                      {(order?.latitude && order?.longitude) || order?.address || order?.location ? (
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0 }}
                          src={`https://maps.google.com/maps?q=${order?.latitude && order?.longitude ? `${order.latitude},${order.longitude}` : encodeURIComponent(order?.address || order?.location || '')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <MapPin size={32} className="mb-2 opacity-30" />
                          <p className="text-sm font-medium">Location data unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Travel Notes Section */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm anim-fade-d1">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-500" /> Travel Notes (Optional)
                    </h3>
                    <textarea
                      value={travelIssueNotes}
                      onChange={(e) => setTravelIssueNotes(e.target.value)}
                      rows={3}
                      placeholder="e.g., Bike puncture, heavy traffic, delayed by 10 mins..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MOBILE STICKY ACTION BAR ═══════════════ */}
      {phase !== 'completed' && (
        <div
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xl border-t border-gray-200 px-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >

          {phase === 'traveling' && (
            <button onClick={handleMarkArrived} disabled={submitting} className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-base font-black text-white shadow-lg disabled:opacity-60 active:scale-[0.98] transition-transform bg-blue-500">
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />} Mark as Arrived
            </button>
          )}

          {phase === 'arrived' && (
            <button onClick={handleStartWork} disabled={submitting || beforePhotos.length < MIN_PHOTOS || isUploading} className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-base font-black text-white shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform" style={{ backgroundColor: beforePhotos.length >= MIN_PHOTOS && !isUploading ? '#8ED26B' : '#9ca3af' }}>
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Hammer size={20} />}
              {isUploading ? 'Uploading...' : beforePhotos.length < MIN_PHOTOS ? `Add ${MIN_PHOTOS - beforePhotos.length} more photo${MIN_PHOTOS - beforePhotos.length > 1 ? 's' : ''}` : 'Start Work'}
            </button>
          )}

          {(phase === 'working' || phase === 'paused') && !finishingUp && (
            <div className="flex gap-2">
              <button onClick={() => setFinishingUp(true)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black text-white shadow-lg active:scale-[0.98] transition-transform bg-slate-900">
                <Flag size={16} /> Finish Work
              </button>
            </div>
          )}

          {(phase === 'working' || phase === 'paused') && finishingUp && (
            <div className="flex gap-2">
              <button onClick={() => setFinishingUp(false)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black text-gray-500 bg-gray-50 border border-gray-200 active:scale-[0.98] transition-transform">
                <ArrowLeft size={16} /> Back
              </button>
              <button 
                onClick={handleComplete} 
                disabled={submitting} 
                className={`flex-[1.4] flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black text-white shadow-lg active:scale-[0.98] transition-transform ${canComplete ? 'bg-green-600' : 'bg-gray-400'}`}
              >
                <CheckCircle2 size={18} /> Complete
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ CONFIRM PREVIEW MODAL ═══════════════ */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-900">Confirm Job Completion</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Review all details before submitting</p>
              </div>
              <button onClick={() => setConfirmModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X size={18} /></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">

              {/* Travel & Work stats — hidden from the executor, kept in code for reuse elsewhere (e.g. admin) */}
              {SHOW_TIMER_UI && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Navigation size={13} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Travel</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 tabular-nums">{fmtHuman(travelDurMs)}</p>
                  <div className="space-y-0.5 text-[11px] text-gray-500 mt-1">
                    <p>Left: {travelStart ? fmtTime(travelStart) : '—'}</p>
                    <p>Arrived: {travelEnd ? fmtTime(travelEnd) : '—'}</p>
                  </div>
                </div>
                <div className="bg-green-50/60 border border-green-100 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Hammer size={13} className="text-green-500" />
                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Work</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 tabular-nums">{fmtHuman(previewWorkMs)}</p>
                  <div className="space-y-0.5 text-[11px] text-gray-500 mt-1">
                    <p>Started: {workStart ? fmtTime(workStart) : '—'}</p>
                    {totalPausedMs > 0 && <p className="text-amber-600">Paused: {fmtHuman(totalPausedMs)}</p>}
                  </div>
                </div>
              </div>
              )}

              {/* Before Photos */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Eye size={12} /> Before Photos ({beforePhotos.length})
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {beforePhotos.map((p, i) => (
                    <img key={p.id} src={p.preview} alt={`Before ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              </div>

              {/* After Photos */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Eye size={12} /> After Photos ({afterPhotos.length})
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {afterPhotos.map((p, i) => (
                    <img key={p.id} src={p.preview} alt={`After ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              </div>

              {/* Signature */}
              {sigPreviewUrl && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <PenLine size={12} /> Customer Signature
                  </h4>
                  <img src={sigPreviewUrl} alt="Signature" className="w-full max-w-xs h-20 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                </div>
              )}

              {/* Progress Updates */}
              {progressUpdates.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquarePlus size={12} className="text-blue-500" /> Progress Updates ({progressUpdates.length})
                  </h4>
                  <div className="space-y-1.5">
                    {progressUpdates.map((u, i) => (
                      <div key={i} className="flex items-start gap-2 bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2">
                        <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                        <p className="text-xs text-gray-700 font-medium">{u}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reported Issues */}
              {reportedIssues.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-red-500" /> Reported Issues ({reportedIssues.length})
                  </h4>
                  <div className="space-y-1.5">
                    {reportedIssues.map((it) => (
                      <div key={it.id} className="flex items-start gap-2 bg-red-50/50 border border-red-100 rounded-lg px-3 py-2">
                        {it.photo && <img src={it.photo.preview} alt={it.reason} className="w-10 h-10 rounded-md object-cover border border-red-100 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800">{it.reason}</p>
                          {it.note && <p className="text-xs text-gray-500">{it.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {(execNotes.trim() || travelIssueNotes.trim()) && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText size={12} /> Notes
                  </h4>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    {[
                      travelIssueNotes.trim() ? `[Travel Notes]: ${travelIssueNotes.trim()}` : '',
                      execNotes.trim()
                    ].filter(Boolean).join('\n\n')}
                  </p>
                </div>
              )}

              {/* Location */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin size={12} className="text-red-400" /> Completion Location
                </h4>
                {previewLocLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 size={13} className="animate-spin" /> Detecting location...
                  </div>
                ) : previewLocName ? (
                  <p className="text-xs text-gray-700 font-medium leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{previewLocName}</p>
                ) : (
                  <p className="text-xs text-gray-400">Location will be captured on submit</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                Go Back & Edit
              </button>
              <button
                onClick={executeSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      <CameraModal open={camOpen} onClose={() => setCamOpen(false)} onCapture={handleCamCapture} />
      <input ref={retakeRef} type="file" accept="image/*" onChange={handleRetakeGalSelect} className="hidden" />
    </div>
  );
}