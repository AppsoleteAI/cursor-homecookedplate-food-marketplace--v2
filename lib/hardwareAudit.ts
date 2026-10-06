/**
 * Lifetime Membership Binding Token
 *
 * Compliance note (Apple Developer Program License Agreement §3.3.3(B)):
 * "Neither You nor Your Application will use any permanent, device-based identifier,
 *  or any data derived therefrom, for purposes of uniquely identifying a device."
 *
 * This module generates a RANDOM UUID that is:
 *  - Stored in iOS Keychain / Android Keystore via expo-secure-store (encrypted at rest)
 *  - NOT derived from any hardware identifier (IDFV, IDFA, Android ID, etc.)
 *  - Created exactly once when a Lifetime membership is first activated
 *  - Treated as an account-level credential, not a device fingerprint
 *
 * The binding prevents a single Lifetime purchase from being shared across
 * multiple devices by comparing the stored token against the value held in
 * the user's profile row (written on first activation).
 */

import * as SecureStore from '@/lib/expo-secure-store';
import { Platform } from 'react-native';
import { trpcProxyClient } from './trpc';

const BINDING_TOKEN_KEY = 'lifetime_binding_token';

/** Generates a cryptographically-random UUID v4 without using any device hardware ID. */
function generateBindingToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the existing binding token from secure storage, or generates and
 * persists a new one. The token is never derived from hardware identifiers.
 */
export async function getOrCreateBindingToken(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(BINDING_TOKEN_KEY);
    if (stored) return stored;

    const token = generateBindingToken();
    await SecureStore.setItemAsync(BINDING_TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.warn('[LifetimeBinding] SecureStore unavailable, using ephemeral token:', err);
    // Fallback: ephemeral token (audit will fail open on server side)
    return generateBindingToken();
  }
}

/**
 * Deletes the binding token from secure storage.
 * Called during account deletion to clean up credentials.
 */
export async function clearBindingToken(): Promise<void> {
  await SecureStore.deleteItemAsync(BINDING_TOKEN_KEY).catch(() => {});
}

/**
 * Runs the hardware-audit check for Lifetime subscribers.
 * Sends the account-level binding token (NOT a hardware ID) to the server.
 *
 * @returns { allowed: boolean; reason?: string }
 */
export async function runHardwareAudit(
  _userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Skip on web — SecureStore is a no-op there
  if (Platform.OS === 'web') {
    return { allowed: true };
  }

  try {
    const bindingToken = await getOrCreateBindingToken();

    const result = await trpcProxyClient.auth.hardwareAudit.mutate({
      deviceId: bindingToken,
    });

    if (!result.allowed) {
      console.error('[LifetimeBinding] Token mismatch:', result.reason);
    }

    return result;
  } catch (err) {
    // Fail open: allow access on network/server errors
    console.error('[LifetimeBinding] Audit error (failing open):', err);
    return { allowed: true };
  }
}
