import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { AppleAuthenticationScope, isAvailableAsync, signInAsync } from '@/lib/apple-authentication';
import { providerSessionFromRedirect } from '@/lib/provider-redirect';

export type ProviderName = 'apple' | 'google';

export function providerRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/login`;
  }
  return makeRedirectUri({ scheme: 'homecookedplate', path: 'login' });
}

function cancelled(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED');
}

/** Starts Apple or Google and returns the Supabase session tokens. */
export async function requestProviderSession(provider: ProviderName): Promise<{ access_token: string; refresh_token: string }> {
  if (provider === 'apple' && Platform.OS === 'ios' && await isAvailableAsync()) {
    try {
      const raw = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
      const credential = await signInAsync({
        requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
        nonce: hashed,
      });
      if (!credential.identityToken) {
        throw new Error('Apple did not return a sign-in.');
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: raw,
      });
      if (error || !data.session) {
        throw new Error(error?.message || 'Apple sign-in did not finish.');
      }
      return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    } catch (error) {
      if (cancelled(error)) throw new Error('Sign-in was cancelled.');
      throw error;
    }
  }

  const redirectTo = providerRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    throw new Error(error?.message || 'That sign-in could not start.');
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('Sign-in was cancelled.');
  }
  const parsed = providerSessionFromRedirect(result.url);
  if (!parsed) throw new Error('That sign-in did not finish.');
  if ('code' in parsed) {
    const exchanged = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (exchanged.error || !exchanged.data.session) {
      throw new Error(exchanged.error?.message || 'That sign-in did not finish.');
    }
    return {
      access_token: exchanged.data.session.access_token,
      refresh_token: exchanged.data.session.refresh_token,
    };
  }
  const set = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });
  if (set.error || !set.data.session) {
    throw new Error(set.error?.message || 'That sign-in did not finish.');
  }
  return {
    access_token: set.data.session.access_token,
    refresh_token: set.data.session.refresh_token,
  };
}
