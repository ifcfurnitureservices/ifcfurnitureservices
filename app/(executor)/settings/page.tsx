'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  LogOut,
  RefreshCw,
  HelpCircle,
  Loader2,
  Phone,
  Mail,
  ShieldCheck,
  CircleUser,
  Package
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // Match the exact localStorage logic used in your Dashboard
    const eUser = localStorage.getItem('executorUser');
    const cUser = localStorage.getItem('clientUser');
    const aUser = localStorage.getItem('adminUser');

    if (cUser) {
      setUserData({ ...JSON.parse(cUser), type: 'Executive' });
    } else if (aUser) {
      setUserData({ ...JSON.parse(aUser), type: 'Admin' });
    } else if (eUser) {
      // ✅ Added Executor fallback
      setUserData({ ...JSON.parse(eUser), type: 'Executor' });
    } else {
      // If no session, redirect to home/login
      router.push('/my-orders');
    }
  }, [router]);

  const handleSyncNow = async () => {
    setSyncing(true);
    // Simulate a quick sync delay (replace with actual supabase fetch if needed)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSyncing(false);
    alert('Data synced successfully!');
  };

  const handleLogout = () => {
    setLoggingOut(true);
    // Clear ALL the exact keys used in your Dashboard
    localStorage.removeItem('clientUser');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('executorUser'); // ✅ Added Executor cleanup
    
    // Small delay for UI feedback
    setTimeout(() => {
      router.push('/my-orders');
    }, 500);
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#8ED26B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-gray-800">

      {/* ================================= HEADER ================================= */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-20 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-gray-100 transition-all text-gray-600 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-black text-gray-900">App Settings</h1>
        </div>
      </header>

      {/* ================================= MAIN ================================= */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── 1. User Profile ── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#f4fcf0] text-[#5aaa3a] border-2 border-[#8ED26B]/30 shrink-0">
              <CircleUser size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-gray-900 truncate">{userData.full_name || userData.name || 'User'}</p>
              <p className="text-sm text-gray-500 truncate">{userData.email || 'No email provided'}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-md" style={{ backgroundColor: '#8ED26B' }}>
                  {userData.type === 'Admin' ? <ShieldCheck size={10} /> : <Package size={10} />}
                  {userData.type}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">ID: {userData.id?.substring(0, 8)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Help & Support ── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <HelpCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Help & Support</p>
              <p className="text-xs text-gray-400">Facing issues? Contact the admin team.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <a
              href="tel:+919999999999" // REPLACE WITH ACTUAL ADMIN NUMBER
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <Phone size={16} className="text-green-600" />
              <div>
                <p className="text-sm font-bold text-gray-800">Call Support</p>
                <p className="text-xs text-gray-400">Speak directly to the dispatch team</p>
              </div>
            </a>
            
            <a
              href="mailto:support@instafitcore.com" // REPLACE WITH ACTUAL EMAIL
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <Mail size={16} className="text-blue-600" />
              <div>
                <p className="text-sm font-bold text-gray-800">Email Support</p>
                <p className="text-xs text-gray-400">support@instafitcore.com</p>
              </div>
            </a>
          </div>
        </section>

        {/* ── 4. Logout ── */}
        <section className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-500">
                <LogOut size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Logout</p>
                <p className="text-xs text-gray-400">Clear session and return to login</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 shadow-sm"
            >
              {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              Logout
            </button>
          </div>
        </section>

        {/* Footer Info */}
        <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest pt-4 pb-8">
          InstaFitCore Field Portal v1.0
        </p>

      </main>
    </div>
  );
}