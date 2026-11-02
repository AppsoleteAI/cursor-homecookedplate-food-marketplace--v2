import { appleExpiryToStore } from '../store-membership';

const now = new Date('2026-11-01T12:00:00.000Z');

describe('App Store expiry to store', () => {
  it('keeps a future end date and writes a past end date when Apple has no entitlement', () => {
    expect(appleExpiryToStore({
      configured: true,
      entitled: true,
      expiresAt: '2026-12-01T12:00:00.000Z',
    }, now)).toBe('2026-12-01T12:00:00.000Z');
    expect(appleExpiryToStore({
      configured: true,
      entitled: false,
      expiresAt: null,
    }, now)).toBe('2026-11-01T11:59:59.000Z');
    expect(appleExpiryToStore({
      configured: false,
      entitled: false,
      expiresAt: null,
    }, now)).toBeNull();
  });
});
