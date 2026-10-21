import { buyerServiceFeePercent, saleRefundCents } from '../fees';
import { earlyBirdCoversThisMetro } from '../early-bird-claim';
import { namedMetro } from '../metro-headcount';
import { formatPickupTime } from '@/lib/pickup-time';

describe('PlateTaker Premium service fee', () => {
  it('cuts the buyer fee to 5% at $20 and keeps 10% below that', () => {
    expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'premium', baseAmount: 20 })).toBe(5);
    expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'premium', baseAmount: 19.99 })).toBe(10);
    expect(buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'free', baseAmount: 40 })).toBe(10);
    expect(buyerServiceFeePercent({ role: 'platemaker', membershipTier: 'premium', baseAmount: 40 })).toBe(10);
    expect(saleRefundCents(20)).toBe(1800);
  });
});

describe('Early Bird city', () => {
  it('keeps the end date with the claim metro unless an open order is waiting', () => {
    expect(earlyBirdCoversThisMetro('Pittsburgh', 'Pittsburgh', false)).toBe(true);
    expect(earlyBirdCoversThisMetro('Pittsburgh', 'Cleveland', false)).toBe(false);
    expect(earlyBirdCoversThisMetro('Pittsburgh', 'Cleveland', true)).toBe(true);
    expect(earlyBirdCoversThisMetro(null, 'Cleveland', false)).toBe(true);
  });

  it('does not count Remote/Other as a named metro', () => {
    expect(namedMetro('Remote/Other')).toBeNull();
    expect(namedMetro('Pittsburgh')).toBe('Pittsburgh');
  });
});

describe('pickup time zone', () => {
  it('shows the saved zone instead of UTC', () => {
    const shown = formatPickupTime('2026-01-15T18:00:00.000Z', 'America/New_York');
    expect(shown.includes('1:00') || shown.includes('13:00')).toBe(true);
  });
});
