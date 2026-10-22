import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { agreementFromUnknown, clearLoginLegalBox, readLegalAgreement, setLoginLegalBoxChecked, toCompletedLegalAgreement, writeLegalAgreement } from '@/lib/legal-agreement';
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
import { Alert, Platform } from 'react-native';
import { navLogger } from '@/lib/nav-logger';
import { SESSION_RESTORE_MS, settleWithin } from '@/lib/settle-within';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, code?: string) => Promise<{ needsTwoFactor: true; codeReused: boolean } | { needsTwoFactor: false }>;
  signup: (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }, foodSafetyAcknowledged?: boolean) => Promise<{ success: boolean; requiresLogin: boolean; requiresCheckout?: boolean; chooseMembership?: boolean; needsEmailConfirmation?: boolean; confirmationEmailSent?: boolean }>;
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
  reactivateAccount: (email: string, password: string) => Promise<void>;
  openKitchen: () => Promise<void>;
  setOrderingAsBuyer: (on: boolean) => Promise<void>;
}

const STORAGE_KEY = 'auth_user_v2';
const orderingKey = (userId: string) => `ordering_as_buyer:${userId}`;
// CRITICAL: Session stored in SecureStore (encrypted Keychain/Keystore) for production-grade security
// This prevents session tokens from being accessible in device backups or by other apps
const SESSION_KEY = 'rork_secure_session';

