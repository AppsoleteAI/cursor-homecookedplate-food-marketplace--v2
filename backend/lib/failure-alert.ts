import type { SupabaseClient } from '@supabase/supabase-js';
import { logAdminAlert } from './alerts';
import { scrubCrashText } from './worker-sentry';

export type OperationalFailure = 'payment_error' | 'webhook_error' | 'security_alert';

/** Writes a payment, webhook, or security failure for an admin. The text is scrubbed first. */
export async function recordOperationalFailure(
  kind: OperationalFailure,
  message: string,
  admin?: SupabaseClient,
): Promise<void> {
  await logAdminAlert(
    kind,
    scrubCrashText(message),
    { severity: kind === 'security_alert' ? 'critical' : 'high', metadata: { kind } },
    admin,
  );
}
