import { buyerServiceFeePercent } from '../fees';
import {
  APPLE_RENEWAL_DELETE_MESSAGE,
  appleDeletionBlock,
  resolvedMembershipTier,
  type TrialAccessProfile,
} from '../trial-access';

const now = new Date('2026-11-02T18:00:00.000Z');

/**
 * Profile columns already stored for the PlateMaker and PlateTaker accounts.
 * The public profile list returns no rows, so these runs do not read or delete those accounts.
 * Each run applies the same App Store dates the live check writes onto those columns.
 */
const plateMaker: TrialAccessProfile = {
  role: 'platemaker',
  membership_tier: 'premium',
  trial_ends_at: '2026-12-15T18:00:00.000Z',
  stripe_subscription_id: null,
  apple_original_transaction_id: 'review-ios-platemaker',
  google_purchase_token: null,
};

const plateTaker: TrialAccessProfile = {
  role: 'platetaker',
  membership_tier: 'premium',
  trial_ends_at: null,
  stripe_subscription_id: null,
  apple_original_transaction_id: 'review-ios-platetaker',
  google_purchase_token: null,
};

function signedInPremium(user: { membershipTier?: string | null } | null): boolean {
  return user?.membershipTier === 'premium';
}

describe.each([1, 2, 3])('account membership flows, run %s', () => {
  it('refuses deletion while the App Store membership is renewing', () => {
    for (const account of [plateMaker, plateTaker]) {
      expect(appleDeletionBlock(account, { configured: true, renewing: true }, now)).toBe(APPLE_RENEWAL_DELETE_MESSAGE);
    }
  });

  it('allows deletion after the App Store membership expires', () => {
    for (const account of [plateMaker, plateTaker]) {
      const expired = { ...account, apple_expires_at: '2026-11-01T18:00:00.000Z', apple_revoked_at: null };
      expect(appleDeletionBlock(expired, { configured: true, renewing: false }, now)).toBeNull();
    }
  });

  it('allows deletion after the App Store membership is refunded', () => {
    for (const account of [plateMaker, plateTaker]) {
      const refunded = {
        ...account,
        apple_expires_at: '2026-12-01T18:00:00.000Z',
        apple_revoked_at: '2026-11-02T12:00:00.000Z',
      };
      expect(appleDeletionBlock(refunded, { configured: true, renewing: false }, now)).toBeNull();
    }
  });

  it('drops PlateTaker Premium and returns the buyer fee to 10% after the date is stored', () => {
    const expired = {
      ...plateTaker,
      apple_expires_at: '2026-11-01T18:00:00.000Z',
    };
    expect(resolvedMembershipTier(expired, now)).toBe('free');
    expect(buyerServiceFeePercent({
      role: expired.role,
      membershipTier: resolvedMembershipTier(expired, now),
      baseAmount: 20,
    })).toBe(10);
    const refunded = { ...expired, apple_revoked_at: '2026-11-02T12:00:00.000Z' };
    expect(resolvedMembershipTier(refunded, now)).toBe('free');
    expect(buyerServiceFeePercent({
      role: refunded.role,
      membershipTier: resolvedMembershipTier(refunded, now),
      baseAmount: 40,
    })).toBe(10);
  });

  it('keeps PlateMaker Premium only while Early Bird, Stripe, Play, or lifetime still covers', () => {
    const expired = { ...plateMaker, apple_expires_at: '2026-11-01T18:00:00.000Z' };
    expect(resolvedMembershipTier(expired, now)).toBe('premium');
    expect(resolvedMembershipTier({ ...expired, trial_ends_at: '2026-10-01T18:00:00.000Z' }, now)).toBe('free');
    expect(resolvedMembershipTier({
      ...expired,
      trial_ends_at: '2026-10-01T18:00:00.000Z',
      stripe_subscription_id: 'sub_maker',
    }, now)).toBe('premium');
    expect(resolvedMembershipTier({
      ...expired,
      trial_ends_at: '2026-10-01T18:00:00.000Z',
      google_purchase_token: 'play-maker',
      google_expires_at: '2026-12-01T18:00:00.000Z',
    }, now)).toBe('premium');
    expect(resolvedMembershipTier({
      ...expired,
      membership_tier: 'lifetime',
      trial_ends_at: '2026-10-01T18:00:00.000Z',
    }, now)).toBe('lifetime');
  });

  it('shows no Premium membership while signed out', () => {
    expect(signedInPremium(null)).toBe(false);
    expect(signedInPremium({ membershipTier: resolvedMembershipTier({
      ...plateTaker,
      apple_expires_at: '2026-11-01T18:00:00.000Z',
    }, now) })).toBe(false);
  });
});
