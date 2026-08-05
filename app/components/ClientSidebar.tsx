'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, BarChart3, LogOut, Menu, X } from 'lucide-react';

export default function ClientSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // State for user details
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');

  // Automatically close the sidebar on mobile when a link is clicked
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Fetch client user data from local storage
  useEffect(() => {
    const stored = localStorage.getItem('clientUser');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setClientEmail(user.email || '');
        const name = user.name || user.email?.split('@')[0] || 'Client';
        setClientName(name.charAt(0).toUpperCase() + name.slice(1));
      } catch (error) {
        console.error("Error parsing client user data:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('clientUser');
    // Corrected route path: redirects to the root page (app/page.tsx)
    router.push('/'); 
  };

  // Icons now mirror the Admin sidebar's choices for the same concepts:
  // Order Intake -> ShoppingCart (was ClipboardList), Reports -> BarChart3 (was FileText)
  const navItems = [
    { name: 'Dashboard', path: '/client-dashboard', icon: LayoutDashboard },
    { name: 'Order Intake', path: '/order-intake', icon: ShoppingCart },
    { name: 'Modular Interior', path: '/modular-interior', icon: ShoppingCart },
    { name: 'Reports', path: '/report', icon: BarChart3 },
    { name: 'Modular Reports', path: '/modular-reports', icon: BarChart3 },
    { name: 'Settings', path: '/client-settings', icon: LayoutDashboard }
  ];

  const initials = clientName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* MOBILE HAMBURGER BUTTON */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-700 hover:bg-gray-50 transition"
      >
        <Menu size={24} />
      </button>

      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-gray-900/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 h-screen flex flex-col shadow-sm transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        
        {/* Header / Logo */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 relative">
          <div className="relative w-full h-16 md:pr-0 pr-8">
            <Image 
              src="/logo.jpeg" 
              alt="INSTAFITCORE" 
              fill 
              className="object-contain object-left md:object-center" 
              priority 
            />
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden absolute right-4 top-8 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Label */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Main Menu</p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group ${
                  isActive ? 'text-white shadow-md' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
                style={isActive ? { backgroundColor: '#8ED26B' } : {}}
              >
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                    isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-200'
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
        
        {/* Footer / Profile & Logout */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-xl">
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" 
              style={{ backgroundColor: '#8ED26B' }}
            >
              {initials || 'C'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{clientName || 'Client Portal'}</p>
              <p className="text-[11px] text-gray-400 truncate">{clientEmail || '—'}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-red-100 transition-all duration-200">
              <LogOut size={15} className="group-hover:text-red-500 transition-colors" />
            </span>
            Logout
          </button>
        </div>

      </aside>
    </>
  );
}