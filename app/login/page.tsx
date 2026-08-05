'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function ExecutorLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Fetch user data, including the 'role' column you confirmed
      const { data: executor, error: fetchError } = await supabase
        .from('executors')
        .select('id, full_name, email, phone, password_hash, status, role')
        .eq('phone', phone.trim())
        .single();

      if (fetchError || !executor) {
        setErrorMessage('No executor account found with this phone number.');
        setLoading(false);
        return;
      }

      if (executor.status !== 'active') {
        setErrorMessage('Your account is currently inactive. Please contact support.');
        setLoading(false);
        return;
      }

      if (!executor.password_hash) {
        setErrorMessage('No password set for this account. Please contact support.');
        setLoading(false);
        return;
      }

      // Direct password comparison
      if (password !== executor.password_hash) {
        setErrorMessage('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      // 2. Store session data, including the role
      localStorage.setItem('executorUser', JSON.stringify({
        id: executor.id,
        full_name: executor.full_name,
        email: executor.email,
        phone: executor.phone,
        type: 'executor',
        role: executor.role || 'Delivery', // Safely fallback if empty
      }));

      // 3. Redirect directly to the dashboard
      router.push('/my-orders');

    } catch (err) {
      console.error("Supabase Error Details:", err); 
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 border border-gray-100">

        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-7">
          <div className="p-2.5 rounded-xl mb-4" style={{ backgroundColor: '#edfae3' }}>
            <Image
              src="/logo.jpeg"
              alt="InstaFitCore Logo"
              width={200}
              height={60}
              className="w-auto h-10 object-contain block"
              priority
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#5aaa3a' }}>
            InstaFitCore
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            Executor Portal
          </h1>
          <p className="text-xs text-gray-400 mt-1 text-center">
            Sign in using the credentials provided by the operations team.
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100 font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              placeholder="Enter your phone number"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none transition placeholder-gray-400 text-gray-900"
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #8ED26B')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none transition pr-12 placeholder-gray-400 text-gray-900"
                onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #8ED26B')}
                onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition"
                style={{ color: '#8ED26B' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#5aaa3a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8ED26B')}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Sign In */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold transition duration-300 disabled:opacity-50 mt-2 text-white shadow-sm hover:shadow-md flex justify-center items-center gap-2"
            style={{ backgroundColor: '#8ED26B' }}
            onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#72bf4e')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
          >
            {loading ? 'Authenticating...' : 'Sign In as Executor'}
          </button>
        </form>
        
      </div>
    </div>
  );
}