import { mintAccountCode } from '../account-identifier';
import { withholdFromPayout } from '../fees';
import { expressAccountFields, connectOnboardingUrls } from '../connect-account';
import { payoutStatusLabel, stallAnchorRelease } from '../payout-policy';
import { transferredCents } from '../stripe-marketplace';

describe('account identifiers', () => {
  it('gives a PlateMaker and a PlateTaker different codes, and a new account a new code', () => {
    const cook = mintAccountCode('platemaker', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
    const buyer = mintAccountCode('platetaker', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
    const nextCook = mintAccountCode('platemaker', Uint8Array.from([8, 7, 6, 5, 4, 3, 2, 1]));
    expect(cook.startsWith('PM-')).toBe(true);
    expect(buyer.startsWith('PT-')).toBe(true);
    expect(cook).not.toBe(buyer);
    expect(nextCook).not.toBe(cook);
    expect(cook).toHaveLength(11);
  });
});

describe('payout transfer safety', () => {
  it('withholds the dispute fee before the transfer amount is chosen', () => {
    expect(withholdFromPayout(1800, 1500)).toEqual({ withholdCents: 1500, transferCents: 300 });
    expect(withholdFromPayout(1800, 0)).toEqual({ withholdCents: 0, transferCents: 1800 });
    expect(withholdFromPayout(1000, 1500)).toEqual({ withholdCents: 1000, transferCents: 0 });
  });

  it('reverses the cents that were transferred, not the full cook share', () => {
    expect(transferredCents({ seller_payout: 18, stripe_transfer_cents: 300, dispute_fee_withheld_cents: 1500 })).toBe(300);
    expect(transferredCents({ seller_payout: 18, dispute_fee_withheld_cents: 1500 })).toBe(300);
    expect(transferredCents({ seller_payout: 18 })).toBe(1800);
  });

  it('starts the 7-day hold only after an uncleared order has waited 7 days', () => {
    const now = new Date('2026-11-14T00:00:00.000Z');
    expect(stallAnchorRelease({ now, anchorAt: new Date('2026-11-10T00:00:00.000Z') })).toBeNull();
    expect(stallAnchorRelease({ now, anchorAt: new Date('2026-11-07T00:00:00.000Z') })).toBe('2026-11-21T00:00:00.000Z');
    expect(stallAnchorRelease({ now, anchorAt: null })).toBeNull();
  });

  it('does not call a transfer settled money in the bank', () => {
    expect(payoutStatusLabel({
      status: 'held',
      releaseAt: null,
    })).toBe('Held until this order is cleared');
    expect(payoutStatusLabel({
      status: 'held',
      releaseAt: '2020-01-01T00:00:00.000Z',
      now: new Date('2026-11-07T00:00:00.000Z'),
    })).toBe('Held. The transfer has not been sent yet.');
    expect(payoutStatusLabel({
      status: 'settled',
      releaseAt: '2020-01-01T00:00:00.000Z',
      bankPayoutStatus: 'failed',
    })).toMatch(/could not pay your bank/);
    expect(payoutStatusLabel({
      status: 'settled',
      releaseAt: '2020-01-01T00:00:00.000Z',
      bankPayoutStatus: 'paid',
    })).toBe('Paid to your bank by Stripe');
  });

  it('asks Express only for transfers and uses an https return', () => {
    const fields = expressAccountFields({ email: 'cook@example.com', businessName: 'Kitchen' });
    expect(fields.get('type')).toBe('express');
    expect(fields.get('country')).toBe('US');
    expect(fields.get('capabilities[transfers][requested]')).toBe('true');
    expect(fields.get('capabilities[card_payments][requested]')).toBeNull();
    const urls = connectOnboardingUrls('acct_test');
    expect(urls.returnUrl.startsWith('https://')).toBe(true);
    expect(urls.refreshUrl.startsWith('https://')).toBe(true);
    expect(urls.returnUrl).not.toContain('homecookedplate://');
    expect(urls.refreshUrl).toContain('account=acct_test');
  });
});
