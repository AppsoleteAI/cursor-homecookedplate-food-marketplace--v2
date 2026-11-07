import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applySignInLegal, chooseLegalForm, clearLegalAgreement, clearLegalReadyForSignIn, clearLoginLegalBox, isLegalReadyForSignIn, LEGAL_SIGN_IN_MESSAGE, readLegalAgreement, todayStamp, toCompletedLegalAgreement, writeLegalAgreement } from '@/lib/legal-agreement';
import { accountAllowsSignIn, LEGAL_SAVE_FAILED_MESSAGE } from '@/backend/lib/legal-gate';
import { requestProviderSession } from '@/lib/provider-sign-in';
import { providerAccountBlock } from '@/backend/lib/provider-account';
import { isAccountRole, PROVIDER_ROLE_STORAGE_KEY, type AccountRole } from '@/backend/lib/provider-profile';
import { SECOND_FACTOR_MESSAGE } from '@/backend/lib/second-factor';
// Import expo-secure-store with platform-specific shim for web compatibility
// Metro will automatically resolve to lib/expo-secure-store.web.ts on web platform
import * as SecureStore from '@/lib/expo-secure-store';
import { User } from '@/types';
import { trpc, trpcProxyClient } from '@/lib/trpc';
import { createMemoryAuthClient, supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { captureException, setUser as setSentryUser, addBreadcrumb } from '@/lib/sentry';
import { runHardwareAudit } from '@/lib/hardwareAudit';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { navLogger } from '@/lib/nav-logger';
import { recoveryScreenIsOpen } from '@/lib/verification-link';
import { rememberAccessToken } from '@/lib/access-token';
import { SESSION_RESTORE_MS, settleWithin } from '@/lib/settle-within';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, code?: string) => Promise<{ needsTwoFactor: true } | { needsTwoFactor: false }>;
  loginWithProvider: (provider: 'apple' | 'google', role?: AccountRole | null) => Promise<{ needsTwoFactor: true } | { needsRole: true } | { done: true }>;
  verifyProviderCode: (code: string) => Promise<{ needsRole: true } | { done: true }>;
  finishProviderAccount: (role: AccountRole) => Promise<void>;
  beginTwoFactor: () => Promise<{ secret: string }>;
  confirmTwoFactor: (code: string) => Promise<void>;
  signup: (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }, foodSafetyAcknowledged?: boolean) => Promise<{ success: boolean; requiresLogin: boolean; requiresCheckout?: boolean; chooseMembership?: boolean; needsEmailConfirmation?: boolean; confirmationEmailSent?: boolean; metro?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'username' | 'email' | 'phone' | 'bio' | 'profileImage' | 'businessName'>>) => Promise<void>;
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

async function pendingLegalAgreement() {
  const stored = await readLegalAgreement();
  const ready = await isLegalReadyForSignIn();
  const agreement = chooseLegalForm({
    signedIn: false,
    createdAt: null,
    account: null,
    device: stored,
    legalReady: ready,
    today: todayStamp(),
  }) === 'device'
    ? toCompletedLegalAgreement(stored)
    : null;
  if (!agreement) return undefined;
  return { ...agreement, acknowledgedAt: new Date().toISOString() };
}

