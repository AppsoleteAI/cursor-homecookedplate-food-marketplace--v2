import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAccountRole, PROVIDER_ROLE_STORAGE_KEY, type AccountRole } from '@/backend/lib/provider-profile';

const ACCOUNT_SEEN_KEY = 'hcp_has_account';
/** Set when this device continues past Your Location from limited browsing. */
const GUEST_LOCATION_PASSED_KEY = 'hcp_guest_location_passed';
const GUEST_CITY_KEY = 'hcp_guest_city';
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
 * A previous member opens Sign in. A leftover Apple or Google role, or a
 * guest role with no Supabase user, opens limited browsing.
 */
export function signedOutDestination(
  hasAccount: boolean,
  _guestRole: AccountRole | null,
  _providerRole: AccountRole | null,
): SignedOutDestination {
  if (hasAccount) return '/(auth)/login';
  return '/(auth)/limited-browsing';
}

/** This device already continued from Your Location on the limited-browsing path. */
export async function markGuestLocationPassed(): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_LOCATION_PASSED_KEY, '1');
  } catch {
    // A later sign-in can still ask for Your Location once.
  }
}

export async function writeGuestCity(city: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_CITY_KEY, city);
  } catch {
    // The pin can still say Pickup near you.
  }
}

export async function clearGuestCity(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_CITY_KEY);
  } catch {
    // The pin can still say Pickup near you.
  }
}

export async function readGuestCity(): Promise<string | null> {
  try {
    const city = (await AsyncStorage.getItem(GUEST_CITY_KEY))?.trim();
    return city ? city : null;
  } catch {
    return null;
  }
}

export async function readGuestLocationPassed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUEST_LOCATION_PASSED_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * After an account exists. A saved metro opens the app. A passed guest
 * location opens the app. Sign in with no metro and no passed location
 * opens Your Location once.
 */
export function accountEntryDestination(hasMetro: boolean, guestLocationPassed: boolean): '/' | 'location' {
  if (hasMetro || guestLocationPassed) return '/';
  return 'location';
}

/** Home stays open after Order a Plate or Start Cooking. The first screen does not use this. */
export function homeEntryDestination(
  hasAccount: boolean,
  guestRole: AccountRole | null,
  providerRole: AccountRole | null,
): SignedOutDestination {
  if (guestRole) return '/(tabs)/(home)/home';
  return signedOutDestination(hasAccount, guestRole, providerRole);
}
