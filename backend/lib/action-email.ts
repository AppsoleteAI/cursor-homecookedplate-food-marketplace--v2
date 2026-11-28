import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmailConfirmation } from './email';

/** Sends the confirmation the person can open, once, after the first order or the first plate. */
export async function sendActionEmailIfDue(
  admin: SupabaseClient,
  userId: string,
  webUrl: string,
): Promise<void> {
  try {
    const authUser = await admin.auth.admin.getUserById(userId);
    const user = authUser.data.user;
    const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
      ? user.user_metadata as Record<string, unknown>
      : {};
    if (!user || metadata.action_email_pending !== true) return;
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email || email.endsWith('@users.local')) return;
    const username = typeof metadata.username === 'string' && metadata.username.trim()
      ? metadata.username.trim()
      : 'there';
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const stored = await admin.from('email_verification_tokens').insert({
      user_id: userId,
      token,
      email,
      expires_at: expiresAt,
    });
    if (stored.error) return;
    await sendEmailConfirmation(email, username, token, webUrl || 'https://homecookedplate.com');
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, action_email_pending: false, action_email_sent: true },
    });
  } catch (error) {
    console.error('[ActionEmail] Confirmation was not sent', error);
  }
}
