'use client';
import { useCurrentUser } from '@/app/utils/UsecurrentUser';

interface PageGuardProps {
  pageKey: string;
  children: React.ReactNode;
}

export default function PageGuard({ pageKey, children }: PageGuardProps) {
  const { canAccess, loaded } = useCurrentUser();

  if (!loaded) {
    return <div className="p-10 text-gray-400">Loading...</div>;
  }

  if (!canAccess(pageKey)) {
    return (
      <div className="p-10 text-center text-gray-500">
        You don't have access to this page. Contact your administrator.
      </div>
    );
  }

  return <>{children}</>;
}