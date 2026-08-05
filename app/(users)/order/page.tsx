'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import {
  User,
  ShieldCheck,
  LogOut,
  CircleUser,
  Package,
  Menu,
  X,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  Briefcase,
  Info,
  Hash,
  Link as LinkIcon,
  Car,
  Hammer,
  PauseCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

/* ─── Client Auth Modal (Inline for this example) ────────────────────────── */
function ClientAuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <h3 className="text-lg font-bold mb-4">Client Login</h3>
        <p className="text-sm text-gray-500 mb-6">Placeholder for Client Login Flow</p>
        <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg font-bold hover:bg-gray-200">Close</button>
      </div>
    </div>
  );
}

/* ─── User Auth Modal (Inline for this example) ──────────────────────────── */
function UserAuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <h3 className="text-lg font-bold mb-4">User Login</h3>
        <p className="text-sm text-gray-500 mb-6">Placeholder for User Login Flow</p>
        <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg font-bold hover:bg-gray-200">Close</button>
      </div>
    </div>
  );
}

/* ─── Work Status Mapper ─────────────────────────────────────────────────── */
function getWorkStatus(exec: any | undefined): { text: string; sub: string; icon: React.ReactNode; color: string; bg: string; border: string; live: boolean } | null {
  if (!exec) return null;
  if (exec.end_time) return null;
  if (exec.start_time && exec.is_paused) {
    const t = exec.paused_at ? new Date(exec.paused_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return { text: 'Work temporarily paused', sub: t ? `Paused at ${t}` : '', icon: <PauseCircle size={20} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', live: false };
  }
  if (exec.start_time) {
    const t = new Date(exec.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { text: 'Technician is working on your service', sub: `Started at ${t}`, icon: <Hammer size={20} />, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', live: true };
  }
  if (exec.travel_end_time) {
    const t = new Date(exec.travel_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { text: 'Technician has reached your location', sub: `Arrived at ${t}`, icon: <MapPin size={20} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', live: false };
  }
  if (exec.travel_start_time) {
    const t = new Date(exec.travel_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { text: 'Technician is on the way to your location', sub: `Left at ${t}`, icon: <Car size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', live: true };
  }
  return null;
}

export default function UserOrdersPage() {
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ type: 'client' | 'user'; name: string; email: string } | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [execMap, setExecMap] = useState<Record<string, any>>({});
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const checkSession = () => {
    if (typeof window !== 'undefined') {
      const cUser = localStorage.getItem('clientUser');
      const aUser = localStorage.getItem('adminUser');
      if (aUser) { const u = JSON.parse(aUser); setActiveSession({ type: 'user', name: u.full_name || u.name || 'Admin', email: u.email }); }
      else if (cUser) { const u = JSON.parse(cUser); setActiveSession({ type: 'client', name: u.full_name || u.name || 'Client', email: u.email }); }
      else { setActiveSession(null); setLoadingOrders(false); }
    }
  };

  useEffect(() => { checkSession(); }, [clientModalOpen, userModalOpen]);
  useEffect(() => { if (activeSession) fetchOrders(); }, [activeSession]);

  const fetchExecutions = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const { data } = await supabase.from('job_execution').select('*').in('order_id', ids);
      if (data) { const m: Record<string, any> = {}; data.forEach((e: any) => { m[e.order_id] = e; }); setExecMap(m); }
    } catch { /* silent */ }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (activeSession?.type === 'client') query = query.eq('email', activeSession.email);
    const { data, error } = await query;
    if (error) { console.error('Error fetching orders:', error); }
    else if (data) {
      setOrders(data);
      const ids = data.map((o: any) => o.id);
      await fetchExecutions(ids);
    }
    setLoadingOrders(false);
  };

  // Poll executions every 15s for live status
  useEffect(() => {
    if (orders.length === 0) return;
    const ids = orders.map((o: any) => o.id);
    pollRef.current = setInterval(() => fetchExecutions(ids), 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orders.length]);

  const handleLogout = () => {
    localStorage.removeItem('clientUser');
    localStorage.removeItem('adminUser');
    setActiveSession(null);
    setOrders([]);
    setExecMap({});
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-gray-800 scroll-smooth selection:bg-[#8ED26B]/30">
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.6); }
        }
        .live-dot { animation: livePulse 1.5s ease-in-out infinite; }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>

      <ClientAuthModal isOpen={clientModalOpen} onClose={() => { setClientModalOpen(false); checkSession(); }} />
      <UserAuthModal isOpen={userModalOpen} onClose={() => { setUserModalOpen(false); checkSession(); }} />

      {/* ================================= HEADER ================================= */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative bg-white p-1.5 rounded-2xl border border-gray-100/70 max-w-[180px] sm:max-w-[240px] transition-all duration-300 group-hover:shadow-md group-hover:border-gray-200">
              {/* Fallback text if logo fails to load */}
              <div className="flex items-center justify-center w-full h-12 sm:h-14 font-black text-[#5aaa3a]">
                InstaFitCore
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 font-semibold text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <Link href="/#about-us" className="hover:text-gray-900 transition-colors">Who We Are</Link>
            <Link href="/#gallery" className="hover:text-gray-900 transition-colors">Showcase</Link>
            <Link href="/#testimonials" className="hover:text-gray-900 transition-colors">Reviews</Link>
            <Link href="/#inquiry" className="hover:text-gray-900 transition-colors">Inquiry Form</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3.5">
            {activeSession ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#f4fcf0] text-[#5aaa3a] shrink-0 border border-green-100">
                    <CircleUser size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{activeSession.type === 'client' ? 'Client' : 'User'}</span>
                    <span className="text-sm font-bold text-gray-800 whitespace-nowrap leading-tight">{activeSession.name}</span>
                  </div>
                </div>
                <button onClick={handleLogout} title="Logout" className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all text-gray-500">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setUserModalOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 shadow-sm shadow-[#8ED26B]/20 hover:shadow-md"
                style={{ backgroundColor: '#8ED26B' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#72bf4e')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
              >
                <ShieldCheck size={16} />
                Login
              </button>
            )}
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2.5 rounded-xl text-gray-500 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-gray-100 bg-white/95 backdrop-blur-lg px-6 pt-2 pb-6 space-y-4 shadow-inner">
            <nav className="flex flex-col gap-3.5 font-semibold text-gray-600">
              <Link href="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <Link href="/#about-us" onClick={() => setMobileMenuOpen(false)}>Who We Are</Link>
              <Link href="/#gallery" onClick={() => setMobileMenuOpen(false)}>Showcase</Link>
              <Link href="/#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</Link>
              <Link href="/#inquiry" onClick={() => setMobileMenuOpen(false)}>Inquiry Form</Link>
            </nav>
            <hr className="border-gray-100" />
            {activeSession ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <CircleUser size={24} className="text-[#5aaa3a] shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{activeSession.type === 'client' ? 'Client' : 'User'}</p>
                    <p className="text-sm font-bold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] leading-snug">{activeSession.name}</p>
                  </div>
                </div>
                <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shrink-0"><LogOut size={16} /></button>
              </div>
            ) : (
              <button onClick={() => { setMobileMenuOpen(false); setUserModalOpen(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: '#8ED26B' }}>
                <ShieldCheck size={16} /> Login
              </button>
            )}
          </div>
        )}
      </header>

      {/* ================================= MAIN ================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
              <Package className="text-[#8ED26B]" size={32} />
              {activeSession?.type === 'client' ? 'My Service Orders' : 'System Orders'}
            </h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">Track, monitor, and manage your service requests in real-time.</p>
          </div>
          {activeSession && (
            <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Orders</span>
              <span className="text-lg font-black text-gray-800">{orders.length}</span>
            </div>
          )}
        </div>

        {!activeSession ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm max-w-2xl mx-auto mt-10">
            <ShieldCheck size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Login Required</h2>
            <p className="text-gray-500 mb-6">Please log in to view and manage orders.</p>
            <button onClick={() => setUserModalOpen(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5" style={{ backgroundColor: '#8ED26B' }}>
              <ShieldCheck size={18} /> Login to Portal
            </button>
            <p className="text-xs text-gray-400 mt-5">Are you a corporate client? <button onClick={() => { setUserModalOpen(false); setClientModalOpen(true); }} className="text-[#5aaa3a] font-bold hover:underline transition-all">Login here</button></p>
          </div>
        ) : loadingOrders ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Fetching order registry...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 border-dashed p-16 text-center shadow-sm">
            <Package size={56} className="mx-auto text-gray-200 mb-4" />
            <h2 className="text-lg font-bold text-gray-600 mb-2">No Orders Found</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">There are currently no active or completed orders in the system.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const exec = execMap[order.id];
              const ws = getWorkStatus(exec);
              const isCompleted = order.status?.toLowerCase() === 'completed' || order.status?.toLowerCase() === 'done';

              return (
                <div key={order.id} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col group">
                  
                  {/* ── LIVE WORK STATUS BANNER ── */}
                  {ws && (
                    <div className={`${ws.bg} border-b ${ws.border} px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden`}>
                      {ws.live && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-30" style={{ color: ws.color === 'text-indigo-600' ? '#6366f1' : ws.color === 'text-green-600' ? '#22c55e' : '#f59e0b', animation: 'shimmer 2s infinite linear' }} />
                      )}
                      <div className="flex items-center gap-3 relative z-10">
                        <div className={`w-10 h-10 rounded-full bg-white/60 shadow-sm border ${ws.border} flex items-center justify-center shrink-0 ${ws.color}`}>
                          {ws.icon}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${ws.color}`}>{ws.text}</span>
                            {ws.live && (
                              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: ws.color === 'text-indigo-600' ? '#6366f1' : ws.color === 'text-green-600' ? '#22c55e' : '#f59e0b' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-white live-dot" /> Live
                              </span>
                            )}
                          </div>
                          {ws.sub && <span className={`text-xs font-semibold ${ws.color} opacity-80 mt-0.5`}>{ws.sub}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-6 sm:p-8 flex-1">
                    
                    {/* Header Row: ID, Dates, Status */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <Hash size={14} className="text-gray-400" />
                          Order ID: {order.order_id || 'N/A'}
                        </div>
                        <h3 className="font-black text-gray-900 text-2xl tracking-tight">{order.product_name || 'Unnamed Product'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-gray-500">Ordered on {order.purchase_date || 'N/A'}</span>
                        </div>
                      </div>
                      
                      <div className="flex shrink-0">
                        <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                          isCompleted ? 'bg-green-50 text-green-700 border border-green-200' :
                          order.status?.toLowerCase() === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          order.status?.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {isCompleted ? <CheckCircle2 size={14} /> : <Loader2 size={14} className={order.status?.toLowerCase() === 'in_progress' ? 'animate-spin' : ''} />}
                          {order.status?.replace('_', ' ') || 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                      
                      {/* Left Column: Details & Location */}
                      <div className="lg:col-span-7 space-y-8">
                        
                        {/* Service Type & Meta Tags */}
                        <div className="space-y-4">
                          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#5aaa3a] bg-[#edfae3] border border-[#8ED26B]/20">
                            <Briefcase size={16} />
                            {order.type_of_service || 'Unclassified Service'}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2.5 text-sm font-medium">
                            {order.sku && <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg shadow-sm">SKU: {order.sku}</span>}
                            {order.quantity && <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg shadow-sm">Qty: {order.quantity}</span>}
                            {order.product_link && (
                              <a href={order.product_link} target="_blank" rel="noopener noreferrer" className="bg-gray-50 border border-gray-200 text-[#5aaa3a] px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 hover:bg-gray-100 transition-colors">
                                <LinkIcon size={14} /> View Product
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Client / Company info */}
                        {(order.client || order.service_company) && (
                          <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            {order.client && (
                              <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Corporate Client</p>
                                <p className="text-sm font-bold text-gray-800">{order.client}</p>
                              </div>
                            )}
                            {order.service_company && (
                              <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Service Company</p>
                                <p className="text-sm font-bold text-gray-800">{order.service_company}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Remarks */}
                        {order.remarks && (
                          <div className="flex items-start gap-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
                            <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest mb-1">Important Remarks</p>
                              <p className="text-sm text-gray-700 font-medium italic leading-relaxed">{order.remarks}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Schedule, Tech, Location */}
                      <div className="lg:col-span-5 space-y-6 lg:pl-8 lg:border-l border-gray-100">
                        
                        {/* Assignment */}
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Assigned Technician
                            <span className={`px-2 py-0.5 rounded border ${order.status?.toLowerCase() === 'pending' || !order.status ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              {order.status?.replace('_', ' ') || 'Pending'}
                            </span>
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200 text-gray-400">
                              <User size={20} />
                            </div>
                            <div className="flex flex-col items-start">
                              <p className="text-base font-black text-gray-900 leading-tight">{order.assigned_client_name || 'Awaiting Allocation'}</p>
                              {order.schedule_status && (
                                <span className={`mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                  order.schedule_status.toLowerCase() === 'scheduled' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                                }`}>
                                  {order.schedule_status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Scheduled Slot */}
                        <div className="bg-[#edfae3]/40 rounded-xl p-4 border border-[#8ED26B]/20">
                          <p className="text-[10px] font-black text-[#5aaa3a]/70 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <Calendar size={12} /> Scheduled Slot
                          </p>
                          <p className="text-sm font-black text-[#5aaa3a]">
                            {order.scheduled_date ? `${order.scheduled_date} ${order.scheduled_time ? `• ${order.scheduled_time}` : ''}` : 'Not Scheduled Yet'}
                          </p>
                        </div>

                        {/* Location */}
                        <div className="pt-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <MapPin size={12} /> Service Location
                          </p>
                          <p className="text-sm font-bold text-gray-800 leading-snug mb-1">{order.address || 'Address not provided'}</p>
                          <p className="text-xs font-semibold text-gray-500 mb-3">{[order.city, order.state, order.pincode].filter(Boolean).join(', ')}</p>
                          
                          {(order.landmark || order.location_details) && (
                            <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                              {order.landmark && <p className="text-xs text-gray-600"><span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mr-1">Landmark</span> {order.landmark}</p>}
                              {order.location_details && <p className="text-xs text-gray-600"><span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mr-1">Details</span> {order.location_details}</p>}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* ── FOOTER ACTIONS (Completed Only) ── */}
                  {isCompleted && exec && (
                    <div className="bg-gray-50 px-6 sm:px-8 py-4 border-t border-gray-100 flex items-center justify-between group-hover:bg-gray-100/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-green-500" />
                        <span className="text-sm font-bold text-gray-700">Service successfully finalized</span>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ================================= FOOTER ================================= */}
      <footer className="bg-white border-t border-gray-100 py-6 mt-auto shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-400 font-bold tracking-wider uppercase">
          <div>&copy; 2026 INSTAFITCORE Solutions Pvt. Ltd. | One Stop Solutions Platform. All Rights Reserved.</div>
          <div className="flex items-center gap-1.5 normal-case font-semibold text-gray-400 text-xs">
            <span className="uppercase text-[11px] font-bold tracking-wider text-gray-400">Developed by</span>
            <Link href="https://rakvih.in" target="_blank" rel="noopener noreferrer" className="text-[#5aaa3a] font-bold hover:underline hover:text-[#72bf4e] transition-colors tracking-wide">RAKVIH</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}