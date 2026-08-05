'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Navigation,
  Briefcase,
  FileText,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Package,
  Hash,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
  AlertTriangle,
  Eye,
  Car
} from 'lucide-react';

export default function JobDetailPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Accept / Reject UI state ──
  const [submitting, setSubmitting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');

  // ── Journey Modal ──
  const [journeyModalOpen, setJourneyModalOpen] = useState(false);
  const redirectTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setOrder(data);
    }
    setLoading(false);
  };

  // ── LOCK: once a job has been accepted (this includes 'in_progress'), the
  // executor should never land on / stay on this detail page again — they
  // must go straight to the execution page instead. This runs as soon as
  // `order` is available (and also right after handleAccept updates it).
  useEffect(() => {
    if (!order) return;
    const st = (order.status || '').toLowerCase();
    const isCompletedStatus = st === 'completed' || st === 'done';
    const isAcceptedStatus = order.executive_response === 'accepted';
    if (isAcceptedStatus && !isCompletedStatus) {
      router.replace(`/my-orders/${orderId}/execute`);
    }
  }, [order, orderId, router]);

  const handleAccept = async () => {
    setSubmitting(true);
    setActionError('');
    const now = new Date();

    // 1. Mark accepted and set 'in_progress'
    const { error: sErr } = await supabase
      .from('orders')
      .update({
        executive_response: 'accepted',
        status: 'in_progress',
        responded_at: now.toISOString()
      })
      .eq('id', orderId);

    if (sErr) {
      console.error('Error accepting job:', sErr);
      setActionError(`Could not accept the job: ${sErr.message}`);
      setSubmitting(false);
      return;
    }

    // 2. Automatically trigger travel start inside execution table
    const { error: iErr } = await supabase.from('job_execution').insert({
      order_id: orderId,
      travel_start_time: now.toISOString()
    });

    if (iErr && iErr.code === '23505') {
       // if unique constraint violation, just update existing
       await supabase.from('job_execution').update({ travel_start_time: now.toISOString() }).eq('order_id', orderId);
    }

    // 3. Trigger animations and redirect directly to execution page
    setJourneyModalOpen(true);
    redirectTimer.current = setTimeout(() => {
      router.push(`/my-orders/${orderId}/execute`);
    }, 2800);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionError('A reason is required to reject this job.');
      return;
    }

    setSubmitting(true);
    setActionError('');

    const { error } = await supabase
      .from('orders')
      .update({
        executive_response: 'rejected',
        rejection_reason: rejectReason.trim(),
        responded_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error rejecting job:', error);
      setActionError(`Could not reject the job: ${error.message}`);
    } else {
      setRejectModalOpen(false);
      setRejectReason('');
      await fetchOrder();
    }
    setSubmitting(false);
  };

  const handleGoToExecution = () => {
    setJourneyModalOpen(true);
    redirectTimer.current = setTimeout(() => {
      router.push(`/my-orders/${orderId}/execute`);
    }, 2800);
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Job...</p>
      </div>
    );
  }

  // ── Not Found State ──
  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-center px-6">
        <Package size={56} className="text-gray-200 mb-4" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">Job Not Found</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-sm">
          This job may have been removed or the link is incorrect.
        </p>
        <Link
          href="/my-orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: '#8ED26B' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const status = (order.status || 'pending').toLowerCase();
  const isCompleted = status === 'completed' || status === 'done';
  const isAccepted = order.executive_response === 'accepted';

  // ── LOCK screen: while the redirect effect above kicks in, don't flash the
  // full detail page (with Accept/Reject etc.) for an already-accepted job.
  if (isAccepted && !isCompleted) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Opening Job Execution...</p>
      </div>
    );
  }

  const addressQuery = encodeURIComponent(
    `${order.address || ''} ${order.city || ''} ${order.pincode || ''}`.trim()
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;

  const isRejected = order.executive_response === 'rejected';
  const isPending = !isAccepted && !isRejected;

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
        @keyframes fadeText {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-fade-text-1 { animation: fadeText 0.5s ease-out 0.3s both; }
        .anim-fade-text-2 { animation: fadeText 0.5s ease-out 0.6s both; }
        .anim-fade-text-3 { animation: fadeText 0.5s ease-out 0.9s both; }
        .route-ring { animation: routePulse 1.8s ease-out infinite; }
      `}</style>

      {/* ================================= HEADER ================================= */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/my-orders')}
            className="p-2 sm:p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-gray-100 transition-all text-gray-600 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Job ID: <span className="text-gray-700">{order.job_id || order.order_id}</span>
            </p>
            <h1 className="text-sm sm:text-lg font-black text-gray-900 truncate">
              {order.product_name || 'Service Request'}
            </h1>
          </div>
          {isCompleted && (
            <span className="shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[11px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200 flex items-center gap-1 sm:gap-1.5">
              <CheckCircle2 size={12} className="sm:w-[13px] sm:h-[13px]" /> <span className="hidden xs:inline">Completed</span>
            </span>
          )}
          {isAccepted && !isCompleted && (
            <span className="shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 sm:gap-1.5">
              <CheckCircle2 size={12} className="sm:w-[13px] sm:h-[13px]" /> Accepted
            </span>
          )}
          {isRejected && (
            <span className="shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 sm:gap-1.5">
              <XCircle size={12} className="sm:w-[13px] sm:h-[13px]" /> Rejected
            </span>
          )}
        </div>
      </header>

      {/* ================================= MAIN ================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 flex flex-col gap-4 sm:gap-6 pb-28">

        {/* Status Row */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-sm border ${
            isCompleted ? 'bg-green-50 text-green-700 border-green-200' :
            ['in_progress', 'ongoing'].includes(status) ? 'bg-blue-50 text-blue-700 border-blue-200' :
            ['pending', 'scheduled'].includes(status) ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-gray-50 text-gray-600 border-gray-200'
          }`}>
            Job Status: {order.status?.replace('_', ' ') || 'Pending'}
          </span>
        </div>

        {/* Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

          {/* ── LEFT COLUMN (Customer, Address, Schedule) ── */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">

            {/* Customer Information */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">Customer Information</h2>
              <div className="space-y-3">
                <p className="text-base sm:text-lg font-black text-gray-900">{order.customer_name || 'Name not provided'}</p>
                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  {order.phone && (
                    <a
                      href={`tel:${order.phone}`}
                      className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#f4fcf0] border border-green-100 text-[#5aaa3a] font-bold text-sm hover:bg-green-50 transition-colors"
                    >
                      <Phone size={16} className="shrink-0" /> <span className="truncate">{order.phone}</span>
                    </a>
                  )}
                  {order.email && (
                    <div className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 font-semibold text-sm min-w-0">
                      <Mail size={16} className="shrink-0" /> <span className="truncate">{order.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Address & Navigation */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <MapPin size={14} className="text-[#8ED26B]" /> Job Location
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                    {order.address || 'Address not provided'}
                  </p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">
                    {[order.city, order.state, order.pincode].filter(Boolean).join(', ')}
                  </p>
                  {order.landmark && (
                    <p className="text-xs text-gray-400 mt-1">Landmark: {order.landmark}</p>
                  )}
                  {order.location_details && (
                    <p className="text-xs text-gray-400 mt-1">{order.location_details}</p>
                  )}
                </div>
                {order.address && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl border border-blue-100 transition-colors w-full sm:w-auto"
                  >
                    <Navigation size={16} /> Navigate
                  </a>
                )}
              </div>
            </section>

            {/* Schedule */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">Schedule</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                    <Calendar size={11} /> Date
                  </p>
                  <p className="text-sm font-black text-gray-800">{order.scheduled_date || 'TBD'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                    <Clock size={11} /> Time
                  </p>
                  <p className="text-sm font-black text-gray-800">{order.scheduled_time || 'TBD'}</p>
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT COLUMN (Job Details, Instructions) ── */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">

            {/* Job / Product Information */}
            <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h2 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <Briefcase size={14} className="text-[#8ED26B]" /> Job Information
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Service Type</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-800 break-words">{order.type_of_service || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Product</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-800 break-words">{order.product_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                    <Hash size={11} /> SKU
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-gray-800 break-words">{order.sku || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Quantity</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-800">{order.quantity ?? '—'}</p>
                </div>
                {order.product_link && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                      <LinkIcon size={11} /> Product Link
                    </p>
                    <a
                      href={order.product_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm font-bold text-blue-600 hover:underline break-all"
                    >
                      {order.product_link}
                    </a>
                  </div>
                )}
              </div>

              {order.image_url && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                    <ImageIcon size={11} /> Product Image
                  </p>
                  <div className="relative w-full max-w-xs h-36 sm:h-40 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                    <img
                      src={order.image_url}
                      alt={order.product_name || 'Product'}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Admin Instructions */}
            {order.remarks && (
              <section className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 sm:p-5">
                <h2 className="text-[11px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={14} /> Instructions
                </h2>
                <p className="text-sm font-medium text-gray-700 leading-relaxed">{order.remarks}</p>
              </section>
            )}

            {/* Rejection reason */}
            {isRejected && order.rejection_reason && (
              <section className="bg-red-50/50 rounded-2xl border border-red-100 p-4 sm:p-5">
                <h2 className="text-[11px] sm:text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <XCircle size={14} /> Your Rejection Reason
                </h2>
                <p className="text-sm font-medium text-gray-700 leading-relaxed">{order.rejection_reason}</p>
              </section>
            )}

          </div>
        </div>

        {/* Action Error */}
        {actionError && !rejectModalOpen && !journeyModalOpen && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm font-semibold px-4 py-3 rounded-xl">
            <AlertTriangle size={16} className="shrink-0" /> {actionError}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ACTION FOOTER — this page is now only ever reached while a job is
            still Pending (Accepted jobs redirect straight to /execute above).
            ═══════════════════════════════════════════════════════════════════════ */}

        {/* Pending — Show Accept + Reject */}
        {isPending && !isCompleted && (
          <section className="fixed sm:sticky bottom-0 sm:bottom-4 left-0 right-0 mt-auto bg-white/95 backdrop-blur-xl border-t sm:border border-gray-200 sm:rounded-2xl p-3 sm:p-4 shadow-lg grid grid-cols-2 gap-2.5 sm:gap-3 max-w-3xl sm:mx-auto w-full z-10">
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60 active:scale-[0.98]"
              style={{ backgroundColor: '#8ED26B' }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
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

        {/* Completed — Show "View Details" */}
        {isCompleted && (
          <section className="fixed sm:sticky bottom-0 sm:bottom-4 left-0 right-0 mt-auto bg-white/95 backdrop-blur-xl border-t sm:border border-gray-200 sm:rounded-2xl p-3 sm:p-4 shadow-lg max-w-3xl sm:mx-auto w-full z-10">
            <Link
              href={`/my-orders/${orderId}/execute`}
              className="flex items-center justify-center gap-2.5 px-5 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-black text-white shadow-lg transition-all hover:shadow-xl sm:hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: '#8ED26B' }}
            >
              <Eye size={20} className="shrink-0" /> View Completed Details
            </Link>
            <p className="text-center text-[10px] sm:text-[11px] text-gray-400 font-medium mt-2">
              View photos, timer logs, signature and full execution report
            </p>
          </section>
        )}

      </main>

      {/* ================================= REJECT MODAL ================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-black text-gray-900">Reject This Job</h3>
              <button
                onClick={() => { setRejectModalOpen(false); setRejectReason(''); setActionError(''); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason. This will be visible to the admin team.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. Outside my service area, scheduling conflict..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 resize-none"
            />
            {actionError && (
              <p className="text-xs font-semibold text-red-500 mt-2 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" /> {actionError}
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setRejectModalOpen(false); setRejectReason(''); setActionError(''); }}
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

      {/* ================================= JOURNEY STARTED MODAL ================================= */}
      {journeyModalOpen && (
        <div className="fixed inset-0 z-[60] bg-gradient-to-b from-blue-50/95 via-white/95 to-green-50/95 backdrop-blur-md flex items-center justify-center px-4">
          <div className="text-center max-w-sm w-full anim-slide-up">
            {/* Animated Icon */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6 sm:mb-8">
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full bg-blue-100 route-ring" />
              <div className="absolute inset-3 rounded-full bg-blue-50 route-ring" style={{ animationDelay: '0.4s' }} />
              {/* Center circle */}
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center shadow-xl">
                <Car size={36} className="text-white sm:w-10 sm:h-10" />
              </div>
            </div>

            {/* Text lines with staggered animation */}
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-3 anim-fade-text-1">
              Journey Started
            </h2>
            <p className="text-sm sm:text-base font-semibold text-gray-600 mb-2 anim-fade-text-2">
              Taking you to the execution screen
            </p>
            <p className="text-xs sm:text-sm text-gray-400 font-medium anim-fade-text-3">
              Travel time has begun. Log your arrival, before/after photos, and capture the customer's signature there.
            </p>

            {/* Animated dots */}
            <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8 anim-fade-text-3">
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