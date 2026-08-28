'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  ArrowLeft, Loader2, MapPin, Phone, Mail, Navigation, 
  Briefcase, FileText, CheckCircle2, XCircle, Calendar, 
  Hammer, Ruler, FileImage, FileCheck, X, AlertTriangle,
  ExternalLink, Image as ImageIcon, Download, Camera, RefreshCw
} from 'lucide-react';

export default function CarpenterJobDetailPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Accept / Reject UI state ──
  const [submitting, setSubmitting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  
  // Rejection States
  const [rejectCategory, setRejectCategory] = useState('');
  const [rejectDetails, setRejectDetails] = useState('');
  
  const [actionError, setActionError] = useState('');

  // ── Animation Modal ──
  const [acceptedModalOpen, setAcceptedModalOpen] = useState(false);
  const redirectTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Accept Selfie Modal (mandatory before a project can actually be accepted) ──
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieError, setSelfieError] = useState('');
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    if (projectId) fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    setLoading(true);
    
    // 1. Fetch Project Details
    const { data: projData, error: projErr } = await supabase
      .from('modular_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projErr || !projData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // 2. Fetch Project Documents
    const { data: docData } = await supabase
      .from('modular_project_documents')
      .select('*')
      .eq('project_id', projectId);

    setProject(projData);
    setDocuments(docData || []);
    setLoading(false);
  };

  // ── LOCK: Redirect to execute if already accepted ──
  useEffect(() => {
    if (!project) return;
    const st = (project.status || 'assigned').toLowerCase();

    if (st !== 'assigned' && st !== 'rejected') {
      router.replace(`/carpenter-job/${projectId}/execute`);
    }
  }, [project, projectId, router]);

  // ── Step 1: Accept Job button no longer accepts directly — it just opens
  // the mandatory selfie capture modal. Nothing is written to the DB yet,
  // and GPS is not requested until the selfie is confirmed. ──
  const openSelfieModal = () => {
    setSelfieError('');
    setSelfiePreview(null);
    setSelfieFile(null);
    setSelfieModalOpen(true);
  };

  const closeSelfieModal = () => {
    // Backing out here means the project is simply NOT accepted — status
    // stays 'assigned', no DB writes happen, no GPS/daily log created.
    if (uploadingSelfie) return;
    setSelfieModalOpen(false);
    setSelfiePreview(null);
    setSelfieFile(null);
    setSelfieError('');
  };

  const handleSelfieFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieError('');
    setSelfieFile(file);
    const reader = new FileReader();
    reader.onload = () => setSelfiePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const retakeSelfie = () => {
    setSelfiePreview(null);
    setSelfieFile(null);
    setSelfieError('');
    if (selfieInputRef.current) selfieInputRef.current.value = '';
  };

  // ── Step 2: only once a selfie is captured & uploaded do we actually ping
  // GPS, create the daily log, and mark the project in_progress. This is
  // the ONLY path that can move a project out of 'assigned'. ──
  const confirmSelfieAndAccept = async () => {
    if (!selfieFile) {
      setSelfieError('Please take a selfie to continue — it is required to accept this job.');
      return;
    }

    setUploadingSelfie(true);
    setSelfieError('');

    try {
      // 1. Upload selfie to storage
      const ext = selfieFile.name.split('.').pop() || 'jpg';
      const path = `${projectId}/attendance-selfies/accept-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('modular-project-docs') // <-- Changed here
        .upload(path, selfieFile, { upsert: true });

      if (uploadErr) {
        setSelfieError(`Selfie upload failed: ${uploadErr.message}`);
        setUploadingSelfie(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('modular-project-docs') // <-- Changed here
        .getPublicUrl(path);
      const selfieUrl = urlData?.publicUrl || null;

      setUploadingSelfie(false);
      setSelfieModalOpen(false);
      setSelfiePreview(null);
      setSelfieFile(null);

      // 2. Now proceed with the original GPS + accept flow
      await handleAccept(selfieUrl);
    } catch (err: any) {
      console.error('Error during selfie accept flow:', err);
      setSelfieError('Something went wrong while accepting the job. Please try again.');
      setUploadingSelfie(false);
    }
  };

  // ── GPS & TIME TRACKING ON ACCEPT (now only called after selfie confirm) ──
  const handleAccept = async (selfieUrl: string | null) => {
    setSubmitting(true);
    setActionError('');

    if (!navigator.geolocation) {
      setActionError("GPS is not supported by your browser.");
      setSubmitting(false);
      return;
    }

    // Ping GPS immediately
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = new Date().toISOString();

        // 1. Create Daily Log instantly (This starts the timer!)
        const { error: logErr } = await supabase.from('modular_daily_logs').insert({
          project_id: projectId,
          executor_id: project.assigned_executor_id || project.supervisor_id,
          log_date: now.split('T')[0],
          check_in_time: now,
          gps_latitude: lat,
          gps_longitude: lng,
          check_in_selfie_url: selfieUrl,
        });

        if (logErr) throw logErr;

        // 2. Change project status to in_progress
        const { error: projErr } = await supabase.from('modular_projects').update({
          status: 'in_progress',
          updated_at: now
        }).eq('id', projectId);

        if (projErr) throw projErr;

        // 3. Show animation and redirect to execution workspace
        setAcceptedModalOpen(true);
        redirectTimer.current = setTimeout(() => {
          router.push(`/carpenter-job/${projectId}/execute`);
        }, 2800);

      } catch (error: any) {
        setActionError(error.message || "Failed to start job tracking.");
        setSubmitting(false);
      }
    }, (err) => {
      setActionError("GPS Permission is required to accept and start the job timer.");
      setSubmitting(false);
    });
  };

  // ── REJECT HANDLER (Saves to new rejection_reason column) ──
  const handleReject = async () => {
    if (!rejectCategory) {
      setActionError('Please select a reason from the dropdown.');
      return;
    }
    if (rejectCategory === 'Other' && !rejectDetails.trim()) {
      setActionError('Please provide details for rejecting this project.');
      return;
    }

    setSubmitting(true);
    setActionError('');

    let finalReason = rejectCategory;
    if (rejectDetails.trim()) {
      finalReason += ` - ${rejectDetails.trim()}`;
    }

    // Save to the new rejection_reason column!
    const { error } = await supabase
      .from('modular_projects')
      .update({
        status: 'rejected',
        rejection_reason: finalReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) {
      setActionError(`Could not reject: ${error.message}`);
    } else {
      setRejectModalOpen(false);
      setRejectCategory('');
      setRejectDetails('');
      await fetchProject();
    }
    setSubmitting(false);
  };

  // Safe download helper function handling cross-origin properly
  const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
    e.preventDefault(); // Prevent triggering any parent <a> tags
    e.stopPropagation();
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

  // ── Loading & Not Found States ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Project...</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-center px-6">
        <Briefcase size={56} className="text-gray-200 mb-4" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">Project Not Found</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-sm">This site may have been removed or the link is incorrect.</p>
        <Link href="/my-orders" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm bg-[#8ED26B]">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const status = (project.status || 'assigned').toLowerCase();
  const isRejected = status === 'rejected';
  const isPending = status === 'assigned';

  if (!isPending && !isRejected) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Opening Workspace...</p>
      </div>
    );
  }

  const addressQuery = encodeURIComponent(`${project.address || ''} ${project.city || ''} ${project.state || ''} ${project.pincode || ''}`.trim());
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;

  // ── STRICT BUCKETING ──
  const drawings: any[] = [];
  const checklists: any[] = [];
  const otherDocs: any[] = [];

  documents.forEach((d) => {
    const type = (d.doc_type || '').toLowerCase();
    const url = (d.file_url || '').toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp|gif)/i.test(url);

    if (type.includes('hard') || type.includes('mat') || type.includes('check') || type.includes('list')) {
      checklists.push(d);
    } else if (type.includes('draw') || type.includes('plan') || type.includes('design') || type.includes('blue')) {
      drawings.push(d);
    } else if (isImage && !type.includes('doc') && !type.includes('pdf')) {
      drawings.push(d);
    } else {
      otherDocs.push(d);
    }
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-gray-800">
      <style>{`
        @keyframes routePulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .anim-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .route-ring { animation: routePulse 1.8s ease-out infinite; }
      `}</style>

      {/* ================================= HEADER ================================= */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center gap-3 sm:gap-4">
          <button onClick={() => router.push('/my-orders')} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-gray-100 transition-all text-gray-600 shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Job ID: <span className="text-gray-700">{project.job_id}</span>
            </p>
            <h1 className="text-sm sm:text-lg font-black text-gray-900 truncate">
              Modular Site Installation
            </h1>
          </div>
          {isRejected && (
            <span className="shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5">
              <XCircle size={12} /> Rejected
            </span>
          )}
        </div>
      </header>

      {/* ================================= MAIN ================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 flex flex-col gap-4 sm:gap-6 pb-28">
        
        {/* Status Row with Display for Rejection Reason */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-sm border ${
              isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 
              isRejected ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
              Status: {project.status?.replace('_', ' ')}
            </span>
          </div>
          
          {/* Shows why it was rejected to the carpenter */}
          {isRejected && project.rejection_reason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 sm:p-4 text-sm text-red-800 flex items-start gap-2 shadow-sm">
              <AlertTriangle size={18} className="shrink-0 text-red-500 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">Reason for Rejection:</span>
                <span className="font-medium text-red-700">{project.rejection_reason}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            
            {/* Client Info */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Briefcase size={14} className="text-[#8ED26B]" /> Client & Site Info
              </h2>
              <div className="space-y-3">
                <p className="text-base sm:text-lg font-black text-gray-900">{project.customer_name}</p>
                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  {project.phone && (
                    <a href={`tel:${project.phone}`} className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#f4fcf0] border border-green-100 text-[#5aaa3a] font-bold text-sm hover:bg-green-50 transition-colors">
                      <Phone size={16} className="shrink-0" /> <span className="truncate">{project.phone}</span>
                    </a>
                  )}
                  {project.client && (
                    <div className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 font-semibold text-sm min-w-0">
                      <Briefcase size={16} className="shrink-0" /> <span className="truncate">{project.client}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Address & Nav */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-500" /> Route & Navigation
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">{project.address}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">
                    {[project.city, project.state, project.pincode].filter(Boolean).join(', ')}
                  </p>
                  {project.landmark && <p className="text-xs text-gray-400 mt-1">Landmark: {project.landmark}</p>}
                </div>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center justify-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl shadow-md transition-all w-full sm:w-auto">
                  <Navigation size={16} /> Open Maps
                </a>
              </div>
            </section>

            {/* Project Details */}
            <section className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Ruler size={14} /> Project Scope & Dimensions
              </h2>
              <p className="text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                {project.project_details || 'No detailed scope provided. Check drawings for exact dimensions.'}
              </p>
            </section>

          </div>

          {/* ── RIGHT COLUMN (ALIGNED CARDS) ── */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">

            {/* Schedule */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Target Schedule</h2>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#8ED26B]">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Start Date</p>
                  <p className="text-sm font-black text-gray-800">{project.scheduled_date || 'TBD'}</p>
                </div>
              </div>
            </section>

            {/* 1. Site Drawings */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileImage size={14} className="text-purple-500" /> Site Drawings
              </h2>
              {drawings.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {drawings.map((doc) => (
                    <div key={doc.id} className="block group">
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center mb-1.5 shadow-sm">
                        <img src={doc.file_url} alt="Drawing" className="max-w-full max-h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        
                        {/* Hover Overlay with View and Download Actions */}
                        <div className="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/40 transition-colors flex items-center justify-center gap-3">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100" title="View">
                             <ExternalLink size={18} className="text-white drop-shadow-md" />
                          </a>
                          <button onClick={(e) => handleDownload(e, doc.file_url, doc.file_url.split('/').pop() || 'drawing')} className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100" title="Download">
                            <Download size={18} className="text-white drop-shadow-md" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-gray-600 truncate text-center capitalize px-1">
                        {doc.doc_type?.replace(/_/g, ' ') || 'Drawing'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-medium bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  No site drawings uploaded yet.
                </p>
              )}
            </section>

            {/* 2. Hardware & Materials */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileCheck size={14} className="text-emerald-500" /> Hardware & Materials
              </h2>
              {checklists.length > 0 ? (
                <div className="flex flex-col gap-2.5 mt-1">
                  {checklists.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100 transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 shrink-0">
                          <FileCheck size={16} />
                        </div>
                        <span className="text-xs font-bold text-emerald-900 capitalize truncate">
                          {doc.doc_type?.replace(/_/g, ' ') || 'Checklist'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-200 text-emerald-700 hover:bg-emerald-300 rounded-lg transition-colors opacity-50 group-hover:opacity-100" title="View">
                          <ExternalLink size={14} />
                        </a>
                        <button onClick={(e) => handleDownload(e, doc.file_url, doc.file_url.split('/').pop() || 'document')} className="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors opacity-50 group-hover:opacity-100" title="Download">
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-medium bg-emerald-50/50 p-4 rounded-xl border border-emerald-50 text-center">
                  No checklists uploaded yet.
                </p>
              )}
            </section>

          </div>
        </div>

        {/* Action Error */}
        {actionError && !rejectModalOpen && !acceptedModalOpen && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm font-semibold px-4 py-3 rounded-xl">
            <AlertTriangle size={16} className="shrink-0" /> {actionError}
          </div>
        )}

        {/* ── ACTION FOOTER (Pending Only) ── */}
        {isPending && (
          <section className="fixed sm:sticky bottom-0 sm:bottom-4 left-0 right-0 mt-auto bg-white/95 backdrop-blur-xl border-t sm:border border-gray-200 sm:rounded-2xl p-3 sm:p-4 shadow-lg grid grid-cols-2 gap-2.5 sm:gap-3 max-w-3xl sm:mx-auto w-full z-10">
            <button
              onClick={openSelfieModal}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all disabled:opacity-60 active:scale-[0.98]"
              style={{ backgroundColor: '#8ED26B' }}
            >
              <CheckCircle2 size={18} className="shrink-0" />
              <span className="truncate">Accept Job</span>
            </button>
            <button
              onClick={() => { setRejectModalOpen(true); setActionError(''); }}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all disabled:opacity-60 active:scale-[0.98]"
            >
              <XCircle size={18} className="shrink-0" /> <span className="truncate">Reject Job</span>
            </button>
          </section>
        )}

      </main>

      {/* ── REJECT MODAL (WITH DROPDOWN) ── */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                Reject Project?
              </h3>
              <button 
                onClick={() => { setRejectModalOpen(false); setRejectCategory(''); setRejectDetails(''); setActionError(''); }} 
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to reject this job? Please select a reason below. This will notify the admin team.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Reason for Rejection *</label>
                <select
                  value={rejectCategory}
                  onChange={(e) => { setRejectCategory(e.target.value); setActionError(''); }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 bg-white"
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="Schedule Conflict">Schedule Conflict</option>
                  <option value="Location Too Far">Location Too Far</option>
                  <option value="Missing Information / Materials">Missing Information / Materials</option>
                  <option value="Not My Expertise">Not My Expertise</option>
                  <option value="Other">Other (Please specify)</option>
                </select>
              </div>

              {rejectCategory && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Additional Details {rejectCategory === 'Other' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={rejectDetails}
                    onChange={(e) => setRejectDetails(e.target.value)}
                    rows={3}
                    placeholder={rejectCategory === 'Other' ? "Please explain your reason..." : "Any additional remarks (optional)..."}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 resize-none"
                  />
                </div>
              )}
            </div>

            {actionError && (
              <p className="text-xs font-semibold text-red-500 mt-4 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" /> {actionError}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { setRejectModalOpen(false); setRejectCategory(''); setRejectDetails(''); setActionError(''); }} 
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleReject} 
                disabled={submitting} 
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCEPT SELFIE MODAL (mandatory) ── */}
      {selfieModalOpen && (
        <div className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <Camera size={20} className="text-[#8ED26B]" /> Selfie Required
              </h3>
              <button
                onClick={closeSelfieModal}
                disabled={uploadingSelfie}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              A selfie is mandatory to accept this job. You won't be able to continue to the site workspace without it.
            </p>

            <input
              ref={selfieInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleSelfieFileChange}
              className="hidden"
              id="carpenter-accept-selfie-input"
            />

            {!selfiePreview ? (
              <label
                htmlFor="carpenter-accept-selfie-input"
                className="flex flex-col items-center justify-center gap-2 w-full h-48 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <Camera size={32} className="text-gray-300" />
                <span className="text-sm font-bold text-gray-500">Tap to take a selfie</span>
              </label>
            ) : (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img src={selfiePreview} alt="Selfie preview" className="w-full h-full object-cover" />
                <button
                  onClick={retakeSelfie}
                  disabled={uploadingSelfie}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-700 bg-white/90 border border-gray-200 shadow-sm hover:bg-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Retake
                </button>
              </div>
            )}

            {selfieError && (
              <p className="text-xs font-semibold text-red-500 mt-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" /> {selfieError}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={closeSelfieModal}
                disabled={uploadingSelfie}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSelfieAndAccept}
                disabled={uploadingSelfie || !selfieFile}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#8ED26B' }}
              >
                {uploadingSelfie ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {uploadingSelfie ? 'Accepting...' : 'Confirm & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HAMMER / WORKSPACE STARTED MODAL ── */}
      {acceptedModalOpen && (
        <div className="fixed inset-0 z-[60] bg-gradient-to-b from-blue-50/95 via-white/95 to-green-50/95 backdrop-blur-md flex items-center justify-center px-4">
          <div className="text-center max-w-sm w-full anim-slide-up">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6 sm:mb-8">
              <div className="absolute inset-0 rounded-full bg-blue-100 route-ring" />
              <div className="absolute inset-3 rounded-full bg-blue-50 route-ring" style={{ animationDelay: '0.4s' }} />
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center shadow-xl">
                <Hammer size={36} className="text-white sm:w-10 sm:h-10" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-3">Project Accepted</h2>
            <p className="text-sm sm:text-base font-semibold text-gray-600 mb-2">
              Preparing site execution workspace
            </p>
            <p className="text-xs sm:text-sm text-gray-400 font-medium max-w-xs mx-auto">
              You will be redirected to the daily logs and task update portal automatically.
            </p>
            <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8">
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}