import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcProxyClient } from './trpc';

const DEVICE_ID_STORAGE_KEY = '@rork_device_id';

/**
 * Gets a unique device identifier for hardware audit.
 * 
 * Strategy:
 * - Android: Uses Application.androidId (stable, unique per device)
 * - iOS: Uses a stored UUID (generated on first launch, persisted in AsyncStorage)
 * - Web: Uses a stored UUID (generated on first launch, persisted in localStorage)
 * 
 * @returns Promise<string> - Unique device identifier
 */
async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    try {
      const androidId = await Application.getAndroidId();
      if (androidId) {
        console.log('[HardwareAudit] Device ID (Android ID):', androidId);
        console.log('[HardwareAudit] This ID will be locked into device_id column for lifetime memberships');
        return androidId;
      }
    } catch (error) {
      console.warn('[HardwareAudit] Failed to get Android ID:', error);
    }
  }

  // iOS, Web, or Android fallback: use stored UUID
  try {
    const storedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (storedId) {
      console.log('[HardwareAudit] Device ID (Stored UUID):', storedId);
      console.log('[HardwareAudit] This ID will be locked into device_id column for lifetime memberships');
      return storedId;
    }

    // Generate new UUID if not found
    const newId = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    console.log('[HardwareAudit] Device ID (New UUID generated):', newId);
    console.log('[HardwareAudit] This ID will be locked into device_id column for lifetime memberships');
    return newId;
  } catch (error) {
    console.warn('[HardwareAudit] Failed to get/store device ID:', error);
    // Fallback: generate a temporary ID (not persisted)
    const fallbackId = generateUUID();
    console.log('[HardwareAudit] Device ID (Fallback UUID):', fallbackId);
    return fallbackId;
  }
}

/**
 * Generates a UUID v4.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Runs hardware audit for a user.
 * 
 * Validates device ID for lifetime subscribers to prevent unauthorized transfers.
 * 
 * @param userId - User ID to audit
 * @returns Promise<{ allowed: boolean; reason?: string }>
 */
export async function runHardwareAudit(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Skip on web (optional - can be enabled if needed)
    if (Platform.OS === 'web') {
      return { allowed: true };
    }

    const deviceId = await getDeviceId();
    if (!deviceId) {
      // Fail open: if we can't get device ID, allow access
      console.warn('[HardwareAudit] Could not get device ID, allowing access');
      return { allowed: true };
    }

    console.log('[HardwareAudit] Running hardware audit for user:', userId);
    console.log('[HardwareAudit] Current device ID:', deviceId);

    // Call tRPC procedure using proxy client (works outside React components)
    const result = await trpcProxyClient.auth.hardwareAudit.mutate({ deviceId });
    
    console.log('[HardwareAudit] Audit result:', result);
    if (!result.allowed) {
      console.error('[HardwareAudit] Hardware mismatch detected:', result.reason);
    }
    
    return result;
  } catch (error) {
    // Fail open: on network/server errors, allow access
    console.error('[HardwareAudit] Error during audit:', error);
    return { allowed: true };
  }
}
