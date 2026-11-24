import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAccountRole, PROVIDER_ROLE_STORAGE_KEY, type AccountRole } from '@/backend/lib/provider-profile';

const ACCOUNT_SEEN_KEY = 'hcp_has_account';

/** True after this device has signed in or created an account. */
export async function readHasAccount(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ACCOUNT_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

/** The role chosen on the landing. */
export async function readGuestRole(): Promise<AccountRole | null> {
  try {
    const value = await AsyncStorage.getItem(PROVIDER_ROLE_STORAGE_KEY);
    return isAccountRole(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeGuestRole(role: AccountRole): Promise<void> {
  await AsyncStorage.setItem(PROVIDER_ROLE_STORAGE_KEY, role);
}

export async function clearGuestRole(): Promise<void> {
  await AsyncStorage.removeItem(PROVIDER_ROLE_STORAGE_KEY);
}
