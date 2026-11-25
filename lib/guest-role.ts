import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAccountRole, PROVIDER_ROLE_STORAGE_KEY, type AccountRole } from '@/backend/lib/provider-profile';

const ACCOUNT_SEEN_KEY = 'hcp_has_account';
/** Set only when this signed-out device chooses a role for limited browsing. */
export const GUEST_ROLE_KEY = 'hcp_guest_role';

export type SignedOutDestination = '/(auth)/login' | '/(tabs)/(home)/home' | '/(auth)/limited-browsing';

async function readRole(key: string): Promise<AccountRole | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return isAccountRole(value) ? value : null;
  } catch {
    return null;
  }
}

/** True after this device has signed in or created an account. */
export async function readHasAccount(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ACCOUNT_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Records that this device has had an account, including after the session is gone. */
export async function markHasAccount(): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCOUNT_SEEN_KEY, '1');
  } catch {
    // Sign in still opens when another marker remains.
  }
}

/** The role chosen for limited browsing. An older account role is not this key. */
export async function readGuestRole(): Promise<AccountRole | null> {
  return readRole(GUEST_ROLE_KEY);
}

/** The role saved for Apple or Google, or left on the phone by an earlier account. */
export async function readProviderRole(): Promise<AccountRole | null> {
  return readRole(PROVIDER_ROLE_STORAGE_KEY);
}

export async function writeGuestRole(role: AccountRole): Promise<void> {
  await AsyncStorage.setItem(GUEST_ROLE_KEY, role);
  await AsyncStorage.setItem(PROVIDER_ROLE_STORAGE_KEY, role);
}

export async function clearGuestRole(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_ROLE_KEY);
  await AsyncStorage.removeItem(PROVIDER_ROLE_STORAGE_KEY);
}

/**
 * A previous member opens Sign in. Limited browsing opens home only after
 * that choice, and only when this device has no account marker.
 */
export function signedOutDestination(
  hasAccount: boolean,
  guestRole: AccountRole | null,
  providerRole: AccountRole | null,
): SignedOutDestination {
  if (hasAccount) return '/(auth)/login';
  if (guestRole) return '/(tabs)/(home)/home';
  if (providerRole) return '/(auth)/login';
  return '/(auth)/limited-browsing';
}
