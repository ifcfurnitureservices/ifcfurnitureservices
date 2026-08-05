'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  LogOut,
  CircleUser,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  ChevronRight
} from 'lucide-react';

// ── Import Modals ──
import ExecutorAuthModal from '@/app/components/executorauth';
import UserAuthModal from '@/app/components/userauth';

const NAV_ITEMS = [
  { href: '/Executor-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-orders', label: 'Orders', icon: ClipboardList },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Auth & Session State ──
  const [executorModalOpen, setExecutorModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<{ type: 'executor' | 'user'; id: string; name: string; email: string } | null>(null);

  // ── Sliding nav indicator refs ──
  const navRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  // ── Check Session ──
  const checkSession = () => {
    const eUser = localStorage.getItem('executorUser');
    const aUser = localStorage.getItem('adminUser');

    if (eUser) {
      const u = JSON.parse(eUser);
      setActiveSession({ type: 'executor', id: u.id, name: u.full_name || u.name || 'Executor', email: u.email });
    } else if (aUser) {
      const u = JSON.parse(aUser);
      setActiveSession({ type: 'user', id: u.id, name: u.full_name || u.name || 'Admin', email: u.email });
    } else {
      setActiveSession(null);
    }
  };

  useEffect(() => {
    checkSession();
  }, [executorModalOpen, userModalOpen]);

  // ── Close mobile drawer on resize to desktop ──
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Lock body scroll while drawer is open ──
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // ── Position the sliding active-tab indicator under the current route ──
  useEffect(() => {
    const activeItem = NAV_ITEMS.find(item => item.href === pathname);
    const el = activeItem ? navRefs.current[activeItem.href] : null;
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth, opacity: 1 });
    } else {
      setIndicator(prev => ({ ...prev, opacity: 0 }));
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('executorUser');
    localStorage.removeItem('adminUser');
    setActiveSession(null);
    setMobileMenuOpen(false);
    router.push('/login');
  };

  return (
    <>
      <ExecutorAuthModal isOpen={executorModalOpen} onClose={() => { setExecutorModalOpen(false); checkSession(); }} />
      <UserAuthModal isOpen={userModalOpen} onClose={() => { setUserModalOpen(false); checkSession(); }} />

      <header className="sticky top-0 z-40 bg-[#FAFAF9]/90 backdrop-blur-xl border-b border-[#ECECEA] transition-all">
        <div className="max-w-[90rem] mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="relative bg-white p-1 sm:p-1.5 rounded-xl border border-[#ECECEA] transition-all duration-300 group-hover:shadow-md group-hover:border-[#8ED26B]/40">
              <Image src="/logo.jpeg" alt="InstaFitCore" width={180} height={50} className="w-auto h-8 sm:h-10 object-contain block" priority />
            </div>
          </Link>

          {/* ── Desktop nav: segmented control with sliding active indicator ── */}
          <nav className="hidden lg:flex items-center relative bg-white border border-[#ECECEA] rounded-full p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <div
              className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-[#8ED26B] to-[#5aaa3a] shadow-sm transition-all duration-300 ease-out"
              style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
            />
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => { navRefs.current[item.href] = el; }}
                  className={`relative z-10 flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* ── Desktop session / auth ── */}
          <div className="hidden lg:flex items-center gap-3.5 shrink-0">
            {activeSession ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 pr-4 border-r border-[#ECECEA]">
                  <div className="relative shrink-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#f4fcf0] text-[#5aaa3a] border border-green-100 shadow-inner">
                      <CircleUser size={20} />
                    </div>
                    {/* Signature: pulsing on-shift indicator */}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ED26B] opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#5aaa3a] ring-2 ring-white" />
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {activeSession.type === 'executor' ? 'Executive · On shift' : 'User · On shift'}
                    </span>
                    <span className="text-sm font-bold text-gray-800 whitespace-nowrap leading-tight">
                      {activeSession.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all text-gray-500"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setExecutorModalOpen(true)} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-white border border-[#ECECEA] hover:border-gray-300 transition-all">
                  <User size={16} className="text-[#5aaa3a]" /> Executive Login
                </button>
                <button onClick={() => setUserModalOpen(true)} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#8ED26B] hover:bg-[#72bf4e] transition-all shadow-sm">
                  <ShieldCheck size={16} /> Admin Login
                </button>
              </>
            )}
          </div>

          {/* ── Mobile trigger ── */}
          <div className="flex items-center gap-2 lg:hidden">
            {activeSession && (
              <div className="relative shrink-0">
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f4fcf0] text-[#5aaa3a] border border-green-100 shadow-inner">
                  <CircleUser size={17} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ED26B] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#5aaa3a] ring-2 ring-white" />
                </span>
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="p-2 rounded-xl text-gray-500 bg-white border border-[#ECECEA] hover:bg-gray-50 transition-all"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer: slide-in panel, not a dropdown ── */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-[82%] max-w-xs bg-[#FAFAF9] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-[#ECECEA] shrink-0">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              className="p-2 rounded-xl text-gray-500 bg-white border border-[#ECECEA] hover:bg-gray-50 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

            {/* Session card */}
            {activeSession ? (
              <div className="rounded-2xl border border-[#ECECEA] bg-white p-4 flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#f4fcf0] text-[#5aaa3a] border border-green-100 shadow-inner">
                    <CircleUser size={22} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ED26B] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#5aaa3a] ring-2 ring-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">
                    {activeSession.type === 'executor' ? 'Executive · On shift' : 'User · On shift'}
                  </p>
                  <p className="text-sm font-bold text-gray-800 truncate">{activeSession.name}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shrink-0"
                  aria-label="Log out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => { setMobileMenuOpen(false); setExecutorModalOpen(true); }}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-white border border-[#ECECEA] flex items-center justify-center gap-2 hover:border-gray-300 transition-all"
                >
                  <User size={16} className="text-[#5aaa3a]" /> Executive Login
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); setUserModalOpen(true); }}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#8ED26B] hover:bg-[#72bf4e] flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <ShieldCheck size={16} /> Admin Login
                </button>
              </div>
            )}

            {/* Nav links */}
            <nav className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1">Navigate</span>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#8ED26B] to-[#5aaa3a] text-white shadow-sm'
                        : 'bg-white border border-[#ECECEA] text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={17} />
                      {item.label}
                    </span>
                    <ChevronRight size={15} className={isActive ? 'text-white/80' : 'text-gray-300'} />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}