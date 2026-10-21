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

/** A PlateTaker can enter. A PlateMaker needs a paid membership or an Early Bird end date that is still ahead. */
export function platemakerMayEnter(profile: TrialAccessProfile, now = new Date(), trialApplies = true): boolean {
  if (profile.role !== 'platemaker') return true;
  if (profile.membership_tier === 'lifetime') return true;
  if (profile.stripe_subscription_id || profile.apple_original_transaction_id || profile.google_purchase_token) {
    return true;
  }
  if (!trialApplies) return false;
  if (profile.membership_tier !== 'premium') return false;
  const ends = trialEndMs(profile);
  return ends !== null && ends > now.getTime();
}

/** A named metro can require Early Bird or a paid plan. Remote/Other has no Early Bird spot until Get GPS places the cook inside one. */
export function metroRequiresMembership(metroArea: string | null | undefined): boolean {
  return !!metroArea && metroArea !== 'Remote/Other';
}

function remoteMetro(metroArea: string | null | undefined): boolean {
  return metroArea == null || metroArea === 'Remote/Other';
}

export function userNeedsMembership(user: {
  role?: string | null;
  needsMembership?: boolean;
  membershipTier?: string | null;
  metroArea?: string | null;
  kitchenOpened?: boolean;
  closeoutKeepsKitchen?: boolean;
  earlyBirdClaimMetro?: string | null;
} | null | undefined): boolean {
  if (!user || user.role !== 'platemaker') return false;
  const remote = remoteMetro(user.metroArea);
  const claim = (user.earlyBirdClaimMetro || '').trim();
  const current = (user.metroArea || '').trim() || 'Remote/Other';
  const claimDiffers = Boolean(claim) && claim !== current;
  if (remote && user.kitchenOpened === true && !claim) return false;
  if (user.closeoutKeepsKitchen === true) return false;
  if (claimDiffers) return user.needsMembership === true;
  if (user.needsMembership === true) return true;
  if (user.membershipTier === 'premium' || user.membershipTier === 'lifetime') return false;
  if (remote) return true;
  if (user.needsMembership === false) return false;
  return true;
}

/** A paid order still waiting on pickup keeps the kitchen open after the trial date. */
export function trialCloseoutKeepsKitchen(trialExpired: boolean, hasPaidCloseoutOrder: boolean): boolean {
  return trialExpired && hasPaidCloseoutOrder;
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
