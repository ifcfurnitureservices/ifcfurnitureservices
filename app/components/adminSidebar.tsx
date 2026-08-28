'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  CalendarClock,
  CreditCard,
  Layers,
  Receipt,
  UserCheck,
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/app/utils/UsecurrentUser';
import { APP_PAGES } from '@/app/utils/pages';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('adminUser');
    if (stored) {
      const user = JSON.parse(stored);
      setAdminEmail(user.email || '');
      const name = user.name || user.email?.split('@')[0] || 'Admin';
      setAdminName(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    // Redirects to the root page (app/page.tsx) where your login modal/buttons are
    router.push('/'); 
  };

  const { canAccess } = useCurrentUser();

  const allNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Order Intake', path: '/orders', icon: ShoppingCart },
    { name: 'Orders Schedule', path: '/schedule', icon: CalendarClock },
    { name: 'Transaction Details', path: '/execution-reports', icon: CreditCard },
    { name: 'Modular interior schedule', path: '/modular-admin-schedule', icon: Layers },
    { name: 'Modular Transactions Details', path: '/modular-report', icon: Receipt },
    { name: 'Executor attendance', path: '/attendace', icon: UserCheck },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/admin-settings', icon: Settings },
  ];

  const navItems = allNavItems.filter(item => {
    const matchedPage = APP_PAGES.find(p => p.path === item.path);
    return !matchedPage || canAccess(matchedPage.key);
  });

  const initials = adminName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-64 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 flex flex-col shadow-sm">

      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="relative w-full h-16">
          <Image src="/logo.jpeg" alt="INSTAFITCORE" fill className="object-contain" priority />
        </div>
      </div>

      <div className="px-6 pt-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Main Menu</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group ${isActive ? 'text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              style={isActive ? { backgroundColor: '#8ED26B' } : {}}
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-200'
                }`}>
                <Icon size={16} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'} />
              </span>
              <span className="text-sm">{item.name}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-80" />}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 border-t border-gray-100" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-xl">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#8ED26B' }}>
            {initials || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{adminName || 'Admin'}</p>
            <p className="text-[11px] text-gray-400 truncate">{adminEmail || '—'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-red-100 transition-all duration-200">
            <LogOut size={15} className="group-hover:text-red-500 transition-colors" />
          </span>
          Logout
        </button>
      </div>
    </aside>
  );
}