'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminAuthModal({ isOpen, onClose }: AdminAuthModalProps) {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset the form when the modal closes
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

    try {
      // --- ADMIN LOGIN LOGIC ---
      const { data, error } = await supabase
        .from('Admin_Subadmin')
        .select('*')
        .ilike('email', email.trim().toLowerCase());

      if (error) throw error;

      if (!data || data.length === 0 || data[0].password_hash !== password.trim()) {
        setErrorMessage('Invalid admin email or password.');
        return;
      }

      // Save session data to localStorage
      localStorage.setItem('adminUser', JSON.stringify(data[0]));
      
      // Clear form and close modal
      setEmail('');
      setPassword('');
      onClose();

      // Redirect to the page containing your AdminSidebar
      router.push('/dashboard'); 

    } catch (err) {
      console.error("Supabase Error Details:", err); 
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

        {/* Header */}
        <div className="relative px-8 pt-8 pb-8 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 rounded-full opacity-20 blur-[60px] pointer-events-none" style={{ backgroundColor: '#8ED26B' }} />
          <button
            onClick={() => {
              setErrorMessage('');
              onClose();
            }}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X size={18} />
          </button>
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#edfae3' }}>
              <Image
                src="/logo.jpeg"
                alt="InstaFitCore Logo"
                width={200}
                height={60}
                className="w-auto h-8 object-contain block"
                priority
              />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Admin Portal</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">InstaFitCore Solutions — System Controls</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-5 space-y-5">

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                Admin Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@instafitcore.com"
                  className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
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

            {/* Sign In Button */}
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
            System issue? Contact IT support at{' '}
            <a
              href="mailto:it@instafitcore.com"
              className="font-bold hover:underline"
              style={{ color: '#5aaa3a' }}
            >
              it@instafitcore.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}