export const [AuthProvider, useAuth] = createContextHook<AuthState>(() => {
  const [user, setUser] = useState<User | null>(null);
  const [orderingAsBuyer, setOrderingAsBuyerState] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [session, setSession] = useState<Session | null>(null);
  const mountedRef = useRef<boolean>(true);
  const trialPromptedRef = useRef(false);

  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const requestPlatemakerRoleMutation = trpc.auth.requestPlatemakerRole.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const reactivateAccountMutation = trpc.auth.reactivateAccount.useMutation();
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();
  const setAccountSecurityMutation = trpc.auth.setAccountSecurity.useMutation();
  const exportMyDataMutation = trpc.auth.exportMyData.useMutation();
  const { data: meData, error: meError, refetch: refetchMe } = trpc.auth.me.useQuery(undefined, {
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
    // Phase 3: Auth Hydration - Only starts after Phase 4 (Navigation Ready) is complete.
    // A stored session from the previous install is restored with a timeout so the
    // launch cover cannot wait on the network.
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
      [sessionStr, userStr] = await settleWithin(Promise.all([
        SecureStore.getItemAsync(SESSION_KEY).catch(() => null), // Gracefully handle if not found
        AsyncStorage.getItem(STORAGE_KEY), // User data can stay in AsyncStorage (less sensitive)
      ]), SESSION_RESTORE_MS).catch(() => [null, null] as [string | null, string | null]);

      // 2. Restore session if found. A profile without a token is not signed in.
      let sessionOk = false;
      if (sessionStr) {
        try {
          const sessionData = JSON.parse(sessionStr) as Session;
          const { data, error } = await settleWithin(supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          }), SESSION_RESTORE_MS);

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
            sessionOk = true;
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
          navLogger.error('hooks/auth-context.tsx:LOAD_USER', 'Session restore did not finish', undefined, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }

      // 3. Restore the profile only when the token restored. Otherwise Sign In is the next screen.
      if (sessionOk && userStr) {
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
      } else if (userStr) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        navLogger.stateChange('hooks/auth-context.tsx:LOAD_USER', 'profile_without_token_cleared', undefined, {});
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
      } catch {
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

  /**
   * Central Authentication State Listener
   * 
   * This is the "brain" of the app's authentication system. It listens for all
   * Supabase auth events (SIGNED_IN, SIGNED_OUT, USER_UPDATED, PASSWORD_RECOVERY)
   * and keeps the app's auth state in sync.
   * 
   * CRITICAL: This listener ensures the app "wakes up" when:
   * - User verifies email (via custom token flow or Supabase)
   * - User logs in from another device
   * - User's session is refreshed
   * - User clicks password reset link
   * 
   * Note: Our custom email verification flow (Resend) doesn't trigger Supabase events,
   * but this listener still handles standard Supabase auth flows (OAuth, password reset, etc.)
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Return immediately. Awaiting auth.me here calls getSession while Supabase
      // still holds its auth lock, so signup never starts and the 15s timer fires.
      setTimeout(() => {
        void handleAuthEvent(event, nextSession);
      }, 0);
    });

    async function handleAuthEvent(event: string, nextSession: Session | null) {
      try {
        if (!mountedRef.current) return;

        console.log('[Auth Listener] Event:', event, { hasSession: !!nextSession, userId: nextSession?.user?.id });

        // Handle successful sign-in
        if (event === 'SIGNED_IN' && nextSession) {
          setSession(nextSession);
          await persistSession(nextSession);
          // Pull the latest profile/user from backend using the new session
          await refetchMe();
          addBreadcrumb('Supabase auth SIGNED_IN', 'auth', { 
            userId: nextSession.user?.id,
          });
        }

        // Handle email confirmation: USER_UPDATED fires when user confirms email via Supabase
        // Note: Our custom Resend email flow doesn't trigger this, but we handle it for completeness
        if (event === 'USER_UPDATED' && nextSession) {
          setSession(nextSession);
          await persistSession(nextSession);
          // Pull the latest profile/user after email confirmation
          await refetchMe();
          addBreadcrumb('Supabase auth USER_UPDATED', 'auth', { 
            userId: nextSession.user?.id,
            emailConfirmed: !!nextSession.user?.email_confirmed_at,
          });
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

        // Handle token refresh: TOKEN_REFRESHED fires when access token is refreshed
        if (event === 'TOKEN_REFRESHED' && nextSession) {
          setSession(nextSession);
          await persistSession(nextSession);
          // Silently update session without navigation
          console.log('[Auth Listener] Token refreshed');
        }

        // Handle sign out
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
        console.error('[Auth Listener] Error handling event:', event, e);
        captureException(e as Error, { context: 'onAuthStateChange', event });
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [persistSession, persistUser, refetchMe]);

  useEffect(() => {
    const id = user?.id;
    if (!id || user.role !== 'platemaker') {
      setOrderingAsBuyerState(false);
      return;
    }
    let alive = true;
    AsyncStorage.getItem(orderingKey(id)).then((value) => {
      if (alive) setOrderingAsBuyerState(value === '1');
    }).catch((error) => {
      captureException(error as Error, { context: 'loadOrderingAsBuyer' });
    });
    return () => {
      alive = false;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!meError) return;
    console.error('[auth.me] Failed:', meError);
    captureException(
      meError instanceof Error ? meError : new Error('auth.me failed'),
      { context: 'auth.me' },
    );
  }, [meError]);

  useEffect(() => {
    if (meData?.orderingRemoved && mountedRef.current) {
      supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      setSession(null);
      persistUser(null).catch(() => undefined);
      persistSession(null).catch(() => undefined);
      return;
    }
    if (meData && mountedRef.current) {
      setUser((current) => {
        const remote = !meData.metroArea || meData.metroArea === 'Remote/Other';
        const next = current && current.id === meData.id && current.kitchenOpened === true && remote
          ? { ...meData, kitchenOpened: true as const }
          : meData;
        persistUser(next).catch(err => captureException(err as Error, { context: 'persist meData' }));
        return next;
      });
      if (meData.trialExpired && !trialPromptedRef.current) {
        trialPromptedRef.current = true;
        Alert.alert(
          'Your free trial has ended',
          'Subscribe to keep Premium.',
          [{ text: 'See membership', onPress: () => router.push('/membership') }],
        );
      }
    }
  }, [meData, persistSession, persistUser]);

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

  const login = useCallback(async (email: string, password: string, code?: string) => {
    try {
      // Add timeout for stuck network requests (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Login request timed out. Please check your connection and try again.'));
        }, 10000);
      });

      const loginPromise = loginMutation.mutateAsync({ email, password, code });
      const result = await Promise.race([loginPromise, timeoutPromise]);
      if (result.needsTwoFactor) {
        return { needsTwoFactor: true as const, codeReused: result.codeReused === true };
      }
      const localAgreement = toCompletedLegalAgreement(await readLegalAgreement());
      const accountAgreement = agreementFromUnknown(result.legalSafetyAgreement);
      if (!localAgreement && !accountAgreement) {
        throw new Error('Complete the Legal & Safety page before signing in.');
      }
      if (!localAgreement && accountAgreement) {
        try {
          await writeLegalAgreement(accountAgreement);
        } catch (storageError) {
          console.error('[Login] Could not save the Legal & Safety agreement on this device', storageError);
        }
        setLoginLegalBoxChecked(true);
      }

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
      return { needsTwoFactor: false as const };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Complete the Legal & Safety page')) {
        throw error;
      }
      captureException(error as Error, { context: 'login' });
      // Re-throw with better error message for network issues
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('fetch'))) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }, [loginMutation, persistUser, persistSession]);

  const signup = useCallback(async (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }, foodSafetyAcknowledged?: boolean): Promise<{ success: boolean; requiresLogin: boolean; requiresCheckout?: boolean; chooseMembership?: boolean; needsEmailConfirmation?: boolean; confirmationEmailSent?: boolean }> => {
    try {
      // Add timeout for stuck network requests (15 seconds for signup)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Signup request timed out. Please check your connection and try again.'));
        }, 15000);
      });

      const signupPromise = signupMutation.mutateAsync({ 
        username, 
        email, 
        password,
        role,
        lat: location?.lat,
        lng: location?.lng,
        foodSafetyAcknowledged: foodSafetyAcknowledged || false,
      });

      const result = await Promise.race([signupPromise, timeoutPromise]);
      
      // A new signup has no session. The confirmation link is what allows sign-in.
      const chooseMembership = result.status === 'CHOOSE_MEMBERSHIP';
      const requiresCheckout = false;
      const needsEmailConfirmation = result.needsEmailConfirmation ?? false;
      const confirmationEmailSent = result.confirmationEmailSent !== false;
      const remoteMetro = !result.user.metroArea || result.user.metroArea === 'Remote/Other';
      const signedUpUser = chooseMembership && !remoteMetro ? { ...result.user, needsMembership: true as const } : result.user;
      
      if (result.session) {
        const opened = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (opened.error || !opened.data.session) {
          throw opened.error ?? new Error('The account was created, but it could not be opened.');
        }
        if (mountedRef.current) {
          setUser(signedUpUser);
          setSession(opened.data.session);
        }
        await persistUser(signedUpUser);
        await persistSession(opened.data.session);
        setSentryUser(result.user);
        addBreadcrumb('User signed up', 'auth', { userId: result.user.id, role: result.user.role, status: result.status, metro: result.metro });
        return { success: true, requiresLogin: false, requiresCheckout, chooseMembership, needsEmailConfirmation, confirmationEmailSent };
      } else {
        addBreadcrumb('User signed up (no session - needs login)', 'auth', { userId: result.user.id, role: result.user.role, status: result.status, metro: result.metro });
        return { success: true, requiresLogin: true, requiresCheckout, chooseMembership, needsEmailConfirmation, confirmationEmailSent };
      }
    } catch (error) {
      captureException(error as Error, { context: 'signup', role });
      // Re-throw with better error message for network issues
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('fetch'))) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }, [signupMutation, persistUser, persistSession]);

  const logout = useCallback(async () => {
    clearLoginLegalBox();
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
      captureException(error as Error, { context: 'updateProfile' });
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
    if (!user) throw new Error('Sign in to pause your account.');
    const result = await setAccountSecurityMutation.mutateAsync({ isPaused: true });
    if (!result.isPaused) throw new Error('Pause was not saved on the server.');
    await logout();
  }, [user, logout, setAccountSecurityMutation]);

  const unpauseAccount = useCallback(async () => {
    if (!user) throw new Error('Sign in to unpause your account.');
    const result = await setAccountSecurityMutation.mutateAsync({ isPaused: false });
    if (result.isPaused) throw new Error('Pause was not saved on the server.');
    const unpausedUser = { ...user, isPaused: result.isPaused, twoFactorEnabled: result.twoFactorEnabled };
    if (mountedRef.current) setUser(unpausedUser);
    await persistUser(unpausedUser);
  }, [user, persistUser, setAccountSecurityMutation]);

  const deleteAccount = useCallback(async () => {
    await deleteAccountMutation.mutateAsync(undefined);
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
    }
    await persistUser(null);
    await persistSession(null);
    await SecureStore.deleteItemAsync('lifetime_binding_token').catch(() => {});
  }, [deleteAccountMutation, persistSession, persistUser]);

  const setTwoFactorEnabled = useCallback(async (enabled: boolean) => {
    if (!user) throw new Error('Sign in to update two-factor.');
    const result = await setAccountSecurityMutation.mutateAsync({ twoFactorEnabled: enabled });
    if (result.twoFactorEnabled !== enabled) throw new Error('Two-factor was not saved on the server.');
    const updated = { ...user, isPaused: result.isPaused, twoFactorEnabled: result.twoFactorEnabled };
    if (mountedRef.current) setUser(updated);
    await persistUser(updated);
  }, [user, persistUser, setAccountSecurityMutation]);

  const changePassword = useCallback(async (current: string, newPassword: string) => {
    if (!user || !session || !user.email) return false;
    try {
      const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (check.error || !check.data.session) return false;
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
    const records = await exportMyDataMutation.mutateAsync();
    const payload = {
      type: 'user_data_export',
      generatedAt: records.generatedAt,
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
      orders: records.orders,
      messages: records.messages,
      payments: records.payments,
    };
    const content = JSON.stringify(payload, null, 2);
    return { filename: `my-data-${u?.username ?? 'user'}.json`, content, mimeType: 'application/json' };
  }, [exportMyDataMutation, user]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await resetPasswordMutation.mutateAsync({ email });
      addBreadcrumb('Password reset requested', 'auth');
      // The mutation always returns success for security (doesn't reveal if email exists)
      // We can show the message to the user
      return;
    } catch (error) {
      captureException(error as Error, { context: 'resetPassword' });
      throw error;
    }
  }, [resetPasswordMutation]);

  const setOrderingAsBuyer = useCallback(async (on: boolean) => {
    if (!user || user.role !== 'platemaker') return;
    setOrderingAsBuyerState(on);
    try {
      await AsyncStorage.setItem(orderingKey(user.id), on ? '1' : '0');
    } catch (error) {
      captureException(error as Error, { context: 'setOrderingAsBuyer' });
    }
  }, [user]);

  const visibleUser = useMemo(() => {
    if (!user) return null;
    const accountRole = user.role;
    const ordering = accountRole === 'platemaker' && orderingAsBuyer;
    return {
      ...user,
      accountRole,
      orderingAsBuyer: ordering,
      role: ordering ? 'platetaker' as const : accountRole,
    };
  }, [orderingAsBuyer, user]);

  const openKitchen = useCallback(async () => {
    if (!user || user.role !== 'platemaker') return;
    const next = { ...user, kitchenOpened: true as const };
    if (mountedRef.current) setUser(next);
    await persistUser(next);
  }, [persistUser, user]);

  const reactivateAccount = useCallback(async (email: string, password: string) => {
    try {
      await reactivateAccountMutation.mutateAsync({ email, password });
      addBreadcrumb('Account reactivation requested', 'auth');
      return;
    } catch (error) {
      captureException(error as Error, { context: 'reactivateAccount' });
      throw error;
    }
  }, [reactivateAccountMutation]);

  const authState = useMemo(() => ({
    user: visibleUser,
    session,
    isLoading,
    isAuthenticated: !!visibleUser && !!session,
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
    openKitchen,
    setOrderingAsBuyer,
  }), [visibleUser, session, isLoading, login, signup, logout, updateProfile, requestPlatemakerRole, pauseAccount, unpauseAccount, deleteAccount, setTwoFactorEnabled, changePassword, requestDataExport, resetPassword, reactivateAccount, openKitchen, setOrderingAsBuyer]);


  return authState;
});