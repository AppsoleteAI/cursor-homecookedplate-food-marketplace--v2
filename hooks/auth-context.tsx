import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { trpc } from '@/lib/trpc';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { captureException, setUser as setSentryUser, addBreadcrumb } from '@/lib/sentry';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }) => Promise<{ success: boolean; requiresLogin: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'username' | 'email' | 'phone' | 'bio' | 'profileImage'>>) => Promise<void>;
  requestPlatemakerRole: () => Promise<void>;
  pauseAccount: () => Promise<void>;
  unpauseAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setTwoFactorEnabled: (enabled: boolean) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<boolean>;
  requestDataExport: () => Promise<{ filename: string; content: string; mimeType: string }>;
  resetPassword: (email: string) => Promise<void>;
  reactivateAccount: (email: string) => Promise<void>;
}

const STORAGE_KEY = 'auth_user_v2';
const SESSION_KEY = 'auth_session_v2';

export const [AuthProvider, useAuth] = createContextHook<AuthState>(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [session, setSession] = useState<Session | null>(null);
  const mountedRef = useRef<boolean>(true);

  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const requestPlatemakerRoleMutation = trpc.auth.requestPlatemakerRole.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const reactivateAccountMutation = trpc.auth.reactivateAccount.useMutation();
  const { data: meData, refetch: refetchMe } = trpc.auth.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persistSession = useCallback(async (session: Session | null) => {
    try {
      if (session) {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      captureException(e as Error, { context: 'persistSession' });
    }
  }, []);

  const persistUser = useCallback(async (value: User | null) => {
    try {
      if (value) {
        const toStore = JSON.stringify({ ...value, createdAt: value.createdAt?.toString() ?? new Date().toString() });
        await AsyncStorage.setItem(STORAGE_KEY, toStore);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      captureException(e as Error, { context: 'persistUser' });
    }
  }, []);

  const loadUser = useCallback(async () => {
    console.log('[Auth] Starting loadUser...');
    const timeoutId = setTimeout(() => {
      console.warn('[Auth] loadUser timeout - forcing isLoading to false');
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }, 5000);

    try {
      console.log('[Auth] Checking AsyncStorage for session...');
      const sessionRaw = await AsyncStorage.getItem(SESSION_KEY);
      if (sessionRaw) {
        console.log('[Auth] Found stored session, attempting to restore...');
        const storedSession = JSON.parse(sessionRaw) as Session;
        const { data, error } = await supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (error || !data.session) {
          console.log('[Auth] Session restore failed, clearing storage');
          await AsyncStorage.removeItem(SESSION_KEY);
          await AsyncStorage.removeItem(STORAGE_KEY);
        } else {
          console.log('[Auth] Session restored successfully');
          if (mountedRef.current) {
            setSession(data.session);
          }
          await persistSession(data.session);
        }
      } else {
        console.log('[Auth] No stored session found');
      }

      console.log('[Auth] Checking AsyncStorage for user...');
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        console.log('[Auth] Found stored user');
        const parsed = JSON.parse(raw) as Omit<User, 'createdAt'> & { createdAt?: string };
        const hydrated: User = { ...parsed, createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date() };
        if (mountedRef.current) {
          setUser(hydrated);
        }
      } else {
        console.log('[Auth] No stored user found');
      }
    } catch (error) {
      console.error('[Auth] loadUser error:', error);
      captureException(error as Error, { context: 'loadUser' });
    } finally {
      clearTimeout(timeoutId);
      console.log('[Auth] loadUser complete, setting isLoading to false');
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [persistSession]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Keep local state in sync with Supabase auth events (critical for OAuth / deep link redirects)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      try {
        if (!mountedRef.current) return;

        if (event === 'SIGNED_IN' && nextSession) {
          setSession(nextSession);
          await persistSession(nextSession);
          // Pull the latest profile/user from backend using the new session
          await refetchMe();
          addBreadcrumb('Supabase auth SIGNED_IN', 'auth', { userId: nextSession.user?.id });
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          await persistSession(null);
          await persistUser(null);
          setSentryUser(null);
          addBreadcrumb('Supabase auth SIGNED_OUT', 'auth');
        }
      } catch (e) {
        captureException(e as Error, { context: 'onAuthStateChange', event });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [persistSession, persistUser, refetchMe]);

  useEffect(() => {
    if (meData && mountedRef.current) {
      setUser(meData);
      persistUser(meData).catch(err => captureException(err as Error, { context: 'persist meData' }));
    }
  }, [meData, persistUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (mountedRef.current) {
        setUser(result.user);
        setSession(result.session);
      }
      await persistUser(result.user);
      await persistSession(result.session);
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      setSentryUser(result.user);
      addBreadcrumb('User logged in', 'auth', { userId: result.user.id, role: result.user.role });
    } catch (error) {
      captureException(error as Error, { context: 'login', email });
      throw error;
    }
  }, [loginMutation, persistUser, persistSession]);

  const signup = useCallback(async (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }): Promise<{ success: boolean; requiresLogin: boolean }> => {
    try {
      const result = await signupMutation.mutateAsync({ 
        username, 
        email, 
        password,
        role,
        lat: location?.lat,
        lng: location?.lng,
      });
      
      // Backend returns session: null because admin.createUser() doesn't create sessions
      // User will need to login after signup
      if (result.session) {
        // Session returned (e.g., OAuth flows) - persist and go directly to app
        if (mountedRef.current) {
          setUser(result.user);
          setSession(result.session);
        }
        await persistUser(result.user);
        await persistSession(result.session);
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        setSentryUser(result.user);
        addBreadcrumb('User signed up', 'auth', { userId: result.user.id, role: result.user.role });
        return { success: true, requiresLogin: false };
      } else {
        // No session - user created but needs to login separately
        // Just set user info for the success animation, don't persist session
        if (mountedRef.current) {
          setUser(result.user);
        }
        addBreadcrumb('User signed up (no session - needs login)', 'auth', { userId: result.user.id, role: result.user.role });
        return { success: true, requiresLogin: true };
      }
    } catch (error) {
      captureException(error as Error, { context: 'signup', username, email, role });
      throw error;
    }
  }, [signupMutation, persistUser, persistSession]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      captureException(error as Error, { context: 'logout' });
    }
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
    }
    await persistUser(null);
    await persistSession(null);
    setSentryUser(null);
    addBreadcrumb('User logged out', 'auth');
  }, [logoutMutation, persistUser, persistSession]);

  const updateProfile = useCallback(async (updates: Partial<Pick<User, 'username' | 'email' | 'phone' | 'bio' | 'profileImage'>>) => {
    if (!mountedRef.current || !user) return;
    try {
      await updateProfileMutation.mutateAsync(updates);
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await persistUser(updatedUser);
      await refetchMe();
      addBreadcrumb('Profile updated', 'auth', { userId: user.id, updates: Object.keys(updates) });
    } catch (error) {
      captureException(error as Error, { context: 'updateProfile', updates });
      throw error;
    }
  }, [user, updateProfileMutation, persistUser, refetchMe]);

  const requestPlatemakerRole = useCallback(async () => {
    if (!mountedRef.current || !user) return;
    try {
      const result = await requestPlatemakerRoleMutation.mutateAsync();
      
      // Update local user state immediately with the new role
      if (result.user) {
        const updatedUser: User = {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          phone: result.user.phone || undefined,
          bio: result.user.bio || undefined,
          profileImage: result.user.profileImage || undefined,
          createdAt: result.user.createdAt,
          isPaused: result.user.isPaused,
          twoFactorEnabled: result.user.twoFactorEnabled,
        };
        
        if (mountedRef.current) {
          setUser(updatedUser);
        }
        await persistUser(updatedUser);
        
        // Refetch to ensure we have the latest data
        await refetchMe();
        
        addBreadcrumb('Role upgraded to platemaker', 'auth', { userId: user.id });
        setSentryUser(updatedUser);
      }
    } catch (error) {
      captureException(error as Error, { context: 'requestPlatemakerRole' });
      throw error;
    }
  }, [user, requestPlatemakerRoleMutation, persistUser, refetchMe]);

  const pauseAccount = useCallback(async () => {
    if (!mountedRef.current || !user) return;
    const pausedUser = { ...user, isPaused: true };
    setUser(pausedUser);
    await persistUser(pausedUser);
  }, [user, persistUser]);

  const unpauseAccount = useCallback(async () => {
    if (!mountedRef.current || !user) return;
    const unpausedUser = { ...user, isPaused: false };
    setUser(unpausedUser);
    await persistUser(unpausedUser);
  }, [user, persistUser]);

  const deleteAccount = useCallback(async () => {
    if (mountedRef.current) {
      setUser(null);
    }
    await persistUser(null);
  }, [persistUser]);

  const setTwoFactorEnabled = useCallback(async (enabled: boolean) => {
    if (!mountedRef.current || !user) return;
    const updated = { ...user, twoFactorEnabled: enabled };
    setUser(updated);
    await persistUser(updated);
  }, [user, persistUser]);

  const changePassword = useCallback(async (current: string, newPassword: string) => {
    if (!user || !session) return false;
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        captureException(new Error(error.message), { context: 'changePassword' });
        return false;
      }
      return true;
    } catch (e) {
      captureException(e as Error, { context: 'changePassword' });
      return false;
    }
  }, [user, session]);

  const requestDataExport = useCallback(async () => {
    const u = user;
    const payload = {
      type: 'user_data_export',
      generatedAt: new Date().toISOString(),
      user: u ? {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt?.toISOString?.() ?? String(u.createdAt),
        isPaused: u.isPaused ?? false,
        twoFactorEnabled: u.twoFactorEnabled ?? false,
        phone: u.phone ?? null,
        bio: u.bio ?? null,
        profileImage: u.profileImage ?? null,
      } : null,
    };
    const content = JSON.stringify(payload, null, 2);
    return { filename: `my-data-${u?.username ?? 'user'}.json`, content, mimeType: 'application/json' };
  }, [user]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const result = await resetPasswordMutation.mutateAsync({ email });
      addBreadcrumb('Password reset requested', 'auth', { email });
      // The mutation always returns success for security (doesn't reveal if email exists)
      // We can show the message to the user
      return;
    } catch (error) {
      captureException(error as Error, { context: 'resetPassword', email });
      throw error;
    }
  }, [resetPasswordMutation]);

  const reactivateAccount = useCallback(async (email: string) => {
    try {
      const result = await reactivateAccountMutation.mutateAsync({ email });
      addBreadcrumb('Account reactivation requested', 'auth', { email });
      // The mutation returns success/error message
      return;
    } catch (error) {
      captureException(error as Error, { context: 'reactivateAccount', email });
      throw error;
    }
  }, [reactivateAccountMutation]);

  return useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    updateProfile,
    requestPlatemakerRole,
    pauseAccount,
    unpauseAccount,
    deleteAccount,
    setTwoFactorEnabled,
    changePassword,
    requestDataExport,
    resetPassword,
    reactivateAccount,
  }), [user, isLoading, login, signup, logout, updateProfile, requestPlatemakerRole, pauseAccount, unpauseAccount, deleteAccount, setTwoFactorEnabled, changePassword, requestDataExport, resetPassword, reactivateAccount]);
});