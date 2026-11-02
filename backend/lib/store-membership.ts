import { readAppleRenewalStatus, type AppleApiCredentials } from './apple-server';
import type { AppleServerNotification, AppleTransactionClaims } from './apple-transaction';
import { readActiveGoogleSubscription } from './google-play';
import { resolvedMembershipTier, type TrialAccessProfile } from './trial-access';

type Admin = { from: (table: string) => any };

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function missingStoreDateColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || /apple_expires_at|apple_revoked_at|apple_auto_renew|apple_checked_at|google_expires_at|google_checked_at/.test(error.message || '');
}

function stale(value: string | null | undefined, now: number): boolean {
  if (!value) return true;
  const checked = Date.parse(value);
  return Number.isNaN(checked) || now - checked >= SIX_HOURS;
}

export async function writeResolvedTier(admin: Admin, profile: TrialAccessProfile & { id: string }, now = new Date()): Promise<'free' | 'premium' | 'lifetime'> {
  const tier = resolvedMembershipTier(profile, now);
  if (profile.membership_tier !== tier) {
    const saved = await admin.from('profiles').update({
      membership_tier: tier,
      updated_at: now.toISOString(),
    }).eq('id', profile.id);
    if (saved.error) console.error('[Membership] Premium was not updated.', saved.error.message);
  }
  return tier;
}

/** A configured check that finds no end date and no entitlement stores a past end date so Premium does not remain on an empty row. */
export function appleExpiryToStore(
  status: { configured: boolean; entitled: boolean; expiresAt: string | null },
  now: Date,
): string | null {
  if (!status.configured) return null;
  if (status.expiresAt) return status.expiresAt;
  if (!status.entitled) return new Date(now.getTime() - 1000).toISOString();
  return null;
}

export async function refreshAppleMembership(
  admin: Admin,
  profile: TrialAccessProfile & { id: string; apple_checked_at?: string | null },
  credentials: AppleApiCredentials,
  now = new Date(),
): Promise<TrialAccessProfile & { id: string }> {
  if (!profile.apple_original_transaction_id) return profile;
  const expires = profile.apple_expires_at ? Date.parse(profile.apple_expires_at) : NaN;
  const due = stale(profile.apple_checked_at, now.getTime()) || !profile.apple_expires_at || profile.apple_revoked_at != null || (!Number.isNaN(expires) && expires <= now.getTime());
  if (!due) return profile;
  try {
    const status = await readAppleRenewalStatus(profile.apple_original_transaction_id, credentials, fetch, now.getTime());
    if (!status.configured) return profile;
    const next = {
      ...profile,
      apple_expires_at: appleExpiryToStore(status, now),
      apple_revoked_at: status.revoked ? (profile.apple_revoked_at || now.toISOString()) : null,
      apple_auto_renew: status.renewing,
      apple_checked_at: now.toISOString(),
    };
    const saved = await admin.from('profiles').update({
      apple_expires_at: next.apple_expires_at,
      apple_revoked_at: next.apple_revoked_at,
      apple_auto_renew: next.apple_auto_renew,
      apple_checked_at: next.apple_checked_at,
      updated_at: now.toISOString(),
    }).eq('id', profile.id);
    if (saved.error && !missingStoreDateColumn(saved.error)) {
      console.error('[Membership] App Store status was not saved.', saved.error.message);
    }
    return next;
  } catch (error) {
    console.error('[Membership] App Store status was not checked.', error instanceof Error ? error.message : error);
    return profile;
  }
}

export async function refreshGoogleMembership(
  admin: Admin,
  profile: TrialAccessProfile & { id: string; google_checked_at?: string | null },
  serviceAccountJson: string | undefined,
  now = new Date(),
): Promise<TrialAccessProfile & { id: string }> {
  if (!profile.google_purchase_token || !serviceAccountJson) return profile;
  const expires = profile.google_expires_at ? Date.parse(profile.google_expires_at) : NaN;
  const due = stale(profile.google_checked_at, now.getTime()) || !profile.google_expires_at || (!Number.isNaN(expires) && expires <= now.getTime());
  if (!due) return profile;
  try {
    const subscription = await readActiveGoogleSubscription(profile.google_purchase_token, {
      serviceAccountJson,
      userId: profile.id,
      now: now.getTime(),
    });
    const next = { ...profile, google_expires_at: subscription.expiresAt, google_checked_at: now.toISOString() };
    await admin.from('profiles').update({
      google_expires_at: next.google_expires_at,
      google_checked_at: next.google_checked_at,
      updated_at: now.toISOString(),
    }).eq('id', profile.id);
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/expired|not active|not a HomeCookedPlate membership/.test(message)) {
      console.error('[Membership] Play status was not checked.', message);
      return profile;
    }
    const ended = new Date(now.getTime() - 1000).toISOString();
    const next = { ...profile, google_expires_at: ended, google_checked_at: now.toISOString() };
    await admin.from('profiles').update({
      google_expires_at: ended,
      google_checked_at: next.google_checked_at,
      updated_at: now.toISOString(),
    }).eq('id', profile.id);
    return next;
  }
}

export async function applyAppleTransaction(
  admin: Admin,
  originalTransactionId: string,
  claims: AppleTransactionClaims,
  autoRenews: boolean | null,
  now = new Date(),
): Promise<void> {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, apple_expires_at, apple_revoked_at, google_purchase_token, google_expires_at')
    .eq('apple_original_transaction_id', originalTransactionId)
    .maybeSingle();
  if (error || !profile) return;
  const revoked = claims.revoked ? (profile.apple_revoked_at || now.toISOString()) : null;
  const next = {
    ...profile,
    apple_expires_at: new Date(claims.expiresDate).toISOString(),
    apple_revoked_at: revoked,
  };
  await admin.from('profiles').update({
    apple_expires_at: next.apple_expires_at,
    apple_revoked_at: next.apple_revoked_at,
    apple_auto_renew: autoRenews,
    apple_checked_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).eq('id', profile.id);
  await writeResolvedTier(admin, next, now);
}

export async function applyAppleNotification(admin: Admin, note: AppleServerNotification, now = new Date()): Promise<void> {
  if (!note.transaction) return;
  await applyAppleTransaction(admin, note.transaction.originalTransactionId, note.transaction, note.autoRenews, now);
}
