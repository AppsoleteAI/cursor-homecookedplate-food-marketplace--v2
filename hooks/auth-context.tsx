import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import expo-secure-store with platform-specific shim for web compatibility
// Metro will automatically resolve to lib/expo-secure-store.web.ts on web platform
import * as SecureStore from '@/lib/expo-secure-store';
import { User } from '@/types';
import { trpc } from '@/lib/trpc';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { captureException, setUser as setSentryUser, addBreadcrumb } from '@/lib/sentry';
import { runHardwareAudit } from '@/lib/hardwareAudit';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { navLogger } from '@/lib/nav-logger';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }) => Promise<{ success: boolean; requiresLogin: boolean; requiresCheckout?: boolean }>;
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
// CRITICAL: Session stored in SecureStore (encrypted Keychain/Keystore) for production-grade security
// This prevents session tokens from being accessible in device backups or by other apps
const SESSION_KEY = 'rork_secure_session';

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
  const { data: meData, refetch: refetchMe, error: meError, isLoading: meLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });


  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Secure Session Persistence
   * 
   * Uses SecureStore (hardware-backed Keychain/Keystore) instead of AsyncStorage
   * for production-grade security. Stores the entire Supabase session object to
   * maintain compatibility with Supabase's auto-refresh logic.
   * 
   * CRITICAL: Must store full session object (not just token) for Supabase integration
   */
  const persistSession = useCallback(async (session: Session | null) => {
    try {
      if (session) {
        // Encrypt and store the WHOLE session object in SecureStore
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      } else {
        await SecureStore.deleteItemAsync(SESSION_KEY);
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
    // Phase 3: Auth Hydration - Only starts after Phase 4 (Navigation Ready) is complete
    // No timeout needed: RootLayout guarantees navigation context is ready before AuthProvider mounts
    navLogger.stateChange('hooks/auth-context.tsx:LOAD_USER', 'auth_hydration_start', undefined, {
      platform: Platform.OS,
    });

    // Declare outside try block so they're accessible in finally block
    let sessionStr: string | null = null;
    let userStr: string | null = null;

    try {
      // 1. Bootstrap: Pull encrypted session from SecureStore (async operation)
      // CRITICAL: SecureStore is asynchronous - must await before proceeding
      // This prevents navigation tree from mounting until session is hydrated
      [sessionStr, userStr] = await Promise.all([
        SecureStore.getItemAsync(SESSION_KEY).catch(() => null), // Gracefully handle if not found
        AsyncStorage.getItem(STORAGE_KEY), // User data can stay in AsyncStorage (less sensitive)
      ]);

      // 2. Restore session if found
      if (sessionStr) {
        try {
          const sessionData = JSON.parse(sessionStr) as Session;
          const { data, error } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });

          if (error || !data.session) {
            // Session invalid - clean up corrupted state
            await Promise.all([
              SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}), // Graceful cleanup
              AsyncStorage.removeItem(STORAGE_KEY),
            ]);
            navLogger.warn('hooks/auth-context.tsx:LOAD_USER', 'Session restore failed, cleared storage', undefined, {
              error: error?.message,
            });
          } else {
            // Session restored successfully
            if (mountedRef.current) {
              setSession(data.session);
            }
            await persistSession(data.session);
            navLogger.stateChange('hooks/auth-context.tsx:LOAD_USER', 'session_restored', undefined, {
              userId: data.session.user?.id,
            });
          }
        } catch (parseError) {
          // Corrupted session data - clean up
          await Promise.all([
            SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}), // Graceful cleanup
            AsyncStorage.removeItem(STORAGE_KEY),
          ]);
          navLogger.error('hooks/auth-context.tsx:LOAD_USER', 'Failed to parse session data', undefined, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }

      // 3. Restore user if found
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr) as Omit<User, 'createdAt'> & { createdAt?: string };
          // Hydrate Dates (AsyncStorage stores them as strings)
          const hydrated: User = {
            ...parsed,
            createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
          };
          if (mountedRef.current) {
            setUser(hydrated);
          }
          navLogger.stateChange('hooks/auth-context.tsx:LOAD_USER', 'user_restored', undefined, {
            userId: hydrated.id,
            role: hydrated.role,
          });
        } catch (parseError) {
          // Corrupted user data - clean up
          await AsyncStorage.removeItem(STORAGE_KEY);
          navLogger.error('hooks/auth-context.tsx:LOAD_USER', 'Failed to parse user data', undefined, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }
    } catch (error) {
      // Critical error during hydration - log and clean up
      navLogger.error('hooks/auth-context.tsx:LOAD_USER', 'AUTH_HYDRATION_FAILURE', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      captureException(error as Error, { context: 'loadUser' });
      
      // Clean up potentially corrupted state
      try {
        await Promise.all([
          SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}), // Graceful cleanup
          AsyncStorage.removeItem(STORAGE_KEY),
        ]);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    } finally {
      // 4. Mark hydration complete - no timeout needed
      // The promise settles naturally, and navigation context is guaranteed ready
      if (mountedRef.current) {
        setIsLoading(false);
      }
      navLogger.stateChange('hooks/auth-context.tsx:LOAD_USER', 'auth_hydration_complete', undefined, {
        hasSession: !!sessionStr,
        hasUser: !!userStr,
      });
    }
  }, [persistSession]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Keep local state in sync with Supabase auth events (critical for OAuth / deep link redirects)
  // Handles Auth Gap: When user confirms email, USER_UPDATED fires and app "wakes up"
  // Navigation to root triggers [2026-01-09] navigation lock in app/index.tsx
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
          // Navigate to root to trigger [2026-01-09] navigation lock
          // app/index.tsx will handle routing based on user role
          router.replace('/');
        }

        // Handle email confirmation: USER_UPDATED fires when user confirms email
        if (event === 'USER_UPDATED' && nextSession) {
          setSession(nextSession);
          await persistSession(nextSession);
          // Pull the latest profile/user after email confirmation
          await refetchMe();
          addBreadcrumb('Supabase auth USER_UPDATED', 'auth', { userId: nextSession.user?.id });
          // Navigate to root to trigger [2026-01-09] navigation lock
          // This ensures the app "wakes up" and routes user correctly after email confirmation
          router.replace('/');
        }

        // Handle password recovery: PASSWORD_RECOVERY fires when user clicks reset link
        // Force navigation to reset-password screen regardless of role to bypass [2026-01-09] lock
        // This ensures user can set new password before being redirected to their dashboard
        if (event === 'PASSWORD_RECOVERY' && nextSession) {
          setSession(nextSession);
          await persistSession(nextSession);
          addBreadcrumb('Supabase auth PASSWORD_RECOVERY', 'auth', { userId: nextSession.user?.id });
          // Force navigation to reset-password screen - bypasses role-based redirect
          router.replace('/(auth)/reset-password');
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          await persistSession(null);
          await persistUser(null);
          setSentryUser(null);
          addBreadcrumb('Supabase auth SIGNED_OUT', 'auth');
          // Navigate to login on sign out
          router.replace('/(auth)/login');
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

  // Hardware audit: run when user is authenticated
  useEffect(() => {
    if (!user || !session) return;

    let isMounted = true;

    const performAudit = async () => {
      try {
        const result = await runHardwareAudit(user.id);
        if (!isMounted) return;

        if (!result.allowed) {
          // Device mismatch for lifetime user - navigate to error screen
          // Note: This router.replace is acceptable here since it's not during initial mount
          // The RORK_INSTRUCTIONS.md pattern applies to app/index.tsx initial routing
          console.warn('[HardwareAudit] Device mismatch detected, navigating to hardware-mismatch screen');
          router.replace('/(auth)/hardware-mismatch');
        }
      } catch (error) {
        // Fail open: don't block user access on audit errors
        console.error('[HardwareAudit] Error during audit:', error);
      }
    };

    // Run audit after a short delay to avoid blocking initial load
    const timeoutId = setTimeout(performAudit, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [user, session]);

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

  const signup = useCallback(async (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }, foodSafetyAcknowledged?: boolean): Promise<{ success: boolean; requiresLogin: boolean; requiresCheckout?: boolean }> => {
    try {
      const result = await signupMutation.mutateAsync({ 
        username, 
        email, 
        password,
        role,
        lat: location?.lat,
        lng: location?.lng,
        foodSafetyAcknowledged: foodSafetyAcknowledged || false,
      });
      
      // Backend returns session: null because admin.createUser() doesn't create sessions
      // User will need to login after signup
      // Backend now returns status-based structure: { status: 'SUCCESS' | 'REDIRECT_TO_PAYMENT', user, session, metro, trialEndsAt? }
      const requiresCheckout = result.status === 'REDIRECT_TO_PAYMENT';
      
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
        addBreadcrumb('User signed up', 'auth', { userId: result.user.id, role: result.user.role, status: result.status, metro: result.metro });
        return { success: true, requiresLogin: false, requiresCheckout };
      } else {
        // No session - user created but needs to login separately
        // Just set user info for the success animation, don't persist session
        if (mountedRef.current) {
          setUser(result.user);
        }
        addBreadcrumb('User signed up (no session - needs login)', 'auth', { userId: result.user.id, role: result.user.role, status: result.status, metro: result.metro });
        return { success: true, requiresLogin: true, requiresCheckout };
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

  const authState = useMemo(() => ({
    user,
    session,
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
  }), [user, session, isLoading, login, signup, logout, updateProfile, requestPlatemakerRole, pauseAccount, unpauseAccount, deleteAccount, setTwoFactorEnabled, changePassword, requestDataExport, resetPassword, reactivateAccount]);


  return authState;
});