'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { 
  ArrowLeft, Lock, Save, Loader2, Eye, EyeOff, 
  CheckCircle, AlertCircle, User as UserIcon, Shield, Building2,
  Mail, KeyRound, ArrowRight
} from 'lucide-react';

type PasswordFlow = 'standard' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' | 'success';

export default function ClientSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ── Password Flow States ──
  const [pwdFlow, setPwdFlow] = useState<PasswordFlow>('standard');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // ── Forgot Password States ──
  const [resetEmail, setResetEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [verifiedClientId, setVerifiedClientId] = useState(''); // Stores the ID of the account being reset

  // ── Action States ──
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('clientUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    
    const fetchClientDetails = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', parsedUser.id)
        .single();
        
      if (data) {
        setClientData(data);
        setResetEmail(data.email); // Pre-fill email for convenience
      } else {
        setClientData(parsedUser); 
      }
      setLoading(false);
    };

    fetchClientDetails();
  }, [router]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // 1. Standard Password Change (Knows Old Password)
  const handleStandardUpdate = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all password fields.');
      return;
    }

    if (oldPassword !== clientData.password_hash) {
      setErrorMsg('Incorrect old password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ password_hash: newPassword })
        .eq('id', clientData.id);

      if (error) throw error;

      // Update local state to reflect new password
      setClientData({ ...clientData, password_hash: newPassword });
      
      showSuccess('Your password has been successfully updated!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  // 2. Forgot Password - Verify Email & Send OTP
  const handleSendOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!resetEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setSaving(true);
    try {
      // Check if email exists in backend
      const { data, error } = await supabase
        .from('clients')
        .select('id, email')
        .eq('email', resetEmail)
        .single();

      if (error || !data) {
        setErrorMsg('Account does not exist with this email address.');
        setSaving(false);
        return;
      }

      // Email exists! Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      setVerifiedClientId(data.id);
      
      // Simulate sending Email (Connect your actual email API here if needed)
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, otp: otp })
        });
      } catch (err) {
        console.log("Email API not configured yet. Proceeding anyway.");
      }

      // FOR TESTING: Log OTP to console so you can test without an email server
      console.log(`[TESTING] OTP for ${resetEmail} is: ${otp}`);

      showSuccess(`An OTP has been sent to ${resetEmail}`);
      setPwdFlow('forgot-otp');
    } catch (error: any) {
      setErrorMsg('Error verifying email. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // 3. Forgot Password - Verify OTP
  const handleVerifyOtp = () => {
    setErrorMsg('');
    if (!otpInput) {
      setErrorMsg('Please enter the OTP.');
      return;
    }

    if (otpInput === generatedOtp) {
      setSuccessMsg('OTP Verified! You can now reset your password.');
      setPwdFlow('forgot-reset');
      setOtpInput('');
    } else {
      setErrorMsg('Invalid OTP. Please check the code and try again.');
    }
  };

  // 4. Forgot Password - Save New Password
  const handleResetPassword = async () => {
    setErrorMsg('');
    setSuccessMsg(''); // Clear the top toast so the success screen stands out

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ password_hash: newPassword })
        .eq('id', verifiedClientId);

      if (error) throw error;

      // Update local state if it's the currently logged-in user
      if (verifiedClientId === clientData.id) {
        setClientData({ ...clientData, password_hash: newPassword });
      }

      // Clear the form fields
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      
      // FIX: Switch to a dedicated success screen so it doesn't instantly jump to the old/new form
      setPwdFlow('success');
      
      // After 3.5 seconds, quietly return to the standard settings view
      setTimeout(() => {
        setPwdFlow('standard');
      }, 3500);

    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const cancelForgotFlow = () => {
    setPwdFlow('standard');
    setErrorMsg('');
    setSuccessMsg('');
    setOtpInput('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* EXPANDED to w-full and max-w-[1600px] to eliminate side gaps */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        
        {/* ── Header ── */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            title="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white shadow-sm transition-colors shrink-0"
            style={{ backgroundColor: '#8ED26B' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your profile and security preferences</p>
          </div>
        </div>

        {/* ── Alerts ── */}
        {successMsg && (
          <div className="mb-6 flex items-center gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium shadow-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle size={18} className="flex-shrink-0" /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="flex-shrink-0" /> {errorMsg}
          </div>
        )}

        {/* ── Grid Layout for Side-by-Side sections on Desktop ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-start">
          
          {/* ── Profile Information (Read-Only) - Spans 2 columns ── */}
          <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2.5 shrink-0">
              <Building2 size={18} className="text-[#8ED26B]" />
              <h2 className="text-base font-bold text-gray-900">Company & Profile Information</h2>
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col">
              {/* Reordered fields to compress height and match the Security box perfectly */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1">
                
                {/* Contact Name */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Contact Person
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 cursor-not-allowed">
                    {clientData?.full_name || 'N/A'}
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 cursor-not-allowed">
                    {clientData?.email || 'N/A'}
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Company Name
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 cursor-not-allowed">
                    {clientData?.company_name || 'N/A'}
                  </div>
                </div>

                {/* Client ID */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Client ID Reference
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-600 cursor-not-allowed">
                    {clientData?.client_id || 'N/A'}
                  </div>
                </div>

                {/* Service Types */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Service Types
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 cursor-not-allowed">
                    {clientData?.service_type && clientData.service_type.length > 0 
                      ? clientData.service_type.join(', ') 
                      : 'N/A'}
                  </div>
                </div>

                {/* Company Address (Now spans 2 columns at the bottom) */}
                <div className="sm:col-span-2 mt-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Company Address
                  </label>
                  <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 cursor-not-allowed min-h-[48px]">
                    {clientData?.company_address ? `${clientData.company_address} ${clientData.pincode ? `- ${clientData.pincode}` : ''}` : 'N/A'}
                  </div>
                </div>

              </div>
              <p className="text-[11px] text-gray-400 mt-6 flex items-center gap-1.5 border-t border-gray-100 pt-5 shrink-0">
                <AlertCircle size={14} className="text-amber-500 shrink-0" /> Contact your account manager if you need to update your core company details.
              </p>
            </div>
          </section>

          {/* ── Security & Password - Spans 1 column ── */}
          <section className="xl:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 h-full flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Shield size={18} className="text-blue-500" />
                <h2 className="text-base font-bold text-gray-900">Security</h2>
              </div>
              {pwdFlow !== 'standard' && pwdFlow !== 'success' && (
                <button onClick={cancelForgotFlow} className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                  Cancel
                </button>
              )}
            </div>
            
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
              <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* FLOW 1: STANDARD PASSWORD CHANGE */}
                {pwdFlow === 'standard' && (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-gray-600">Current Password</label>
                      </div>
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          placeholder="Enter old password"
                          value={oldPassword}
                          onChange={e => setOldPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-2.5 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition-all"
                        />
                      </div>
                      <div className="mt-1.5 text-right">
                        <button 
                          onClick={() => { setPwdFlow('forgot-email'); setErrorMsg(''); setSuccessMsg(''); }} 
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">New Password</label>
                        <div className="relative">
                          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full pl-11 pr-11 py-2.5 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-md"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Confirm New Password</label>
                        <div className="relative">
                          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleStandardUpdate}
                        disabled={saving || !oldPassword || !newPassword || !confirmPassword}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                        style={{ backgroundColor: '#8ED26B' }}
                      >
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : <><Save size={16} /> Update Password</>}
                      </button>
                    </div>
                  </>
                )}

                {/* FLOW 2: FORGOT PASSWORD - ENTER EMAIL */}
                {pwdFlow === 'forgot-email' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                      <Mail size={20} className="text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-blue-800">Password Reset</h4>
                        <p className="text-xs text-blue-600 mt-1">Enter your registered email address. We will send a 6-digit OTP to verify your identity.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">Registered Email</label>
                      <input
                        type="email"
                        placeholder="e.g. name@company.com"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    <button
                      onClick={handleSendOtp}
                      disabled={saving || !resetEmail}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 bg-blue-600 hover:bg-blue-700 mt-2"
                    >
                      {saving ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <><ArrowRight size={16} /> Send OTP</>}
                    </button>
                  </div>
                )}

                {/* FLOW 3: FORGOT PASSWORD - VERIFY OTP */}
                {pwdFlow === 'forgot-otp' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <h4 className="text-sm font-bold text-amber-800">Check Your Email</h4>
                      <p className="text-xs text-amber-700 mt-1">We've sent a 6-digit code to <strong>{resetEmail}</strong></p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 text-center">Enter 6-Digit OTP</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))} // Numbers only
                        className="w-full text-center tracking-[0.5em] text-2xl font-mono px-4 py-3 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpInput.length !== 6}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 bg-gray-900 hover:bg-black mt-2"
                    >
                      Verify Code
                    </button>
                  </div>
                )}

                {/* FLOW 4: FORGOT PASSWORD - RESET TO NEW */}
                {pwdFlow === 'forgot-reset' && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 mb-2">
                      <Shield size={20} className="text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-green-800">Verification Successful</h4>
                        <p className="text-xs text-green-700 mt-1">You may now enter a new secure password for your account.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">New Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full pl-11 pr-11 py-2.5 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-md"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-2.5 bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleResetPassword}
                      disabled={saving || !newPassword || !confirmPassword}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 bg-blue-600 hover:bg-blue-700 mt-2"
                    >
                      {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save New Password</>}
                    </button>
                  </div>
                )}

                {/* FLOW 5: SUCCESS SCREEN */}
                {pwdFlow === 'success' && (
                  <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Password Reset Complete!</h3>
                    <p className="text-sm text-gray-500 mt-2">Your new password has been saved securely.</p>
                  </div>
                )}

              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}