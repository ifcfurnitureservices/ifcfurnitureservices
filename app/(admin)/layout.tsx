'use client';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/app/components/adminSidebar';
import { useCurrentUser } from '@/app/utils/UsecurrentUser';
import { APP_PAGES } from '@/app/utils/pages';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { canAccess, loaded } = useCurrentUser();

  // Find which page this route corresponds to (e.g. "/reports" -> "reports")
  const matchedPage = APP_PAGES.find(p => p.path === pathname);
  const pageKey = matchedPage?.key;

  // If the current route isn't in our list, allow it through (e.g. login page, etc.)
  const allowed = !pageKey || canAccess(pageKey);

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">
        {!loaded ? (
          <div className="text-gray-400">Loading...</div>
        ) : allowed ? (
          children
        ) : (
          <div className="p-10 text-center text-gray-500">
            You don't have access to this page. Contact your administrator.
          </div>
        )}
      </main>
    </div>
  );
}