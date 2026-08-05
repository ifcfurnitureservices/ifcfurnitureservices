'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  ArrowLeft, Loader2, Camera, MapPin, Mic, Square, Play, 
  CheckCircle2, LogOut, PenLine, Clock, Upload, Hammer, 
  Flag, AlertTriangle, User, RotateCcw, X, Info, Video, FileText, ArrowRight, Settings
} from 'lucide-react';

const TASK_STEPS = [
  'Site Preparation',
  'Kitchen Carcass Installation',
  'Furniture Installation',
  'Wall Panels',
  'Other'
];

export default function CarpenterExecutionPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  // ── Core States ──
  const [project, setProject] = useState<any>(null);
  const [dailyLog, setDailyLog] = useState<any>(null);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [completedLogs, setCompletedLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  // ── Popup Modals State ──
  const [confirmPrompt, setConfirmPrompt] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [alertPrompt, setAlertPrompt] = useState<{ title: string; message: string; type: 'success' | 'info'; onClose?: () => void } | null>(null);

  // ── Time Tracking ──
  const [workDisplay, setWorkDisplay] = useState('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Morning Check-in States (Start Day) ──
  const [selfie, setSelfie] = useState<{ file: File; preview: string } | null>(null);
  const [sitePhoto, setSitePhoto] = useState<{ file: File; preview: string } | null>(null);

  // ── Task Update States ──
  const [taskCategory, setTaskCategory] = useState('');
  const [taskSelfie, setTaskSelfie] = useState<{ file: File; preview: string } | null>(null);
  const [taskVideo, setTaskVideo] = useState<{ file: File; preview: string } | null>(null);
  const [remarks, setRemarks] = useState('');
  
  // ── Voice Recorder States (Optional Now) ──
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // ── Final Sign-off States ──
  const [showSignOff, setShowSignOff] = useState(false);
  const [pmName, setPmName] = useState('');
  const [hasSig, setHasSig] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  const [hasCustSig, setHasCustSig] = useState(false);
  const custSigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isCustDrawing = useRef(false);

  // Derived state for locked categories
  const completedCategories = Array.from(new Set(completedTasks.map(t => t.category)));

  useEffect(() => {
    if (projectId) fetchProjectData();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [projectId]);

  const fetchProjectData = async () => {
    setLoading(true);
    
    const { data: proj, error: projErr } = await supabase
      .from('modular_projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (projErr || !proj) {
      setLoading(false);
      return;
    }
    setProject(proj);

    const { data: tasks } = await supabase
      .from('modular_task_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setCompletedTasks(tasks || []);

    // Also checking 'sign_off' here just in case older jobs still have it
    if (proj.status === 'completed' || proj.status === 'sign_off') {
      const { data: logs } = await supabase
        .from('modular_daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false });
      setCompletedLogs(logs || []);
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: log } = await supabase
        .from('modular_daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .eq('log_date', todayStr)
        .is('check_out_time', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (log) {
        setDailyLog(log);
        startTimer(new Date(log.check_in_time));
      }
    }
    
    setLoading(false);
  };

  const startTimer = (startTime: Date) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startTime.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setWorkDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ==========================================
  // 1. MORNING CHECK-IN
  // ==========================================
  const handleStartDay = async () => {
    if (!selfie || !sitePhoto) {
      setActionError("Both Selfie and Site Photo are required to start the day.");
      return;
    }
    setSubmitting(true);
    setActionError('');
    
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = new Date().toISOString();

        const selfiePath = `${projectId}/daily-log-${Date.now()}-selfie.jpg`;
        const sitePath = `${projectId}/daily-log-${Date.now()}-site.jpg`;
        
        await supabase.storage.from('modular-project-docs').upload(selfiePath, selfie.file);
        await supabase.storage.from('modular-project-docs').upload(sitePath, sitePhoto.file);
        
        const selfieUrl = supabase.storage.from('modular-project-docs').getPublicUrl(selfiePath).data.publicUrl;
        const siteUrl = supabase.storage.from('modular-project-docs').getPublicUrl(sitePath).data.publicUrl;

        const { data, error } = await supabase.from('modular_daily_logs').insert({
          project_id: projectId,
          executor_id: project.assigned_executor_id || project.supervisor_id, 
          log_date: now.split('T')[0],
          check_in_time: now,
          gps_latitude: lat,
          gps_longitude: lng,
          selfie_url: selfieUrl,
          site_photo_url: siteUrl,
        }).select().single();
        
        if (error) throw error;

        if (project.status === 'assigned' || project.status === 'submitted') {
          await supabase.from('modular_projects').update({ status: 'in_progress' }).eq('id', projectId);
          setProject({ ...project, status: 'in_progress' });
        }
        
        setDailyLog(data);
        startTimer(new Date(now));
        
        setSelfie(null);
        setSitePhoto(null);
        setSubmitting(false);

        setAlertPrompt({
          title: "Day Started!",
          message: "Your attendance and location have been recorded. Have a great day!",
          type: 'success'
        });

      }, (err) => {
        setActionError("GPS Location is required to start the day. Please allow location access.");
        setSubmitting(false);
      });
    } catch (error: any) {
      setActionError(error.message || "Failed to start day.");
      setSubmitting(false);
    }
  };

  // ==========================================
  // 2. END OF DAY
  // ==========================================
  const triggerEndDay = () => {
    setConfirmPrompt({
      title: "End Shift",
      message: "Are you sure you want to clock out and end your work day?",
      onConfirm: handleEndDay
    });
  };

  const handleEndDay = async () => {
    if (!dailyLog) return;
    setSubmitting(true);
    
    try {
      const now = new Date().toISOString();
      await supabase
        .from('modular_daily_logs')
        .update({ check_out_time: now })
        .eq('id', dailyLog.id);
        
      if (timerRef.current) clearInterval(timerRef.current);
      setDailyLog(null);
      
      setAlertPrompt({
        title: "Shift Ended",
        message: "Your work hours have been recorded successfully. Great job today!",
        type: 'success',
        onClose: () => router.push('/my-orders')
      });

    } catch (error: any) {
      setActionError(error.message || "Failed to end day.");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // 3. VOICE RECORDING (OPTIONAL)
  // ==========================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setActionError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  // ==========================================
  // 4. SUBMIT TASK UPDATE
  // ==========================================
  const handleUploadTask = async () => {
    if (!taskCategory || !taskSelfie || !taskVideo) {
      setActionError("Task Category, Worker Selfie, and Site Video are required.");
      return;
    }
    setSubmitting(true);
    setActionError('');
    
    try {
      const selfiePath = `${projectId}/task-selfie-${Date.now()}.jpg`;
      await supabase.storage.from('modular-project-docs').upload(selfiePath, taskSelfie.file);
      const selfieUrl = supabase.storage.from('modular-project-docs').getPublicUrl(selfiePath).data.publicUrl;

      const videoExt = taskVideo.file.name.split('.').pop();
      const videoPath = `${projectId}/task-video-${Date.now()}.${videoExt}`;
      await supabase.storage.from('modular-project-docs').upload(videoPath, taskVideo.file);
      const videoUrl = supabase.storage.from('modular-project-docs').getPublicUrl(videoPath).data.publicUrl;

      let voiceUrl = null;
      if (audioBlob) {
        const audioPath = `${projectId}/audio-${Date.now()}.webm`;
        await supabase.storage.from('modular-project-docs').upload(audioPath, audioBlob);
        voiceUrl = supabase.storage.from('modular-project-docs').getPublicUrl(audioPath).data.publicUrl;
      }

      const formattedRemarks = `[Selfie: ${selfieUrl}] ${remarks.trim()}`;

      const { data: insertedTask, error } = await supabase.from('modular_task_updates').insert({
        project_id: projectId,
        daily_log_id: dailyLog.id,
        category: taskCategory,
        media_url: videoUrl,
        media_type: taskVideo.file.type.includes('video') ? 'video' : 'image',
        voice_note_url: voiceUrl,
        remarks: formattedRemarks
      }).select().single();

      if (error) throw error;

      // Smart 4th Task Prompt Logic
      const newCategories = new Set([...completedCategories, taskCategory]);
      const coreTasks = ['Site Preparation', 'Kitchen Carcass Installation', 'Furniture Installation', 'Wall Panels'];
      const hasAllCore = coreTasks.every(c => newCategories.has(c));
      const previouslyHadAllCore = coreTasks.every(c => completedCategories.includes(c));

      if (hasAllCore && !previouslyHadAllCore) {
        setAlertPrompt({
          title: "All Core Tasks Completed!",
          message: "Great! You have finished all 4 core installation tasks. You can now 'Complete Job' or continue to log additional tasks under 'Other'.",
          type: 'info'
        });
      } else {
        setAlertPrompt({
          title: "Task Logged!",
          message: `${taskCategory} has been successfully recorded.`,
          type: 'success'
        });
      }

      if (insertedTask) setCompletedTasks(prev => [insertedTask, ...prev]);
      
      setTaskCategory('');
      setTaskSelfie(null);
      setTaskVideo(null);
      deleteRecording();
      setRemarks('');
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error: any) {
      setActionError(error.message || "Failed to upload task.");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // "COMPLETE JOB" TRIGGER 
  // ==========================================
  const triggerCompleteJob = () => {
    setConfirmPrompt({
      title: "Complete Job",
      message: "Are you sure you completely finished this job? This will open the final sign-off form below.",
      onConfirm: () => {
        setShowSignOff(true);
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    });
  };

  // ==========================================
  // 5. KITCHEN CARCASS -> COUNTERTOP TRIGGER
  // ==========================================
  const triggerHandover = () => {
    setConfirmPrompt({
      title: "Handover to Countertop",
      message: "Notify admin that the Kitchen Carcass is ready for countertops? You can still log other tasks while waiting.",
      onConfirm: handleHandoverCountertop
    });
  };

  const handleHandoverCountertop = async () => {
    setSubmitting(true);
    try {
      await supabase.from('modular_projects').update({ status: 'awaiting_countertop' }).eq('id', projectId);
      setProject({ ...project, status: 'awaiting_countertop' });
      
      // Notify Admin Only via API
      try {
        await fetch('/api/notify-admin-countertop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, jobId: project.job_id })
        });
      } catch (err) {
        console.error("Failed to notify admin", err);
      }
      
      setAlertPrompt({
        title: "Notified Admin",
        message: "Admin has been notified. You can continue working on other tasks in the meantime.",
        type: 'info'
      });

    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // 6. FINAL SIGN OFF 
  // ==========================================
  const getPtr = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => { isDrawing.current = true; const c = sigCanvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); const p = getPtr(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!isDrawing.current) return; const c = sigCanvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return; const p = getPtr(e); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f2937'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!isDrawing.current) return; isDrawing.current = false; setHasSig(true); try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ } };
  const clearSig = () => { const c = sigCanvasRef.current; const ctx = c?.getContext('2d'); if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); ctx.beginPath(); } setHasSig(false); };

  const getCustPtr = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = custSigCanvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const onCustDown = (e: React.PointerEvent<HTMLCanvasElement>) => { isCustDrawing.current = true; const c = custSigCanvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); const p = getCustPtr(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const onCustMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!isCustDrawing.current) return; const c = custSigCanvasRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return; const p = getCustPtr(e); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f2937'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const onCustUp = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!isCustDrawing.current) return; isCustDrawing.current = false; setHasCustSig(true); try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ } };
  const clearCustSig = () => { const c = custSigCanvasRef.current; const ctx = c?.getContext('2d'); if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); ctx.beginPath(); } setHasCustSig(false); };

  const handleFinalSignOffComplete = async () => {
    if (!pmName.trim() || !hasSig) {
      setActionError("Project Manager Name and Signature are required before completing.");
      return;
    }
    
    setSubmitting(true);
    setActionError('');
    
    try {
      const c = sigCanvasRef.current; 
      if (!c) throw new Error('Signature missing.');
      const blob: Blob | null = await new Promise((r) => c.toBlob((b) => r(b), 'image/png'));
      if (!blob) throw new Error('Could not read signature.');
      
      const sigPath = `${projectId}/pm-signature-${Date.now()}.png`;
      await supabase.storage.from('modular-project-docs').upload(sigPath, blob, { contentType: 'image/png' });
      const sigUrl = supabase.storage.from('modular-project-docs').getPublicUrl(sigPath).data.publicUrl;

      let custSigUrl = null;
      if (hasCustSig && custSigCanvasRef.current) {
        const custBlob: Blob | null = await new Promise((r) => custSigCanvasRef.current!.toBlob((b) => r(b), 'image/png'));
        if (custBlob) {
          const custSigPath = `${projectId}/customer-signature-${Date.now()}.png`;
          await supabase.storage.from('modular-project-docs').upload(custSigPath, custBlob, { contentType: 'image/png' });
          custSigUrl = supabase.storage.from('modular-project-docs').getPublicUrl(custSigPath).data.publicUrl;
        }
      }

      // Automatically sets status completely to 'completed', bypassing 'sign_off'
      await supabase.from('modular_projects').update({
        status: 'completed', 
        pm_name: pmName.trim(),
        pm_signature_url: sigUrl,
        customer_ack_signature_url: custSigUrl,
        updated_at: new Date().toISOString()
      }).eq('id', projectId);
      
      // Send Email to Admin & Client
      try {
        await fetch('/api/notify-job-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId })
        });
      } catch (err) {
        console.error("Failed to notify final completion", err);
      }

      // Ensure the UI instantly reflects 'completed'
      setProject({ ...project, status: 'completed' });
      setShowSignOff(false);

      setAlertPrompt({
        title: "Job Completed!",
        message: "The final sign-offs have been submitted successfully. This project is now closed.",
        type: 'success',
        onClose: () => router.push('/my-orders')
      });

    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: any, checkVideo: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      setter({
        file,
        preview: URL.createObjectURL(file),
        isVideo: checkVideo ? file.type.includes('video') : false
      });
    }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Workspace...</p>
      </div>
    );
  }

  const status = (project.status || 'assigned').toLowerCase(); 

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-gray-800 pb-28">
      
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/my-orders')} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-gray-100 text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Site Execution</p>
              <h1 className="text-sm sm:text-base font-black text-gray-900 truncate">{project.customer_name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {dailyLog && status !== 'completed' && status !== 'sign_off' && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-green-700 shadow-sm">
                <Clock size={14} />
                <span className="text-[11px] font-black tabular-nums tracking-wider">{workDisplay}</span>
              </div>
            )}
            <button onClick={() => router.push('/settings')} className="p-2.5 rounded-xl bg-white border border-gray-200/60 hover:bg-gray-50 text-gray-600 transition-colors shadow-sm">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── MAGIC NOTIFICATION: ADMIN VERIFIED COUNTERTOP ── */}
        {status === 'countertop_completed' && !showSignOff && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-[2px] rounded-2xl shadow-lg mb-6 animate-in slide-in-from-top fade-in duration-500">
            <div className="bg-white/95 backdrop-blur rounded-xl px-5 py-4 flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xl shadow-inner">✨</span>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-800">Admin Verified Countertop!</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">You can now proceed to complete the job and submit final sign-offs.</p>
              </div>
            </div>
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl shadow-sm">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1 leading-snug">{actionError}</span>
            <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button>
          </div>
        )}

        {/* =========================================================================
            STATE 1: COMPLETED (FULL VIEW)
            ========================================================================= */}
        {(status === 'completed' || status === 'sign_off') && (
          <div className="space-y-6">
            
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4 border border-green-100 shadow-sm">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">Job Completed Successfully</h2>
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">Excellent work! All tasks and final sign-offs have been submitted and the job is officially closed.</p>
              <button 
                onClick={() => router.push('/my-orders')} 
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-black transition-all hover:-translate-y-0.5"
              >
                <ArrowLeft size={16} /> Return to Dashboard
              </button>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                <FileText size={14} className="text-blue-500" /> Project Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Job ID</p>
                  <p className="text-sm font-black text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 inline-block">{project.job_id || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Customer & Location</p>
                  <p className="text-sm font-bold text-gray-900">{project.customer_name}</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">{project.address}, {project.city}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5 pt-5 border-t border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Project Manager</p>
                  <p className="text-base font-black text-gray-900">{project.pm_name || 'N/A'}</p>
                </div>
              </div>
            </div>

            {completedLogs.length > 0 && (
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <MapPin size={14} className="text-[#8ED26B]" /> Morning Check-ins ({completedLogs.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {completedLogs.map((log) => (
                    <div key={log.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 flex gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 mb-1.5">{formatDate(log.log_date)}</p>
                        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><Clock size={12} className="text-green-500"/> In: {formatTime(log.check_in_time)}</p>
                        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mt-0.5"><Clock size={12} className="text-amber-500"/> Out: {log.check_out_time ? formatTime(log.check_out_time) : '—'}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {log.selfie_url && (
                          <a href={log.selfie_url} target="_blank" className="w-14 h-14 rounded-lg bg-black overflow-hidden relative block border border-gray-200 shadow-sm hover:opacity-80 transition-opacity">
                             <img src={log.selfie_url} alt="Selfie" className="w-full h-full object-cover opacity-90" />
                             <span className="absolute bottom-0 w-full text-center bg-black/60 backdrop-blur-sm text-[8px] text-white font-bold py-0.5">Selfie</span>
                          </a>
                        )}
                        {log.site_photo_url && (
                          <a href={log.site_photo_url} target="_blank" className="w-14 h-14 rounded-lg bg-black overflow-hidden relative block border border-gray-200 shadow-sm hover:opacity-80 transition-opacity">
                             <img src={log.site_photo_url} alt="Site" className="w-full h-full object-cover opacity-90" />
                             <span className="absolute bottom-0 w-full text-center bg-black/60 backdrop-blur-sm text-[8px] text-white font-bold py-0.5">Site</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Hammer size={14} className="text-orange-500" /> Execution History ({completedTasks.length})
                </h3>
                <div className="space-y-4">
                  {completedTasks.map((task) => {
                    const selfieMatch = task.remarks ? task.remarks.match(/\[Selfie:\s*(.*?)\]/) : null;
                    const taskSelfieUrl = selfieMatch ? selfieMatch[1] : null;
                    const cleanRemarks = task.remarks ? task.remarks.replace(/\[Selfie:\s*.*?\]\s*/g, '').trim() : 'No remarks';

                    return (
                      <div key={task.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-gray-100/50 transition-colors flex flex-col sm:flex-row gap-4">
                        <div className="flex gap-2 shrink-0">
                          {taskSelfieUrl && (
                            <a href={taskSelfieUrl} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-black relative hover:opacity-80 transition-opacity">
                              <img src={taskSelfieUrl} alt="Selfie" className="w-full h-full object-cover opacity-90" />
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-[8px] text-white text-center font-bold py-0.5">Selfie</div>
                            </a>
                          )}
                          {task.media_url && (
                            <a href={task.media_url} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-black relative hover:opacity-80 transition-opacity">
                              {task.media_type === 'video' ? (
                                 <video src={task.media_url} className="w-full h-full object-cover opacity-80" />
                              ) : (
                                 <img src={task.media_url} alt="Task" className="w-full h-full object-cover opacity-90" />
                              )}
                              {task.media_type === 'video' && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm shadow-sm"><Play size={10} className="text-white fill-white" /></div></div>}
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-[8px] text-white text-center font-bold py-0.5">Site</div>
                            </a>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 mb-1.5">
                            <p className="text-sm font-black text-gray-900 truncate">{task.category}</p>
                            <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap w-max bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                              {formatDateTime(task.created_at)}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-gray-600 line-clamp-2 leading-snug bg-white px-3 py-2 rounded-lg border border-gray-100">
                            {cleanRemarks || 'No remarks provided.'}
                          </p>
                          {task.voice_note_url && (
                            <a href={task.voice_note_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg w-max transition-colors shadow-sm">
                              <Mic size={12} /> Play Voice Note
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                <PenLine size={14} className="text-purple-500" /> Digital Signatures
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Project Manager Signature</p>
                  {project.pm_signature_url ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 h-24 flex items-center justify-center">
                      <img src={project.pm_signature_url} alt="PM Signature" className="max-h-full object-contain mix-blend-multiply" />
                    </div>
                  ) : <p className="text-xs text-gray-400 italic">No signature found</p>}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Acknowledgement</p>
                  {project.customer_ack_signature_url ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 h-24 flex items-center justify-center">
                      <img src={project.customer_ack_signature_url} alt="Customer Signature" className="max-h-full object-contain mix-blend-multiply" />
                    </div>
                  ) : <p className="text-xs font-semibold text-gray-400 italic flex h-24 items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">Skipped by PM</p>}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            STATE 4: NORMAL WORKING DAY (INCLUDING AWAITING COUNTERTOP)
            ========================================================================= */}
        {['assigned', 'submitted', 'in_progress', 'snag_reopened', 'awaiting_countertop', 'countertop_completed'].includes(status) && (
          <>
            {/* ── Start Day (If not checked in today) ── */}
            {!dailyLog ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <MapPin size={16} className="text-[#8ED26B]" /> Morning Check-in
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <label className="relative border-2 border-dashed border-gray-300 rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer hover:border-[#8ED26B] hover:bg-green-50/50 transition-colors overflow-hidden group">
                    {selfie ? (
                      <img src={selfie.preview} alt="Selfie" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera size={24} className="text-gray-300 mb-2 group-hover:text-[#5aaa3a]" />
                        <span className="text-xs font-bold text-gray-500 group-hover:text-[#5aaa3a]">Take Selfie *</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="user" onChange={(e) => handleFileChange(e, setSelfie)} className="hidden" />
                  </label>

                  <label className="relative border-2 border-dashed border-gray-300 rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer hover:border-[#8ED26B] hover:bg-green-50/50 transition-colors overflow-hidden group">
                    {sitePhoto ? (
                      <img src={sitePhoto.preview} alt="Site" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Hammer size={24} className="text-gray-300 mb-2 group-hover:text-[#5aaa3a]" />
                        <span className="text-xs font-bold text-gray-500 group-hover:text-[#5aaa3a]">Site Photo *</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, setSitePhoto)} className="hidden" />
                  </label>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2.5 mb-6">
                  <MapPin size={16} className="text-blue-500 shrink-0" />
                  <p className="text-xs font-semibold text-blue-800">Your GPS location and time will be recorded automatically.</p>
                </div>

                <button 
                  onClick={handleStartDay} 
                  disabled={submitting || !selfie || !sitePhoto} 
                  className="w-full py-4 text-white rounded-xl text-sm font-black flex justify-center items-center gap-2 shadow-md disabled:opacity-50 transition-all"
                  style={{ backgroundColor: (selfie && sitePhoto) ? '#8ED26B' : '#9ca3af' }}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : <Clock size={18} />} Start Day
                </button>
              </div>
            ) : (
              
              /* ── Working / Tasks (If checked in) ── */
              <div className="space-y-6">
                
                {/* ── SHOW ONLY IF NOT SIGNING OFF ── */}
                {!showSignOff && (
                  <>
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
                      
                      {/* --- TOP PROGRESS TRACKER (Titles) --- */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {TASK_STEPS.map((step, idx) => {
                          const isCompleted = completedCategories.includes(step);
                          const isActive = taskCategory === step;
                          return (
                            <div key={step} className={`flex-auto sm:flex-initial px-3 py-2 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-2 transition-colors ${
                              isCompleted ? 'bg-green-50 border-green-200 text-green-700' : 
                              isActive ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 
                              'bg-gray-50 border-gray-200 text-gray-500'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                              ) : (
                                <span className={`w-4 h-4 shrink-0 rounded-full bg-white border border-current flex items-center justify-center text-[9px] ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                                  {idx + 1}
                                </span>
                              )}
                              <span className="leading-tight text-center sm:text-left">{step}</span>
                            </div>
                          )
                        })}
                      </div>

                      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                        <Upload size={16} className="text-blue-500" /> Log Task Update
                      </h2>
                      
                      <div className="space-y-4">
                        {/* 1. Category */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">1. Task Category *</label>
                          <select 
                            value={taskCategory} 
                            onChange={(e) => setTaskCategory(e.target.value)} 
                            className="w-full p-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                          >
                            <option value="" disabled>Select Task Category...</option>
                            {TASK_STEPS.map(step => (
                              <option 
                                key={step} 
                                value={step} 
                                disabled={completedCategories.includes(step) && step !== 'Other'}
                              >
                                {step} {completedCategories.includes(step) && step !== 'Other' ? '(Completed)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Worker Selfie + 3. Site Video Row */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">2 & 3. Mandatory Proofs *</label>
                          <div className="grid grid-cols-2 gap-3 h-28">
                            <label className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors overflow-hidden group">
                              {taskSelfie ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-50 p-2">
                                  <CheckCircle2 size={18} className="text-green-600 mb-1" />
                                  <span className="text-[10px] font-bold text-green-700 text-center">Selfie Captured</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <Camera size={20} className="text-gray-400 group-hover:text-blue-500" />
                                  <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Worker Selfie *</span>
                                </div>
                              )}
                              <input type="file" accept="image/*" capture="user" onChange={(e) => handleFileChange(e, setTaskSelfie, false)} className="hidden" />
                            </label>

                            <label className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors overflow-hidden group">
                              {taskVideo ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-50 p-2">
                                  <CheckCircle2 size={18} className="text-green-600 mb-1" />
                                  <span className="text-[10px] font-bold text-green-700 text-center">Video Recorded</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <Video size={20} className="text-gray-400 group-hover:text-blue-500" />
                                  <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-600">Site Video *</span>
                                </div>
                              )}
                              <input type="file" accept="video/*, image/*" capture="environment" onChange={(e) => handleFileChange(e, setTaskVideo, true)} className="hidden" />
                            </label>
                          </div>
                        </div>

                        {/* 4. Voice Note (Optional) */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">4. Voice Note (Optional)</label>
                          <div className="h-20">
                            {audioUrl ? (
                              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 h-full">
                                <Play size={18} className="text-green-600 shrink-0" />
                                <span className="text-[10px] font-bold text-green-700 flex-1 truncate">Voice Note Recorded</span>
                                <button onClick={deleteRecording} className="p-1.5 bg-white rounded-md text-green-700 hover:text-red-500 shadow-sm transition-colors"><X size={14}/></button>
                              </div>
                            ) : (
                              <button 
                                onClick={isRecording ? stopRecording : startRecording} 
                                className={`w-full h-full rounded-xl flex items-center justify-center gap-2 transition-all border-2 border-dashed ${isRecording ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'}`}
                              >
                                {isRecording ? (
                                  <>
                                    <Square size={18} className="text-red-500 animate-pulse fill-red-500" />
                                    <span className="text-xs font-bold text-red-600">Stop Recording</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={18} className="text-gray-400" />
                                    <span className="text-xs font-bold text-gray-500">Record Voice Note</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Remarks */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Remarks (Optional)</label>
                          <textarea 
                            value={remarks} 
                            onChange={(e) => setRemarks(e.target.value)} 
                            placeholder="Type remarks or issues found..." 
                            className="w-full p-3.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:outline-none h-20 resize-none transition-all"
                          />
                        </div>

                        {/* Submit Task Button */}
                        <button 
                          onClick={handleUploadTask} 
                          disabled={submitting || !taskCategory || !taskSelfie || !taskVideo} 
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-md disabled:opacity-50 transition-colors"
                        >
                          {submitting ? <Loader2 className="animate-spin" /> : <Upload size={18} />} Submit Task Update
                        </button>
                      </div>
                    </div>

                    {/* Handover Trigger (Hides entirely if already completely verified) */}
                    {status !== 'countertop_completed' && (
                      <div className={`p-5 rounded-2xl shadow-sm text-center border transition-all ${status === 'awaiting_countertop' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                        {status === 'awaiting_countertop' ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Clock size={24} className="text-blue-500 mb-1" />
                            <h3 className="text-sm font-black text-blue-800">Waiting for Admin</h3>
                            <p className="text-xs text-blue-600 font-medium">You have notified the admin. You can continue to log other tasks below while you wait for countertop verification.</p>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-sm font-black text-amber-800 mb-2">Finished the Kitchen Carcass?</h3>
                            <p className="text-xs text-amber-600 font-medium mb-4 px-4 leading-relaxed">Notify admin to verify countertops. You can still log other tasks while waiting.</p>
                            <button 
                              onClick={triggerHandover} 
                              disabled={submitting} 
                              className="w-full py-3 bg-white border border-amber-300 text-amber-700 rounded-xl text-sm font-bold shadow-sm hover:bg-amber-100 transition-colors"
                            >
                              Handover to Counter Top
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* SIGN OFF FORM (Appears only after clicking "Complete Job", replacing the task logger above) */}
                {showSignOff && (
                  <div className="bg-white rounded-2xl border border-blue-200 p-5 sm:p-6 shadow-xl animate-in slide-in-from-bottom-10 fade-in duration-500">
                    <h2 className="text-sm font-black text-blue-800 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <Flag size={16} className="text-blue-500" /> Final Project Sign Off
                    </h2>
                    
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-1.5">
                          <User size={14} /> Project Manager Name *
                        </label>
                        <input 
                          type="text" 
                          value={pmName} 
                          onChange={(e) => setPmName(e.target.value)} 
                          className="w-full p-3.5 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#8ED26B] focus:outline-none transition-all" 
                          placeholder="Enter PM Name" 
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <PenLine size={14} /> PM Digital Signature *
                          </label>
                          <button onClick={clearSig} className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <RotateCcw size={12} /> Clear
                          </button>
                        </div>
                        <canvas 
                          ref={sigCanvasRef} 
                          width={600} 
                          height={200} 
                          className="w-full h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-crosshair touch-none" 
                          style={{ touchAction: 'none' }}
                          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerOut={onUp} onPointerCancel={onUp} 
                        />
                        {!hasSig && <p className="text-[10px] text-red-400 font-bold mt-2 text-center">Signature Required</p>}
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <PenLine size={14} /> Customer Acknowledgement <span className="text-gray-400 normal-case">(Optional)</span>
                          </label>
                          <button onClick={clearCustSig} className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <RotateCcw size={12} /> Clear
                          </button>
                        </div>
                        <canvas 
                          ref={custSigCanvasRef} 
                          width={600} 
                          height={200} 
                          className="w-full h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-crosshair touch-none" 
                          style={{ touchAction: 'none' }}
                          onPointerDown={onCustDown} onPointerMove={onCustMove} onPointerUp={onCustUp} onPointerOut={onCustUp} onPointerCancel={onCustUp} 
                        />
                      </div>

                      <button 
                        onClick={handleFinalSignOffComplete} 
                        disabled={submitting || !pmName.trim() || !hasSig} 
                        className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-md disabled:opacity-50 transition-all"
                      >
                        {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} Submit Sign-Off
                      </button>
                    </div>
                  </div>
                )}

                {/* Fixed Bottom Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 z-30">
                  <div className="max-w-4xl mx-auto grid grid-cols-2 gap-3">
                    
                    {showSignOff ? (
                      <button 
                        onClick={() => setShowSignOff(false)} 
                        disabled={submitting} 
                        className="flex items-center justify-center gap-2 py-3.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-bold shadow-lg disabled:opacity-60 transition-all"
                      >
                        <ArrowLeft size={18} /> Back to Tasks
                      </button>
                    ) : (
                      <button 
                        onClick={triggerCompleteJob} 
                        disabled={submitting} 
                        className="flex items-center justify-center gap-2 py-3.5 bg-[#8ED26B] hover:brightness-95 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-60 transition-all"
                      >
                        <CheckCircle2 size={18} /> Complete Job
                      </button>
                    )}
                    
                    <button 
                      onClick={triggerEndDay} 
                      disabled={submitting} 
                      className="flex items-center justify-center gap-2 py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-60 transition-all"
                    >
                      <LogOut size={18} /> End Shift
                    </button>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmPrompt(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-600 border border-gray-100">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 mb-2">{confirmPrompt.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{confirmPrompt.message}</p>
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 flex gap-3 bg-gray-50">
              <button onClick={() => setConfirmPrompt(null)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-colors bg-white">Cancel</button>
              <button onClick={() => { confirmPrompt.onConfirm(); setConfirmPrompt(null); }} className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold bg-gray-900 hover:bg-black transition-colors shadow-sm">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { if(alertPrompt.onClose) alertPrompt.onClose(); setAlertPrompt(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center space-y-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${alertPrompt.type === 'success' ? 'bg-green-50 border-green-100 text-green-500' : 'bg-blue-50 border-blue-100 text-blue-500'}`}>
                {alertPrompt.type === 'success' ? <CheckCircle2 size={24} /> : <Info size={24} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 mb-2">{alertPrompt.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{alertPrompt.message}</p>
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button onClick={() => { if(alertPrompt.onClose) alertPrompt.onClose(); setAlertPrompt(null); }} className={`w-full py-3 rounded-xl text-white text-sm font-bold shadow-sm transition-colors ${alertPrompt.type === 'success' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}>Okay</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        html, body { overflow-x: hidden; }
      `}</style>
    </div>
  );
}