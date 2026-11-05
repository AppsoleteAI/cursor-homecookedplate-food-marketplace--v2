import { providerAccountBlock } from '../provider-account';
import { providerSessionFromRedirect } from '@/lib/provider-redirect';

const confirmed = '2026-11-02T18:00:00.000Z';

describe.each([1, 2, 3])('provider sign-in account, run %s', () => {
  it('accepts a confirmed PlateMaker and a confirmed PlateTaker', () => {
    expect(providerAccountBlock({
      role: 'platemaker',
      is_paused: false,
      ordering_removed: false,
      email_confirmed_at: confirmed,
    })).toBeNull();
    expect(providerAccountBlock({
      role: 'platetaker',
      is_paused: false,
      ordering_removed: false,
      email_confirmed_at: confirmed,
    })).toBeNull();
  });

  it('refuses a missing account, a paused account, and an unconfirmed email for both roles', () => {
    expect(providerAccountBlock(null)).toMatch(/No account found/);
    expect(providerAccountBlock({ role: 'guest', email_confirmed_at: confirmed })).toMatch(/No account found/);
    for (const role of ['platemaker', 'platetaker'] as const) {
      expect(providerAccountBlock({ role, is_paused: true, email_confirmed_at: confirmed })).toMatch(/paused/);
      expect(providerAccountBlock({ role, ordering_removed: true, email_confirmed_at: confirmed })).toMatch(/no longer eligible/);
      expect(providerAccountBlock({ role, email_confirmed_at: null })).toMatch(/Confirm your email/);
    }
  });

  it('reads the provider return for Apple and Google', () => {
    expect(providerSessionFromRedirect('homecookedplate://login?code=abc')).toEqual({ code: 'abc' });
    expect(providerSessionFromRedirect('https://homecookedplate.com/login#access_token=tok&refresh_token=ref')).toEqual({
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    expect(providerSessionFromRedirect('https://homecookedplate.com/login')).toBeNull();
  });
});
