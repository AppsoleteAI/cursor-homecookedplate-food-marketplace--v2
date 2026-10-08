import { sellerRefundAmount } from '../fees';
import { payoutReleaseAt, removalReasons, warningReasons } from '../payout-policy';

describe('payout hold and responsibility', () => {
  it('refunds only the cook share', () => {
    expect(sellerRefundAmount(20)).toBeCloseTo(18);
  });

  it('holds a payout for 7 days', () => {
    expect(payoutReleaseAt(new Date('2026-10-07T15:00:00.000Z'))).toBe('2026-10-14T15:00:00.000Z');
  });

  it('removes selling at the stated counts', () => {
    expect(removalReasons({ refund: 4, chargeback: 2, complaint: 4, governmentRequest: 0 })).toEqual([]);
    expect(removalReasons({ refund: 5, chargeback: 0, complaint: 0, governmentRequest: 0 })).toEqual([
      '5 refunds in 30 days.',
    ]);
    expect(removalReasons({ refund: 0, chargeback: 0, complaint: 0, governmentRequest: 1 })[0]).toMatch(/government request/);
  });

  it('warns one event before a rolling 30-day block', () => {
    expect(warningReasons({ refund: 4, chargeback: 2, complaint: 3, governmentRequest: 0 })).toEqual([
      '2 chargebacks in a rolling 30 days. One more blocks new orders.',
      '4 refunds in a rolling 30 days. One more blocks new orders.',
    ]);
    expect(warningReasons({ refund: 5, chargeback: 3, complaint: 5, governmentRequest: 0 })).toEqual([]);
  });
});
