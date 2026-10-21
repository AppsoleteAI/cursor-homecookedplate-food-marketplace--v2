import { nextSignInAttempt, openSignInCanEmailNewCode, SIGN_IN_CODE_ATTEMPTS, SIGN_IN_CODE_LOCKED_MESSAGE, signInCodeStillOpen, signInCodeWasLocked } from '../sign-in-code';
import { lifetimeShouldSaveDevice } from '../lifetime-device';
import { reviewAverage } from '../review-stars';
import { orderBuyerId } from '../order-row';

describe('phase 10', () => {
  it('locks a sign-in code on the fifth wrong try', () => {
    expect(nextSignInAttempt(undefined)).toEqual({ attempts: 1, locked: false });
    expect(nextSignInAttempt(SIGN_IN_CODE_ATTEMPTS - 1).locked).toBe(true);
    expect(nextSignInAttempt(3)).toEqual({ attempts: 4, locked: false });
  });

  it('keeps an open sign-in code until it expires or five wrong tries close it', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const open = { used: false, expiresAt: '2026-10-20T12:10:00.000Z', attempts: 4 };
    expect(signInCodeStillOpen(open, now)).toBe(true);
    expect(signInCodeStillOpen({ ...open, attempts: 5 }, now)).toBe(false);
    expect(signInCodeStillOpen({ ...open, used: true, attempts: 1 }, now)).toBe(false);
    expect(signInCodeStillOpen({ ...open, expiresAt: '2026-10-20T11:59:00.000Z' }, now)).toBe(false);
    expect(signInCodeStillOpen(null, now)).toBe(false);
    expect(signInCodeWasLocked({ used: true, attempts: 5 })).toBe(true);
    expect(signInCodeWasLocked({ used: true, attempts: 1 })).toBe(false);
    expect(openSignInCanEmailNewCode(SIGN_IN_CODE_LOCKED_MESSAGE)).toBe(true);
    expect(openSignInCanEmailNewCode('That sign-in code does not match.')).toBe(false);
  });

  it('keeps a lifetime account when this device token differs', () => {
    expect(lifetimeShouldSaveDevice(null, 'device-b')).toBe(false);
    expect(lifetimeShouldSaveDevice('device-a', 'device-a')).toBe(false);
    expect(lifetimeShouldSaveDevice('device-a', 'device-b')).toBe(true);
  });

  it('averages server ratings and reads the live buyer column', () => {
    expect(reviewAverage([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
    expect(reviewAverage([])).toEqual({ average: 0, count: 0 });
    expect(orderBuyerId({ platetaker_id: 'buyer-1' })).toBe('buyer-1');
    expect(orderBuyerId({ buyer_id: null, platetaker_id: 'buyer-2' })).toBe('buyer-2');
  });
});