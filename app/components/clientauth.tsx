'use client';

import { useState, useEffect } from 'react'; 
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import Image from 'next/image';

import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Shield,
  CheckCircle,
  KeyRound
} from 'lucide-react';

interface ClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthFlow = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-reset';

export default function ClientAuthModal({ isOpen, onClose }: ClientAuthModalProps) {
  const supabase = createClient();
  const router = useRouter();

  // ── Flow & Core States ──
  const [flow, setFlow] = useState<AuthFlow>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // ── Login Data ──
  const [formData, setFormData] = useState({ email: '', password: '' });

  // ── Forgot Password Data ──
  const [resetEmail, setResetEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [verifiedClientId, setVerifiedClientId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset the form when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setFlow('login');
      setFormData({ email: '', password: '' });
      setResetEmail('');
      setOtpInput('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // ── 1. LOGIN LOGIC ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id, full_name, email, password_hash, status, service_type')
      .ilike('email', formData.email.trim()) 
      .single();

    if (fetchError || !client) {
      setLoading(false);
      setError('No client account found with this email address.');
      return;
    }

    if (client.status !== 'active') {
      setLoading(false);
      setError('Your account is currently inactive. Please contact support.');
      return;
    }

    if (!client.password_hash) {
      setLoading(false);
      setError('No password set for this account. Please contact support.');
      return;
    }

    if (formData.password !== client.password_hash) {
      setLoading(false);
      setError('Incorrect password. Please try again.');
      return;
    }

    localStorage.setItem('clientUser', JSON.stringify({
      id: client.id,
      full_name: client.full_name,
      email: client.email,
      service_type: client.service_type,
      type: 'client',
    }));

    setLoading(false);
    onClose(); 
    router.push('/client-dashboard');
  };

  // ── 2. FORGOT PASSWORD: SEND OTP ──
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('id, email')
        .ilike('email', resetEmail.trim())
        .single();

      if (fetchError || !data) {
        setError('No account found with this email address.');
        setLoading(false);
        return;
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      setVerifiedClientId(data.id);
      
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, otp: otp })
        });
      } catch (err) {
        console.log("Email API not configured. Proceeding anyway.");
      }

      console.log(`[TESTING] OTP for ${data.email} is: ${otp}`);

      showSuccessMsg(`An OTP has been sent to ${data.email}`);
      setFlow('forgot-otp');
    } catch (err: any) {
      setError('Error verifying email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── 3. FORGOT PASSWORD: VERIFY OTP ──
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (otpInput === generatedOtp) {
      showSuccessMsg('OTP Verified! You can now reset your password.');
      setFlow('forgot-reset');
      setOtpInput('');
    } else {
      setError('Invalid OTP. Please check the code and try again.');
    }
  };

  // ── 4. FORGOT PASSWORD: SAVE NEW PASSWORD ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ password_hash: newPassword })
        .eq('id', verifiedClientId);

      if (updateError) throw updateError;

      // Instantly switch back to the login view so they see the success message above the login form
      showSuccessMsg('Password successfully reset! You can now log in.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setFlow('login');
      
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">

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
              <h2 className="text-lg font-black tracking-tight">
                {flow === 'login' ? 'Client Portal' : 'Reset Password'}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {flow === 'login' ? 'InstaFitCore Solutions — Client Access' : 'Secure account recovery'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold animate-in slide-in-from-top-2">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
              <CheckCircle size={16} /> {success}
            </div>
          )}

          {/* ── FLOW 1: LOGIN ── */}
          {flow === 'login' && (
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
                    className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    Password
                  </label>
                  <button 
                    type="button"
                    onClick={() => { setFlow('forgot-email'); setError(''); setSuccess(''); }}
                    className="text-[11px] font-bold text-[#8ED26B] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 shadow-md disabled:opacity-60 mt-2"
                style={{ backgroundColor: '#8ED26B' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#72bf4e'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#8ED26B'; }}
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Signing In...</>
                  : <>Sign In to Client Portal <ArrowRight size={15} /></>
                }
              </button>
            </form>
          )}

          {/* ── FLOW 2: FORGOT PASSWORD - ENTER EMAIL ── */}
          {flow === 'forgot-email' && (
            <form onSubmit={handleSendOtp} className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-2">
                <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1.5"><Shield size={14}/> Identity Verification</h4>
                <p className="text-[11px] text-blue-600 mt-1 font-medium leading-relaxed">Enter your registered email address. We will send a secure 6-digit OTP to verify your identity.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Registered Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. name@company.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full text-xs pl-10 pr-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setFlow('login'); setError(''); }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !resetEmail}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-xs font-bold shadow-md transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#8ED26B' }}
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying...</> : <><ArrowRight size={14} /> Send OTP</>}
                </button>
              </div>
            </form>
          )}

          {/* ── FLOW 3: FORGOT PASSWORD - VERIFY OTP ── */}
          {flow === 'forgot-otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 text-center mb-2">
                <h4 className="text-xs font-bold text-amber-800">Check Your Email</h4>
                <p className="text-[11px] text-amber-700 mt-1 font-medium">We sent a verification code to <br/><strong>{resetEmail}</strong></p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide text-center">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="••••••"
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-xl font-mono px-4 py-3.5 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setFlow('forgot-email'); setOtpInput(''); setError(''); }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={otpInput.length !== 6}
                  className="flex-[2] py-3 rounded-xl text-white text-xs font-bold shadow-md transition-colors disabled:opacity-60 bg-slate-800 hover:bg-slate-900"
                >
                  Verify Code
                </button>
              </div>
            </form>
          )}

          {/* ── FLOW 4: FORGOT PASSWORD - RESET PASSWORD ── */}
          {flow === 'forgot-reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
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

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 shadow-md disabled:opacity-60 mt-2"
                style={{ backgroundColor: '#8ED26B' }}
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Save New Password'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}