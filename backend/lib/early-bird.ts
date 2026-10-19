/**
 * PlateMaker Early Bird. No card. The end date on profiles.trial_ends_at is what the 90-day check reads.
 * The start date is profiles.trial_started_at when that column is present.
 */

import { earlyBirdCapForMetro } from './early-bird-cap';
import { isKnownMetro } from './metro-radius';

export function canClaimEarlyBird(input: {
  role: string | null;
  metroArea: string | null;
  paid: boolean;
  metroActive: boolean;
  rank: number;
  maxCap: number;
  trialEndsAt: string | null;
}): boolean {
  if (input.role !== 'platemaker') return false;
  if (input.paid) return false;
  if (!input.metroArea || input.metroArea === 'Remote/Other') return false;
  if (!input.metroActive) return false;
  if (!Number.isFinite(input.rank) || input.rank < 1 || input.rank > input.maxCap) return false;
  if (input.trialEndsAt) return false;
  return true;
}

export function addDays(start: Date, days: number): Date {
  const ends = new Date(start.getTime());
  ends.setUTCDate(ends.getUTCDate() + days);
  return ends;
}

type Admin = {
  from: (table: string) => any;
};

export type EarlyBirdOffer = {
  eligible: boolean;
  trialDays: number;
  trialEndsAt: string | null;
  trialStartedAt: string | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  metro_area: string | null;
  created_at: string;
  membership_tier: string | null;
  trial_ends_at: string | null;
  trial_started_at?: string | null;
  stripe_subscription_id?: string | null;
  apple_original_transaction_id?: string | null;
  google_purchase_token?: string | null;
};

export async function readEarlyBirdOffer(admin: Admin, userId: string): Promise<EarlyBirdOffer> {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, metro_area, created_at, membership_tier, trial_ends_at, trial_started_at, stripe_subscription_id, apple_original_transaction_id, google_purchase_token')
    .eq('id', userId)
    .single();

  if (error?.code === 'PGRST204' || /trial_started_at/.test(error?.message || '')) {
    const retry = await admin
      .from('profiles')
      .select('id, role, metro_area, created_at, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, google_purchase_token')
      .eq('id', userId)
      .single();
    if (retry.error || !retry.data) {
      throw new Error(retry.error?.message || 'Profile not found');
    }
    return decideOffer(admin, retry.data as ProfileRow);
  }

  if (error || !profile) {
    throw new Error(error?.message || 'Profile not found');
  }

  return decideOffer(admin, profile as ProfileRow);
}

async function decideOffer(admin: Admin, profile: ProfileRow): Promise<EarlyBirdOffer> {
  const trialEndsAt = profile.trial_ends_at || null;
  const trialStartedAt = profile.trial_started_at || null;
  const paid = Boolean(
    profile.stripe_subscription_id
    || profile.apple_original_transaction_id
    || profile.google_purchase_token
    || profile.membership_tier === 'lifetime',
  );

  if (profile.role !== 'platemaker' || !profile.metro_area || profile.metro_area === 'Remote/Other') {
    return { eligible: false, trialDays: 0, trialEndsAt, trialStartedAt };
  }

  const { data: geo } = await admin
    .from('metro_geofences')
    .select('is_active, trial_days')
    .eq('metro_name', profile.metro_area)
    .maybeSingle();

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('metro_area', profile.metro_area)
    .eq('role', 'platemaker')
    .lte('created_at', profile.created_at);

  const trialDays = typeof geo?.trial_days === 'number' && geo.trial_days > 0 ? geo.trial_days : 90;
  const maxCap = earlyBirdCapForMetro(profile.metro_area);
  const metroActive = geo ? geo.is_active !== false : isKnownMetro(profile.metro_area);
  const eligible = canClaimEarlyBird({
    role: profile.role,
    metroArea: profile.metro_area,
    paid,
    metroActive,
    rank: count ?? 0,
    maxCap,
    trialEndsAt,
  });

  return { eligible, trialDays: eligible ? trialDays : 0, trialEndsAt, trialStartedAt };
}
