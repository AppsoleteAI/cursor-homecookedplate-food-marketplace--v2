import { LOST_DISPUTE_FEE, salesVolumeCap, sellerRefundAmount } from '../fees';
import { lostDisputeOutcome, payoutReleaseAt, removalReasons, salesCapForCook, salesVolumeBlockMessage, warningReasons } from '../payout-policy';

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

  it('raises the sales cap every clear 30 days and stops at the ceiling', () => {
    expect(salesVolumeCap(0)).toEqual({ weekly: 1000, monthly: 3500 });
    expect(salesVolumeCap(29)).toEqual({ weekly: 1000, monthly: 3500 });
    expect(salesVolumeCap(30)).toEqual({ weekly: 2000, monthly: 7000 });
    expect(salesVolumeCap(90)).toEqual({ weekly: 4000, monthly: 14000 });
    expect(salesVolumeCap(120)).toEqual({ weekly: 5000, monthly: 17500 });
    expect(salesVolumeCap(400)).toEqual({ weekly: 5000, monthly: 17500 });
  });

  it('keeps a new cook and a cook with a complaint on the base sales cap', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const later = new Date('2026-06-01T00:00:00.000Z');
    expect(salesCapForCook({
      accountStartedAt: started,
      chargebacks: 0,
      complaints: 0,
      now: new Date('2026-01-10T00:00:00.000Z'),
    }).weekly).toBe(1000);
    expect(salesCapForCook({
      accountStartedAt: started,
      chargebacks: 0,
      complaints: 1,
      now: later,
    })).toMatchObject({ weekly: 1000, monthly: 3500, clearDays: 0 });
    expect(salesCapForCook({
      accountStartedAt: started,
      chargebacks: 0,
      complaints: 0,
      now: later,
    }).weekly).toBe(5000);
    expect(salesVolumeBlockMessage({ weekly: 1000, monthly: 3500 }, 900, 1000, 200)).toMatch(/7 days/);
    expect(salesVolumeBlockMessage({ weekly: 1000, monthly: 3500 }, 100, 3400, 200)).toMatch(/30 days/);
    expect(salesVolumeBlockMessage({ weekly: 1000, monthly: 3500 }, 800, 3000, 200)).toBeNull();
  });

  it('warns one event before a rolling 30-day block', () => {
    expect(warningReasons({ refund: 4, chargeback: 2, complaint: 3, governmentRequest: 0 })).toEqual([
      '2 chargebacks in a rolling 30 days. One more blocks new orders.',
      '4 refunds in a rolling 30 days. One more blocks new orders.',
    ]);
    expect(warningReasons({ refund: 5, chargeback: 3, complaint: 5, governmentRequest: 0 })).toEqual([]);
  });
});
