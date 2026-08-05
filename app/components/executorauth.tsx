'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // 1. Imported the router
import { createClient } from '@/app/utils/supabase/client';
import {
  X,
  Wrench,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface ExecutorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExecutorAuthModal({ isOpen, onClose }: ExecutorAuthModalProps) {
  const router = useRouter(); // 2. Initialized the router
  const supabase = createClient();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  // Reset the form whenever the modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ email: '', password: '' });
      setError('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Query executors table directly by email
    const { data: executor, error: fetchError } = await supabase
      .from('executors')
      .select('id, full_name, email, phone, password_hash, status')
      .eq('email', formData.email.trim().toLowerCase())
      .single();

    if (fetchError || !executor) {
      setLoading(false);
      setError('No executor account found with this email address.');
      return;
    }

    if (executor.status !== 'active') {
      setLoading(false);
      setError('Your account is currently inactive. Please contact support.');
      return;
    }

    if (!executor.password_hash) {
      setLoading(false);
      setError('No password set for this account. Please contact support.');
      return;
    }

    // Direct password comparison (plain text, matching existing pattern)
    if (formData.password !== executor.password_hash) {
      setLoading(false);
      setError('Incorrect password. Please try again.');
      return;
    }

    // Stored under 'executorUser' so HomePortal can detect the login
    localStorage.setItem('executorUser', JSON.stringify({
      id: executor.id,
      full_name: executor.full_name,
      email: executor.email,
      phone: executor.phone,
      type: 'executor',
    }));

    setLoading(false);
    
    // 3. Trigger the redirect to the my-orders page
    router.push('/my-orders'); 
    
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="relative px-8 pt-8 pb-8 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 rounded-full opacity-20 blur-[60px] pointer-events-none" style={{ backgroundColor: '#f59e0b' }} />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X size={18} />
          </button>
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#fef3c7' }}>
              <Wrench size={20} style={{ color: '#b45309' }} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Executor Portal</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">InstaFitCore Solutions — Field Executor Access</p>
            </div>
          </div>
        </div>

        {/* Info note */}
        <div className="mx-8 mt-6 p-4 bg-amber-50 border border-amber-200/60 rounded-xl text-[11px] text-amber-700 font-medium leading-relaxed">
          Sign in using the executor credentials issued to you by InstaFitCore. Your account is created by our operations team.
        </div>

        {/* Body */}
        <div className="px-8 py-5 space-y-5">

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/50 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  placeholder="Enter your password"
                  className="w-full text-xs pl-10 pr-10 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/50 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 shadow-md disabled:opacity-60 mt-1"
              style={{ backgroundColor: '#f59e0b' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#d97706'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#f59e0b'; }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Signing In...</>
                : <>Sign In to Executor Portal <ArrowRight size={15} /></>
              }
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 font-medium pt-1 pb-2">
            Need access? Contact{' '}
            <a
              href="mailto:customersupport@instafitcore.com"
              className="font-bold hover:underline text-amber-600"
            >
              customersupport@instafitcore.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}