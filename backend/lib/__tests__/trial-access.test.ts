import { platemakerTrialCountdownDays, unpaidPlatemakerTrialEnded } from '../trial-access';

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
