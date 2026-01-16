import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';
import { useAuth } from './auth-context';

interface AdminsState {
  isAdmin: boolean;
  canAccessAdminFeatures: boolean;
  canManageMetroCaps: boolean;
}

export const [AdminsProvider, useAdmins] = createContextHook<AdminsState>(() => {
  const { user } = useAuth();

  // Use is_admin flag from database (proper admin check)
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.isAdmin === true;
  }, [user]);

  const canAccessAdminFeatures = useMemo(() => {
    return isAdmin;
  }, [isAdmin]);

  const canManageMetroCaps = useMemo(() => {
    return isAdmin; // Admin-only feature
  }, [isAdmin]);

  return useMemo(() => ({ 
    isAdmin, 
    canAccessAdminFeatures,
    canManageMetroCaps,
  }), [isAdmin, canAccessAdminFeatures, canManageMetroCaps]);
});
