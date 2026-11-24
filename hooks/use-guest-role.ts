import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/auth-context';
import { readGuestRole } from '@/lib/guest-role';
import type { AccountRole } from '@/backend/lib/provider-profile';

/** Undefined while the signed-out role is still loading. Null once a signed-in account or an empty choice is known. */
export function useGuestRole(): AccountRole | null | undefined {
  const { isAuthenticated, isLoading } = useAuth();
  const [role, setRole] = useState<AccountRole | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    let live = true;
    readGuestRole().then((value) => {
      if (live) setRole(value);
    });
    return () => {
      live = false;
    };
  }, [isAuthenticated, isLoading]);

  if (isAuthenticated) return null;
  return role;
}