async function keepDeviceCopy(stamped: NonNullable<Awaited<ReturnType<typeof pendingLegalAgreement>>> | undefined) {
  if (!stamped) return;
  try {
    await writeLegalAgreement(stamped);
    await clearLegalReadyForSignIn();
  } catch (error) {
    console.error('[Login] Could not save the Legal & Safety agreement on this device', error);
  }
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
  const holdProviderRef = useRef(false);
  const signupBusy = useRef(false);
  const logoutMutation = trpc.auth.logout.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const requestPlatemakerRoleMutation = trpc.auth.requestPlatemakerRole.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const reactivateAccountMutation = trpc.auth.reactivateAccount.useMutation();
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();
  const setAccountSecurityMutation = trpc.auth.setAccountSecurity.useMutation();
  const finishProviderMutation = trpc.auth.finishProviderAccount.useMutation();
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
    // A stored session is restored to completion. Giving up early used to mark a
    // PlateMaker or PlateTaker signed out before the session arrived.
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

      // 2. Restore session if found. A profile without a token is not signed in.
      // The call is allowed to finish. A late answer is still this person's session.
      let sessionOk = false;
      if (sessionStr) {
        let sessionData: Session | null = null;
        try {
          sessionData = JSON.parse(sessionStr) as Session;
        } catch (parseError) {
          rememberAccessToken(null);
          await Promise.all([
            SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}),
            AsyncStorage.removeItem(STORAGE_KEY),
          ]);
          navLogger.error('hooks/auth-context.tsx:LOAD_USER', 'Session restore did not finish', undefined, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
        if (sessionData?.access_token && sessionData.refresh_token) {
          rememberAccessToken(sessionData.access_token);
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token,
            });

            if (error || !data.session) {
              rememberAccessToken(null);
              // Session invalid - clean up corrupted state
              await Promise.all([
                SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}), // Graceful cleanup
                AsyncStorage.removeItem(STORAGE_KEY),
              ]);
              navLogger.warn('hooks/auth-context.tsx:LOAD_USER', 'Session restore failed, cleared storage', undefined, {
                error: error?.message,
              });
            } else {
              let secondFactorPending = false;
              try {
                const level = await supabase.auth.mfa?.getAuthenticatorAssuranceLevel?.();
                secondFactorPending = level?.data?.nextLevel === 'aal2' && level.data.currentLevel !== 'aal2';
              } catch {
                secondFactorPending = false;
              }
              if (secondFactorPending) {
                rememberAccessToken(null);
                await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
                await Promise.all([
                  SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}),
                  AsyncStorage.removeItem(STORAGE_KEY),
                ]);
                navLogger.warn('hooks/auth-context.tsx:LOAD_USER', 'Stored session has not finished the authenticator', undefined, {
                  userId: data.session.user?.id,
                });
              } else {
                if (mountedRef.current) {
                  setSession(data.session);
                }
                sessionOk = true;
                await persistSession(data.session);
                navLogger.stateChange('hooks/auth-context.tsx:LOAD_USER', 'session_restored', undefined, {
                  userId: data.session.user?.id,
                });
              }
            }
          } catch (restoreError) {
            // Keep the stored session. A failed network call is not a sign-out.
            navLogger.error('hooks/auth-context.tsx:LOAD_USER', 'Session restore did not finish', undefined, {
              error: restoreError instanceof Error ? restoreError.message : String(restoreError),
            });
          }
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
      // still holds its auth lock, so signup and sign-in never start and the timer fires.
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
          if (holdProviderRef.current) return;
          rememberAccessToken(nextSession.access_token);
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
          rememberAccessToken(nextSession.access_token);
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
          rememberAccessToken(nextSession.access_token);
          setSession(nextSession);
          await persistSession(nextSession);
          addBreadcrumb('Supabase auth PASSWORD_RECOVERY', 'auth', { userId: nextSession.user?.id });
          // Force navigation to reset-password screen - bypasses role-based redirect
          router.replace('/(auth)/reset-password');
        }

        // Handle token refresh: TOKEN_REFRESHED fires when access token is refreshed
        if (event === 'TOKEN_REFRESHED' && nextSession) {
          rememberAccessToken(nextSession.access_token);
          setSession(nextSession);
          await persistSession(nextSession);
          // Silently update session without navigation
          console.log('[Auth Listener] Token refreshed');
        }

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          rememberAccessToken(null);
          setSession(null);
          setUser(null);
          await persistSession(null);
          await persistUser(null);
          setSentryUser(null);
          addBreadcrumb('Supabase auth SIGNED_OUT', 'auth');
          if (holdProviderRef.current) return;
          // A failed reset link signs the session out. Stay on that screen so the
          // person can request a new link. Other sign-outs still return to sign-in.
          if (!recoveryScreenIsOpen()) {
            router.replace('/(auth)/login');
          }
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
    const message = meError instanceof Error ? meError.message : '';
    if (message.includes(SECOND_FACTOR_MESSAGE)) {
      rememberAccessToken(null);
      settleWithin(supabase.auth.signOut({ scope: 'local' }), 2000).catch(() => undefined);
      setUser(null);
      setSession(null);
      persistUser(null).catch(() => undefined);
      persistSession(null).catch(() => undefined);
      return;
    }
    console.error('[auth.me] Failed:', meError);
    captureException(
      meError instanceof Error ? meError : new Error('auth.me failed'),
      { context: 'auth.me' },
    );
  }, [meError, persistSession, persistUser]);

  useEffect(() => {
    const legalMissing = Boolean(
      meData && !accountAllowsSignIn(meData.legalSafetyAgreement, new Date(meData.createdAt)),
    );
    if ((meData?.orderingRemoved || legalMissing) && mountedRef.current) {
      rememberAccessToken(null);
      settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
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
      if (!isMounted) return;
      try {
        await runHardwareAudit(user.id);
      } catch (error) {
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

      const stamped = await pendingLegalAgreement();
      const loginPromise = loginMutation.mutateAsync({ email, password, code, legalSafetyAgreement: stamped });
      const result = await Promise.race([loginPromise, timeoutPromise]);
      if (result.needsTwoFactor) {
        return { needsTwoFactor: true as const };
      }
      const createdAt = new Date(result.user.createdAt);
      if (await applySignInLegal(createdAt, result.legalSafetyAgreement) === 'block') {
        await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
        throw new Error(LEGAL_SIGN_IN_MESSAGE);
      }
      await keepDeviceCopy(stamped);

      rememberAccessToken(result.session.access_token);
      if (mountedRef.current) {
        setUser(result.user);
        setSession(result.session);
      }
      await persistUser(result.user);
      await persistSession(result.session);
      // setSession takes the same auth lock. A stuck refresh must not hold the
      // sign-in screen on the 10 second timer after the account already answered.
      await settleWithin(supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      }), 2000).catch(() => undefined);
      setSentryUser(result.user);
      addBreadcrumb('User logged in', 'auth', { userId: result.user.id, role: result.user.role });
      return { needsTwoFactor: false as const };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Complete the Legal & Safety page') || error.message.includes('could not be saved'))) {
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

  const acceptProviderSession = useCallback(async (role: AccountRole | null, provider: 'apple' | 'google' | 'saved') => {
    let stored: Awaited<ReturnType<typeof supabase.auth.getSession>>;
    try {
      stored = await settleWithin(supabase.auth.getSession(), SESSION_RESTORE_MS);
    } catch {
      throw new Error('That sign-in did not finish.');
    }
    const nextSession = stored.data.session;
    if (!nextSession?.user) {
      throw new Error('That sign-in did not finish.');
    }
    const listedFactors = await supabase.auth.mfa.listFactors();
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const verifiedTotp = (listedFactors.data?.totp?.length ?? 0) > 0;
    if (verifiedTotp && assurance.data?.currentLevel !== 'aal2') {
      return { needsTwoFactor: true as const };
    }
    rememberAccessToken(nextSession.access_token);

    const readProfile = async () => {
      const loaded = await supabase
        .from('profiles')
        .select('id, username, business_name, email, role, is_admin, phone, bio, profile_image, created_at, is_paused, two_factor_enabled, ordering_removed, legal_safety_agreement')
        .eq('id', nextSession.user.id)
        .maybeSingle();
      if (loaded.error) throw new Error('That sign-in could not be checked.');
      return loaded.data;
    };

    let profile = await readProfile();
    if (!profile) {
      if (!role) return { needsRole: true as const };
      await finishProviderMutation.mutateAsync({ role });
      profile = await readProfile();
    } else if (role === 'platemaker' && profile.role === 'platetaker') {
      await finishProviderMutation.mutateAsync({ role });
      profile = await readProfile();
    }
    const block = providerAccountBlock(profile ? {
      role: profile.role,
      is_paused: profile.is_paused,
      ordering_removed: profile.ordering_removed,
      email_confirmed_at: nextSession.user.email_confirmed_at,
    } : null);
    if (block || !profile) {
      await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
      throw new Error(block || 'Choose Order a Plate or Start Cooking to finish this account.');
    }
    const signedInUser = {
      id: profile.id,
      username: profile.username,
      businessName: typeof profile.business_name === 'string' ? profile.business_name : '',
      email: profile.email,
      role: profile.role as 'platemaker' | 'platetaker',
      isAdmin: profile.is_admin || false,
      phone: profile.phone,
      bio: profile.bio,
      profileImage: profile.profile_image,
      createdAt: new Date(profile.created_at),
      isPaused: profile.is_paused,
      twoFactorEnabled: profile.two_factor_enabled,
    };
    if (await applySignInLegal(signedInUser.createdAt, profile.legal_safety_agreement) === 'block') {
      await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
      throw new Error(LEGAL_SIGN_IN_MESSAGE);
    }
    const stamped = await pendingLegalAgreement();
    let gateRecord: unknown = profile.legal_safety_agreement;
    if (stamped) {
      try {
        await updateProfileMutation.mutateAsync({ legalSafetyAgreement: stamped });
        gateRecord = stamped;
        await keepDeviceCopy(stamped);
      } catch {
        rememberAccessToken(null);
        await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
        throw new Error(LEGAL_SAVE_FAILED_MESSAGE);
      }
    }
    if (!accountAllowsSignIn(gateRecord, signedInUser.createdAt)) {
      rememberAccessToken(null);
      await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
      throw new Error(LEGAL_SIGN_IN_MESSAGE);
    }
    const latest = await supabase.auth.getSession();
    const committed = latest.data.session ?? nextSession;
    rememberAccessToken(committed.access_token);
    if (mountedRef.current) {
      setUser(signedInUser);
      setSession(committed);
    }
    await persistUser(signedInUser);
    await persistSession(committed);
    setSentryUser(signedInUser);
    addBreadcrumb('User logged in', 'auth', { userId: signedInUser.id, role: signedInUser.role, provider });
    holdProviderRef.current = false;
    return { done: true as const };
  }, [finishProviderMutation, persistSession, persistUser, updateProfileMutation]);

  const loginWithProvider = useCallback(async (provider: 'apple' | 'google', role?: AccountRole | null) => {
    holdProviderRef.current = true;
    try {
      await requestProviderSession(provider);
      const chosen = role ?? await AsyncStorage.getItem(PROVIDER_ROLE_STORAGE_KEY).then((value) => (
        isAccountRole(value) ? value : null
      )).catch(() => null);
      return await acceptProviderSession(chosen, provider);
    } catch (error) {
      await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
      holdProviderRef.current = false;
      if (error instanceof Error && (error.message.includes('Complete the Legal & Safety page') || error.message.includes('could not be saved') || error.message === 'Sign-in was cancelled.')) {
        throw error;
      }
      captureException(error as Error, { context: 'provider-login', provider });
      throw error;
    }
  }, [acceptProviderSession]);

  const verifyProviderCode = useCallback(async (code: string) => {
    holdProviderRef.current = true;
    try {
      const listed = await supabase.auth.mfa.listFactors();
      const factorId = listed.data?.totp?.[0]?.id;
      if (listed.error || !factorId) {
        throw new Error('That authenticator is not on this account.');
      }
      const verified = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verified.error) {
        throw new Error('That authenticator code does not match.');
      }
      const chosen = await AsyncStorage.getItem(PROVIDER_ROLE_STORAGE_KEY).then((value) => (
        isAccountRole(value) ? value : null
      )).catch(() => null);
      const result = await acceptProviderSession(chosen, 'saved');
      if ('needsTwoFactor' in result) {
        throw new Error('That authenticator code does not match.');
      }
      if ('needsRole' in result) return { needsRole: true as const };
      return { done: true as const };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Complete the Legal & Safety page') || error.message.includes('could not be saved'))) {
        throw error;
      }
      captureException(error as Error, { context: 'provider-second-factor' });
      throw error;
    }
  }, [acceptProviderSession]);

  const finishProviderAccount = useCallback(async (role: AccountRole) => {
    holdProviderRef.current = true;
    await AsyncStorage.setItem(PROVIDER_ROLE_STORAGE_KEY, role).catch(() => undefined);
    try {
      const result = await acceptProviderSession(role, 'saved');
      if ('done' in result) return;
      throw new Error('needsTwoFactor' in result
        ? 'Enter the code from your authenticator app to finish signing in.'
        : 'Choose Order a Plate or Start Cooking to finish this account.');
    } catch (error) {
      holdProviderRef.current = false;
      captureException(error as Error, { context: 'finish-provider-account', role });
      throw error;
    }
  }, [acceptProviderSession]);

  const beginTwoFactor = useCallback(async () => {
    if (!user) throw new Error('Sign in to update two-factor.');
    const listed = await supabase.auth.mfa.listFactors();
    if (listed.error) throw new Error('That authenticator could not be checked.');
    for (const factor of listed.data?.all ?? []) {
      if (factor.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const enrolled = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'HomeCookedPlate',
      friendlyName: 'HomeCookedPlate',
    });
    if (enrolled.error || !enrolled.data?.totp?.secret) {
      throw new Error(enrolled.error?.message || 'The authenticator could not be started.');
    }
    return { secret: enrolled.data.totp.secret };
  }, [user]);

  const confirmTwoFactor = useCallback(async (code: string) => {
    if (!user) throw new Error('Sign in to update two-factor.');
    const listed = await supabase.auth.mfa.listFactors();
    const factor = (listed.data?.all ?? []).find((item) => item.factor_type === 'totp' && item.status === 'unverified');
    if (listed.error || !factor) throw new Error('Start the authenticator again.');
    const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verified.error) throw new Error('That authenticator code does not match.');
    const next = await supabase.auth.getSession();
    if (next.data.session) {
      rememberAccessToken(next.data.session.access_token);
      if (mountedRef.current) setSession(next.data.session);
      await persistSession(next.data.session);
    }
    const result = await setAccountSecurityMutation.mutateAsync({ twoFactorEnabled: true });
    if (!result.twoFactorEnabled) throw new Error('Two-factor was not saved on the server.');
    const updated = { ...user, isPaused: result.isPaused, twoFactorEnabled: true };
    if (mountedRef.current) setUser(updated);
    await persistUser(updated);
  }, [persistSession, persistUser, setAccountSecurityMutation, user]);

  const signup = useCallback(async (username: string, email: string, password: string, role: 'platemaker' | 'platetaker', location?: { lat: number; lng: number }, foodSafetyAcknowledged?: boolean): Promise<{ success: boolean; requiresLogin: boolean; requiresCheckout?: boolean; chooseMembership?: boolean; needsEmailConfirmation?: boolean; confirmationEmailSent?: boolean; metro?: string }> => {
    if (signupBusy.current) {
      throw new Error('Signup is already in progress.');
    }
    signupBusy.current = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await trpcProxyClient.auth.signup.mutate({
        username,
        email,
        password,
        role,
        lat: location?.lat,
        lng: location?.lng,
        foodSafetyAcknowledged: foodSafetyAcknowledged || false,
      }, { signal: controller.signal });

      // A new signup has no session. The confirmation link is what allows sign-in.
      const chooseMembership = result.status === 'CHOOSE_MEMBERSHIP';
      const requiresCheckout = false;
      const needsEmailConfirmation = result.needsEmailConfirmation ?? false;
      const confirmationEmailSent = result.confirmationEmailSent !== false;
      const metro = typeof result.metro === 'string' ? result.metro : 'Remote/Other';
      addBreadcrumb('User signed up (no session - needs login)', 'auth', { userId: result.user.id, role: result.user.role, status: result.status, metro });
      return { success: true, requiresLogin: true, requiresCheckout, chooseMembership, needsEmailConfirmation, confirmationEmailSent, metro };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Signup request timed out. Please check your connection and try again.');
      }
      captureException(error as Error, { context: 'signup', role });
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      signupBusy.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    rememberAccessToken(null);
    clearLoginLegalBox();
    await clearLegalAgreement().catch(() => undefined);
    await clearLegalReadyForSignIn().catch(() => undefined);
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      captureException(error as Error, { context: 'logout' });
    }
    await settleWithin(supabase.auth.signOut(), 2000).catch(() => undefined);
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
    }
    await persistUser(null);
    await persistSession(null);
    setSentryUser(null);
    addBreadcrumb('User logged out', 'auth');
  }, [logoutMutation, persistUser, persistSession]);

  const updateProfile = useCallback(async (updates: Partial<Pick<User, 'username' | 'email' | 'phone' | 'bio' | 'profileImage' | 'businessName'>>) => {
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
    await clearLegalAgreement().catch(() => undefined);
    await clearLegalReadyForSignIn().catch(() => undefined);
    await SecureStore.deleteItemAsync('lifetime_binding_token').catch(() => {});
  }, [deleteAccountMutation, persistSession, persistUser]);

  const setTwoFactorEnabled = useCallback(async (enabled: boolean) => {
    if (!user) throw new Error('Sign in to update two-factor.');
    if (!enabled) {
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error) throw new Error('That authenticator could not be checked.');
      for (const factor of listed.data?.all ?? []) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) throw new Error(removed.error.message);
      }
    }
    const result = await setAccountSecurityMutation.mutateAsync({ twoFactorEnabled: enabled });
    if (result.twoFactorEnabled !== enabled) throw new Error('Two-factor was not saved on the server.');
    const updated = { ...user, isPaused: result.isPaused, twoFactorEnabled: result.twoFactorEnabled };
    if (mountedRef.current) setUser(updated);
    await persistUser(updated);
  }, [user, persistUser, setAccountSecurityMutation]);

  const changePassword = useCallback(async (current: string, newPassword: string) => {
    if (!user || !session || !user.email) return false;
    try {
      const checkClient = createMemoryAuthClient();
      const check = await checkClient.auth.signInWithPassword({ email: user.email, password: current });
      await checkClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
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
      await resetPasswordMutation.mutateAsync({
        email,
        platform: Platform.OS === 'web' ? 'web' : 'mobile',
      });
      addBreadcrumb('Password reset requested', 'auth');
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
    loginWithProvider,
    verifyProviderCode,
    finishProviderAccount,
    beginTwoFactor,
    confirmTwoFactor,
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
  }), [visibleUser, session, isLoading, login, loginWithProvider, verifyProviderCode, finishProviderAccount, beginTwoFactor, confirmTwoFactor, signup, logout, updateProfile, requestPlatemakerRole, pauseAccount, unpauseAccount, deleteAccount, setTwoFactorEnabled, changePassword, requestDataExport, resetPassword, reactivateAccount, openKitchen, setOrderingAsBuyer]);


  return authState;
});