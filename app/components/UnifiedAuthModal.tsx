'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { X, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

interface UnifiedAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnifiedAuthModal({ isOpen, onClose }: UnifiedAuthModalProps) {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setErrorMessage('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    try {
      // 1. Try Admin table first
      const { data: adminData, error: adminError } = await supabase
        .from('Admin_Subadmin')
        .select('*')
        .ilike('email', trimmedEmail);

      if (adminError) throw adminError;

      if (adminData && adminData.length > 0 && adminData[0].password_hash === trimmedPassword) {
        localStorage.setItem('adminUser', JSON.stringify({ ...adminData[0], type: 'admin' }));
        setEmail('');
        setPassword('');
        onClose();
        router.push('/dashboard');
        return;
      }

      // 2. Fall back to house users table - Updated to use .ilike()
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email, password_hash, status, role, permissions')
        .ilike('email', trimmedEmail)
        .single();

      if (userError || !user) {
        setErrorMessage('Invalid email or password.');
        return;
      }

      if (user.status !== 'active') {
        setErrorMessage('Your account is inactive. Please contact your administrator.');
        return;
      }

      if (user.password_hash !== trimmedPassword) {
        setErrorMessage('Invalid email or password.');
        return;
      }

      localStorage.setItem('adminUser', JSON.stringify({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role || 'in-house staff',
        permissions: user.permissions || [],
        type: 'user',
      }));

      setEmail('');
      setPassword('');
      onClose();
      router.push('/dashboard');

    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">

        <div className="relative px-8 pt-8 pb-8 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 rounded-full opacity-20 blur-[60px] pointer-events-none" style={{ backgroundColor: '#8ED26B' }} />
          <button
            onClick={() => { setErrorMessage(''); onClose(); }}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X size={18} />
          </button>
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#edfae3' }}>
              <Image src="/logo.jpeg" alt="InstaFitCore Logo" width={200} height={60} className="w-auto h-8 object-contain block" priority />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">InstaFitCore Solutions — Portal Access</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-5 space-y-5">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@instafitcore.com"
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
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                ? <><Loader2 size={15} className="animate-spin" /> Authenticating...</>
                : <>Secure Login <ArrowRight size={15} /></>
              }
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 font-medium pt-1 pb-2">
            Trouble signing in? Contact{' '}
            <a href="mailto:it@instafitcore.com" className="font-bold hover:underline" style={{ color: '#5aaa3a' }}>
              it@instafitcore.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}