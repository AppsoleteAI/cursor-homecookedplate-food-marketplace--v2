import type { MembershipInterval, MembershipRole } from './fees';

/** PlateMaker prices already live on these Apple products: $4.99 and $39.99. */
export const APPLE_PLATEMAKER_MONTHLY = 'com.rork.homecookedplate.membership.monthly';
export const APPLE_PLATEMAKER_ANNUAL = 'com.rork.homecookedplate.membership.annual';
/** PlateTaker prices. Apple charges these only after the products exist at $7.99 and $75.99. */
export const APPLE_PLATETAKER_MONTHLY = 'com.rork.homecookedplate.platetaker.monthly';
export const APPLE_PLATETAKER_ANNUAL = 'com.rork.homecookedplate.platetaker.annual';

/** PlateMaker prices already live on these Play products: $4.99 and $39.99. */
export const GOOGLE_PLATEMAKER_MONTHLY = 'com.rork.hcp.membership.monthly';
export const GOOGLE_PLATEMAKER_ANNUAL = 'com.rork.hcp.membership.annual';
/** Play already lists these at $7.99 and $75.99. Each id is within Play's 40-character limit. */
export const GOOGLE_PLATETAKER_MONTHLY = 'com.rork.hcp.platetaker.monthly';
export const GOOGLE_PLATETAKER_ANNUAL = 'com.rork.hcp.platetaker.annual';

export const APPLE_MEMBERSHIP_PRODUCT_IDS = [
  APPLE_PLATEMAKER_MONTHLY,
  APPLE_PLATEMAKER_ANNUAL,
  APPLE_PLATETAKER_MONTHLY,
  APPLE_PLATETAKER_ANNUAL,
] as const;

export const GOOGLE_MEMBERSHIP_PRODUCT_IDS = [
  GOOGLE_PLATEMAKER_MONTHLY,
  GOOGLE_PLATEMAKER_ANNUAL,
  GOOGLE_PLATETAKER_MONTHLY,
  GOOGLE_PLATETAKER_ANNUAL,
] as const;

export type AppleMembershipProductId = (typeof APPLE_MEMBERSHIP_PRODUCT_IDS)[number];
export type GoogleMembershipProductId = (typeof GOOGLE_MEMBERSHIP_PRODUCT_IDS)[number];

const SHARED_PRICE_IDS = new Set<string>([
  APPLE_PLATEMAKER_MONTHLY,
  APPLE_PLATEMAKER_ANNUAL,
  GOOGLE_PLATEMAKER_MONTHLY,
  GOOGLE_PLATEMAKER_ANNUAL,
]);

const PLATETAKER_PRICE_IDS = new Set<string>([
  APPLE_PLATETAKER_MONTHLY,
  APPLE_PLATETAKER_ANNUAL,
  GOOGLE_PLATETAKER_MONTHLY,
  GOOGLE_PLATETAKER_ANNUAL,
]);

export type StoreMembershipRole = MembershipRole | 'shared';

export function membershipProductRole(productId: string): StoreMembershipRole | null {
  if (PLATETAKER_PRICE_IDS.has(productId)) return 'platetaker';
  if (SHARED_PRICE_IDS.has(productId)) return 'shared';
  return null;
}

export function membershipStoreProductId(
  store: 'apple',
  role: MembershipRole,
  interval: MembershipInterval,
): AppleMembershipProductId;
export function membershipStoreProductId(
  store: 'google',
  role: MembershipRole,
  interval: MembershipInterval,
): GoogleMembershipProductId;
export function membershipStoreProductId(
  store: 'apple' | 'google',
  role: MembershipRole,
  interval: MembershipInterval,
): AppleMembershipProductId | GoogleMembershipProductId {
  const yearly = interval === 'year';
  if (store === 'google') {
    if (role === 'platetaker') return yearly ? GOOGLE_PLATETAKER_ANNUAL : GOOGLE_PLATETAKER_MONTHLY;
    return yearly ? GOOGLE_PLATEMAKER_ANNUAL : GOOGLE_PLATEMAKER_MONTHLY;
  }
  if (role === 'platetaker') return yearly ? APPLE_PLATETAKER_ANNUAL : APPLE_PLATETAKER_MONTHLY;
  return yearly ? APPLE_PLATEMAKER_ANNUAL : APPLE_PLATEMAKER_MONTHLY;
}

/**
 * A PlateTaker product can be saved only on a PlateTaker account.
 * The original PlateMaker products stay valid for a PlateMaker, and for a PlateTaker
 * receipt from a binary that still asks for those products.
 */
export function assertMembershipProductRole(productId: string, role: string | null | undefined): void {
  const productRole = membershipProductRole(productId);
  if (!productRole) {
    throw new Error('This subscription is not a HomeCookedPlate membership.');
  }
  if (productRole === 'shared') return;
  const accountRole: MembershipRole = role === 'platemaker' ? 'platemaker' : 'platetaker';
  if (productRole !== accountRole) {
    throw new Error('This subscription is the PlateTaker price.');
  }
}
