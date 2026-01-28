// Web shim for expo-secure-store
// Uses localStorage as fallback (less secure than native Keychain/Keystore, but acceptable for web)

/**
 * Store a value securely (on web, uses localStorage)
 */
export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn('[SecureStore] Failed to set item:', error);
    throw error;
  }
}

/**
 * Retrieve a value securely (on web, uses localStorage)
 */
export async function getItemAsync(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  } catch (error) {
    console.warn('[SecureStore] Failed to get item:', error);
    return null;
  }
}

/**
 * Delete a value securely (on web, uses localStorage)
 */
export async function deleteItemAsync(key: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('[SecureStore] Failed to delete item:', error);
    // Don't throw - deletion failures are often non-critical
  }
}

/**
 * Check if SecureStore is available
 */
export async function isAvailableAsync(): Promise<boolean> {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
