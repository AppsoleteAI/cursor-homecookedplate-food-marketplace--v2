import { calculateOrderSplit } from '../fees';
import { assertEmailConfirmed } from '../email-confirmation';

describe('launch guards', () => {
  it('charges the buyer 10% and pays the cook 90% of the plate price', () => {
    const split = calculateOrderSplit(20);
    expect(split.totalCaptured).toBeCloseTo(22);
    expect(split.sellerPayout).toBeCloseTo(18);
    expect(split.appRevenue).toBeCloseTo(4);
  });

  it('rejects an unconfirmed email and allows a confirmed one', () => {
    expect(() => assertEmailConfirmed(null)).toThrow(/Confirm your email/);
    expect(() => assertEmailConfirmed(undefined)).toThrow(/Confirm your email/);
    expect(() => assertEmailConfirmed('2026-10-07T00:00:00.000Z')).not.toThrow();
  });
});
