'use client';

// ✅ 1. Add useEffect to your imports
import { useState, useEffect } from 'react'; 
import { createClient } from '@/app/utils/supabase/client';
import {
  X,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserAuthModal({ isOpen, onClose }: UserAuthModalProps) {
  const supabase = createClient();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  // ✅ 2. Add this useEffect block to reset the form when the modal closes
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

    // Query users table directly by email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, full_name, email, password_hash, status')
      .eq('email', formData.email.trim().toLowerCase())
      .single();

    if (fetchError || !user) {
      setLoading(false);
      setError('No account found with this email address.');
      return;
    }

    if (user.status !== 'active') {
      setLoading(false);
      setError('Your account is inactive. Please contact your administrator.');
      return;
    }

    // Direct password comparison (plain text)
    if (formData.password !== user.password_hash) {
      setLoading(false);
      setError('Incorrect password. Please try again.');
      return;
    }

    // ✅ Changed key to 'adminUser' so HomePortal detects the staff login
    localStorage.setItem('adminUser', JSON.stringify({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      type: 'user',
    }));

    setLoading(false);
    
    // ✅ Closes the modal and triggers HomePortal UI update seamlessly
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
          <div className="absolute right-0 top-0 w-48 h-48 rounded-full opacity-20 blur-[60px] pointer-events-none" style={{ backgroundColor: '#8ED26B' }} />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X size={18} />
          </button>
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#edfae3' }}>
              <ShieldCheck size={20} style={{ color: '#5aaa3a' }} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">User Portal</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">InstaFitCore Solutions — Staff Access</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-5">

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
                  placeholder="staff@instafitcore.com"
                  className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
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
                  className="w-full text-xs pl-10 pr-10 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
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
              style={{ backgroundColor: '#8ED26B' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#72bf4e'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#8ED26B'; }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Signing In...</>
                : <>Sign In to User Portal <ArrowRight size={15} /></>
              }
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 font-medium pt-1">
            Trouble signing in? Contact{' '}
            <a
              href="mailto:customersupport@instafitcore.com"
              className="font-bold hover:underline"
              style={{ color: '#5aaa3a' }}
            >
              system administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}