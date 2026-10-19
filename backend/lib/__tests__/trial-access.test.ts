import { platemakerMayEnter, platemakerTrialCountdownDays, unpaidPlatemakerTrialEnded, userNeedsMembership } from '../trial-access';

const now = new Date('2026-10-16T12:00:00.000Z');

describe('unpaid PlateMaker trial end', () => {
  const ended = {
    role: 'platemaker',
    membership_tier: 'premium',
    trial_ends_at: '2026-07-18T12:00:00.000Z',
    stripe_subscription_id: null,
    apple_original_transaction_id: null,
    google_purchase_token: null,
  };

  it('ends premium when the trial date has passed and there is no paid membership', () => {
    expect(unpaidPlatemakerTrialEnded(ended, now)).toBe(true);
  });

  it('keeps premium while the trial date is still ahead', () => {
    expect(unpaidPlatemakerTrialEnded({
      ...ended,
      trial_ends_at: '2026-11-16T12:00:00.000Z',
    }, now)).toBe(false);
  });

  it('keeps a paid PlateMaker on premium after the trial date', () => {
    expect(unpaidPlatemakerTrialEnded({
      ...ended,
      stripe_subscription_id: 'sub_123',
    }, now)).toBe(false);
    expect(unpaidPlatemakerTrialEnded({
      ...ended,
      apple_original_transaction_id: 'apple-1',
    }, now)).toBe(false);
    expect(unpaidPlatemakerTrialEnded({
      ...ended,
      google_purchase_token: 'play-token',
    }, now)).toBe(false);
  });

  it('does not apply the trial end to a PlateTaker', () => {
    expect(unpaidPlatemakerTrialEnded({ ...ended, role: 'platetaker' }, now)).toBe(false);
  });
});

describe('PlateMaker app access', () => {
  const now = new Date('2026-10-16T12:00:00.000Z');
  const open = {
    role: 'platemaker',
    membership_tier: 'premium',
    trial_ends_at: '2026-11-16T12:00:00.000Z',
    stripe_subscription_id: null,
    apple_original_transaction_id: null,
    google_purchase_token: null,
  };

  it('keeps a PlateMaker out until Early Bird or a paid membership', () => {
    expect(platemakerMayEnter({ ...open, membership_tier: 'free', trial_ends_at: null }, now)).toBe(false);
  });

  it('lets a PlateMaker in during Early Bird', () => {
    expect(platemakerMayEnter(open, now)).toBe(true);
  });

  it('sends a PlateMaker back to membership after the end date', () => {
    expect(platemakerMayEnter({ ...open, trial_ends_at: '2026-10-01T12:00:00.000Z' }, now)).toBe(false);
  });

  it('lets a paid PlateMaker in', () => {
    expect(platemakerMayEnter({
      ...open,
      membership_tier: 'premium',
      trial_ends_at: null,
      stripe_subscription_id: 'sub_123',
    }, now)).toBe(true);
  });

  it('does not gate a PlateTaker', () => {
    expect(platemakerMayEnter({ ...open, role: 'platetaker', membership_tier: 'free', trial_ends_at: null }, now)).toBe(true);
    expect(userNeedsMembership({ role: 'platetaker', membershipTier: 'free' })).toBe(false);
  });

  it('gates a PlateMaker with no membership flag yet', () => {
    expect(userNeedsMembership({ role: 'platemaker', membershipTier: 'free' })).toBe(true);
    expect(userNeedsMembership({ role: 'platemaker', membershipTier: 'premium' })).toBe(false);
    expect(userNeedsMembership({ role: 'platemaker', needsMembership: true, membershipTier: 'premium' })).toBe(true);
  });

  it('does not force a charge when the metro is Remote/Other', () => {
    expect(userNeedsMembership({
      role: 'platemaker',
      membershipTier: 'free',
      needsMembership: true,
      metroArea: 'Remote/Other',
    })).toBe(false);
    expect(userNeedsMembership({
      role: 'platemaker',
      membershipTier: 'free',
      metroArea: null,
    })).toBe(false);
  });
});

describe('PlateMaker trial countdown', () => {
  const open = {
    role: 'platemaker',
    membership_tier: 'premium',
    trial_ends_at: '2026-10-26T12:00:00.000Z',
    stripe_subscription_id: null,
    apple_original_transaction_id: null,
    google_purchase_token: null,
  };

  it('counts the last 10 days', () => {
    expect(platemakerTrialCountdownDays(open, now)).toBe(10);
  });

  it('stays hidden until 10 days remain', () => {
    expect(platemakerTrialCountdownDays({
      ...open,
      trial_ends_at: '2026-10-27T12:00:00.000Z',
    }, now)).toBeNull();
  });

  it('stays hidden after the trial has ended', () => {
    expect(platemakerTrialCountdownDays({
      ...open,
      trial_ends_at: '2026-10-16T12:00:00.000Z',
    }, now)).toBeNull();
  });

  it('stays hidden when the PlateMaker already paid', () => {
    expect(platemakerTrialCountdownDays({
      ...open,
      google_purchase_token: 'play-token',
    }, now)).toBeNull();
  });
});
