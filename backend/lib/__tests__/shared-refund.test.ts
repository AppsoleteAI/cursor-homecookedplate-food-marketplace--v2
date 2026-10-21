import { sharedChargeRefundCents } from '../fees';

describe('shared card refund', () => {
  it('refunds this order’s share and leaves the rest of the charge', () => {
    expect(sharedChargeRefundCents(15, [15, 15], 3300)).toBe(1650);
    expect(sharedChargeRefundCents(10, [10, 30], 4400)).toBe(1100);
    expect(sharedChargeRefundCents(0, [10], 1000)).toBe(0);
  });
});