'use client';
import { useEffect, useState } from 'react';

export function useCurrentUser() {
  const [profile, setProfile] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('adminUser');
    if (raw) {
      setProfile(JSON.parse(raw));
    }
    setLoaded(true);
  }, []);

  // True admin = logged in via Admin_Subadmin table (type: 'admin')
  const isAdmin = profile?.type === 'admin';

  // House staff permissions, e.g. ["dashboard", "orders", "reports"]
  const permissions: string[] = profile?.permissions || [];

  // Admin can always access everything. Staff can only access pages in their permissions list.
  const canAccess = (pageKey: string) => isAdmin || permissions.includes(pageKey);

  return { profile, isAdmin, permissions, canAccess, loaded };
}