import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';
import { useAuth } from './auth-context';

interface AdminsState {
  isAdmin: boolean;
  canAccessAdminFeatures: boolean;
}

export const [AdminsProvider, useAdmins] = createContextHook<AdminsState>(() => {
  const { user } = useAuth();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.role === 'platemaker';
  }, [user]);

  const canAccessAdminFeatures = useMemo(() => {
    return isAdmin;
  }, [isAdmin]);

  return useMemo(() => ({ 
    isAdmin, 
    canAccessAdminFeatures 
  }), [isAdmin, canAccessAdminFeatures]);
});
