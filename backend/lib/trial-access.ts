export interface TrialAccessProfile {
  role: string | null;
  membership_tier: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id?: string | null;
  apple_original_transaction_id?: string | null;
  google_purchase_token?: string | null;
}

export const TRIAL_COUNTDOWN_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function trialEndMs(profile: TrialAccessProfile): number | null {
  if (profile.role !== 'platemaker') return null;
  if (profile.membership_tier === 'lifetime') return null;
  if (profile.stripe_subscription_id || profile.apple_original_transaction_id || profile.google_purchase_token) {
    return null;
  }
  if (!profile.trial_ends_at) return null;
  const ends = Date.parse(profile.trial_ends_at);
  if (Number.isNaN(ends)) return null;
  return ends;
}

export function unpaidPlatemakerTrialEnded(profile: TrialAccessProfile, now = new Date()): boolean {
  const ends = trialEndMs(profile);
  if (ends === null) return false;
  return ends <= now.getTime();
}

export function platemakerTrialCountdownDays(profile: TrialAccessProfile, now = new Date()): number | null {
  const ends = trialEndMs(profile);
  if (ends === null || ends <= now.getTime()) return null;
  const daysLeft = Math.ceil((ends - now.getTime()) / DAY_MS);
  if (daysLeft > TRIAL_COUNTDOWN_DAYS) return null;
  return daysLeft;
}
