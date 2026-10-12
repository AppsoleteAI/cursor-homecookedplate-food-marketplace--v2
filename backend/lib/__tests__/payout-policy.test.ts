import { LOST_DISPUTE_FEE, sellerRefundAmount } from '../fees';
import { lostDisputeOutcome, payoutReleaseAt, removalReasons, warningReasons } from '../payout-policy';

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

  it('warns on the first lost dispute and bans on the fourth', () => {
    expect(LOST_DISPUTE_FEE).toBe(15);
    const first = lostDisputeOutcome(['2026-03-01T00:00:00.000Z'], new Date('2026-03-01T00:00:00.000Z'));
    expect(first).toMatchObject({ count: 1, banned: false, firstWarning: true, warnThirdIsBan: false });

    const secondClose = lostDisputeOutcome(
      ['2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'],
      new Date('2026-04-01T00:00:00.000Z'),
    );
    expect(secondClose).toMatchObject({ count: 2, banned: false, accelerated: true, warnThirdIsBan: true });

    const secondFar = lostDisputeOutcome(
      ['2026-01-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'],
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(secondFar).toMatchObject({ count: 2, banned: false, accelerated: false, warnThirdIsBan: false });

    const thirdAccelerated = lostDisputeOutcome(
      ['2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'],
      new Date('2026-08-01T00:00:00.000Z'),
    );
    expect(thirdAccelerated.banned).toBe(true);
    expect(thirdAccelerated.accelerated).toBe(true);

    const thirdSpread = lostDisputeOutcome(
      ['2026-01-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'],
      new Date('2026-09-01T00:00:00.000Z'),
    );
    expect(thirdSpread).toMatchObject({ count: 3, banned: false, warnFourthIsBan: true });

    const fourth = lostDisputeOutcome(
      ['2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'],
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(fourth.banned).toBe(true);
    expect(fourth.count).toBe(4);
  });

  it('warns one event before a rolling 30-day block', () => {
    expect(warningReasons({ refund: 4, chargeback: 2, complaint: 3, governmentRequest: 0 })).toEqual([
      '2 chargebacks in a rolling 30 days. One more blocks new orders.',
      '4 refunds in a rolling 30 days. One more blocks new orders.',
    ]);
    expect(warningReasons({ refund: 5, chargeback: 3, complaint: 5, governmentRequest: 0 })).toEqual([]);
  });
});
