export interface TrialAccessProfile {
  role?: string | null;
  membership_tier?: string | null;
  trial_ends_at?: string | null;
  stripe_subscription_id?: string | null;
  apple_original_transaction_id?: string | null;
  apple_expires_at?: string | null;
  apple_revoked_at?: string | null;
  google_purchase_token?: string | null;
  google_expires_at?: string | null;
}

function futureDate(value: string | null | undefined, now: number): boolean {
  if (!value) return false;
  const ends = Date.parse(value);
  return !Number.isNaN(ends) && ends > now;
}

export const APPLE_RENEWAL_DELETE_MESSAGE =
  'Cancel the App Store subscription in Apple subscriptions, then delete the account again. Apple keeps billing until that renewal is off.';

export const APPLE_UNCONFIRMED_DELETE_MESSAGE =
  'Cancel the App Store subscription before this account can be deleted. HomeCookedPlate could not confirm that Apple has stopped renewal.';

export const APPLE_CHECK_FAILED_DELETE_MESSAGE =
  'The App Store subscription could not be checked. This account was not deleted.';

/** A renewing App Store membership blocks deletion. An expired or refunded one does not. */
export function appleDeletionBlock(
  profile: TrialAccessProfile | null | undefined,
  status: { configured: boolean; renewing: boolean } | null,
  now = new Date(),
): string | null {
  if (!profile?.apple_original_transaction_id) return null;
  if (!status) return APPLE_CHECK_FAILED_DELETE_MESSAGE;
  if (!status.configured && appleMembershipCovers(profile, now)) return APPLE_UNCONFIRMED_DELETE_MESSAGE;
  if (status.renewing) return APPLE_RENEWAL_DELETE_MESSAGE;
  return null;
}

/** An App Store membership covers Premium only while Apple still entitles it. A row saved before an expiry date was stored still covers until a check writes that date. */
export function appleMembershipCovers(profile: TrialAccessProfile, now = new Date()): boolean {
  if (!profile.apple_original_transaction_id) return false;
  if (profile.apple_revoked_at) return false;
  if (!profile.apple_expires_at) return true;
  return futureDate(profile.apple_expires_at, now.getTime());
}

/** A Play membership covers Premium only while Google still entitles it. A row saved before an expiry date was stored still covers until a check writes that date. */
export function googleMembershipCovers(profile: TrialAccessProfile, now = new Date()): boolean {
  if (!profile.google_purchase_token) return false;
  if (!profile.google_expires_at) return true;
  return futureDate(profile.google_expires_at, now.getTime());
}

export function storeMembershipCovers(profile: TrialAccessProfile, now = new Date()): boolean {
  return Boolean(profile.stripe_subscription_id)
    || appleMembershipCovers(profile, now)
    || googleMembershipCovers(profile, now);
}

/** PlateTaker Premium, a paid cook plan, or an Early Bird date that is still ahead. */
export function resolvedMembershipTier(profile: TrialAccessProfile, now = new Date()): 'free' | 'premium' | 'lifetime' {
  if (profile.membership_tier === 'lifetime') return 'lifetime';
  if (storeMembershipCovers(profile, now)) return 'premium';
  if (profile.role === 'platemaker' && profile.membership_tier === 'premium' && futureDate(profile.trial_ends_at, now.getTime())) {
    return 'premium';
  }
  return 'free';
}

export function buyerPremiumCovers(profile: TrialAccessProfile, now = new Date()): boolean {
  return resolvedMembershipTier(profile, now) === 'premium' && profile.role === 'platetaker';
}

export const TRIAL_COUNTDOWN_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function trialEndMs(profile: TrialAccessProfile, now = new Date()): number | null {
  if (profile.role !== 'platemaker') return null;
  if (profile.membership_tier === 'lifetime') return null;
  if (storeMembershipCovers(profile, now)) {
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
  if (storeMembershipCovers(profile, now)) {
    return true;
  }
  if (!trialApplies) return false;
  if (profile.membership_tier !== 'premium') return false;
  const ends = trialEndMs(profile, now);
  return ends !== null && ends > now.getTime();
}

/** A named metro can offer Early Bird. Signing in does not send anyone to Membership. */
export function metroRequiresMembership(metroArea: string | null | undefined): boolean {
  return !!metroArea && metroArea !== 'Remote/Other';
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
  void user;
  return false;
}

/** A paid order still waiting on pickup keeps the kitchen open after the trial date. */
export function trialCloseoutKeepsKitchen(trialExpired: boolean, hasPaidCloseoutOrder: boolean): boolean {
  return trialExpired && hasPaidCloseoutOrder;
}

export function unpaidPlatemakerTrialEnded(profile: TrialAccessProfile, now = new Date()): boolean {
  const ends = trialEndMs(profile, now);
  if (ends === null) return false;
  return ends <= now.getTime();
}

export function platemakerTrialCountdownDays(profile: TrialAccessProfile, now = new Date()): number | null {
  const ends = trialEndMs(profile, now);
  if (ends === null || ends <= now.getTime()) return null;
  const daysLeft = Math.ceil((ends - now.getTime()) / DAY_MS);
  if (daysLeft > TRIAL_COUNTDOWN_DAYS) return null;
  return daysLeft;
}
