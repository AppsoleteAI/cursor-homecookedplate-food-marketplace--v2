import { undoMetroHeadcount } from './metro-headcount';
import { readGeofenceSettings } from './metro-geofence';
import { nearestMetro } from './metro-radius';

export const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with this email already exists. Please use login instead.';

type AuthError = {
  message?: string;
  status?: number;
  code?: string | number;
} | null | undefined;

/** A duplicate email is one outcome. The password is not checked. */
export function isDuplicateAuthError(error: AuthError): boolean {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
  return (
    message.includes('already registered') ||
    message.includes('user already exists') ||
    message.includes('email address has already') ||
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    error.status === 422 ||
    error.code === '23505' ||
    error.code === 422
  );
}

export type SignupMetroPlan = {
  assignedMetro: string;
  pausedMessage: string | null;
  trialDays: number;
  holdSlot: boolean;
};

type TableAdmin = { from: (table: string) => any };

/**
 * Decide the metro before an auth user exists.
 * A paused metro returns a message and does not hold a slot.
 * Missing coordinates, or a point outside every metro, is Remote/Other and holds no slot.
 */
export async function planSignupMetro(
  admin: TableAdmin,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<SignupMetroPlan> {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { assignedMetro: 'Remote/Other', pausedMessage: null, trialDays: 0, holdSlot: false };
  }

  const nearest = nearestMetro(lat, lng);
  if (!nearest) {
    return { assignedMetro: 'Remote/Other', pausedMessage: null, trialDays: 0, holdSlot: false };
  }

  const settingsRead = await readGeofenceSettings(admin, nearest.name);
  if (settingsRead.error) {
    process.stdout.write(`[GEO_LOCK] Could not read metro settings: ${settingsRead.error}. Using the nearest 50-mile metro.\n`);
  }
  const saved = settingsRead.settings;
  const active = saved ? saved.is_active !== false : true;
  const trialDays = saved && typeof saved.trial_days === 'number' ? saved.trial_days : 90;
  if (!active) {
    return {
      assignedMetro: nearest.name,
      pausedMessage: `Signups in ${nearest.name} are currently paused for maintenance.`,
      trialDays: 0,
      holdSlot: false,
    };
  }

  return {
    assignedMetro: nearest.name,
    pausedMessage: null,
    trialDays,
    holdSlot: true,
  };
}

type SignupAdmin = TableAdmin & {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  auth: { admin: { deleteUser: (id: string) => Promise<unknown> } };
};

/** Return a held metro slot, then delete the auth user. Each step runs even if the other fails. */
export async function abandonFailedSignup(
  admin: SignupAdmin,
  userId: string | null,
  slot: { role: string; metro: string } | null,
): Promise<void> {
  if (slot) {
    try {
      await undoMetroHeadcount(admin, slot.role, null, slot.metro);
    } catch (error) {
      console.error('[Signup] Failed to return the metro slot:', error);
    }
  }
  if (userId) {
    try {
      await admin.auth.admin.deleteUser(userId);
      console.log('[Signup] Cleaned up auth user after signup did not finish');
    } catch (error) {
      console.error('[Signup] Failed to cleanup auth user:', error);
    }
  }
}
