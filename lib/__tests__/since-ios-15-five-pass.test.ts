import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SIGNED_LEGAL_RECORD, legalSignInDecision } from '@/backend/lib/legal-gate';
import { REVOKED_SESSION_MESSAGE } from '@/backend/lib/sign-in-messages';
import {
  firstActionDestination,
  firstActionRole,
  firstLegalReady,
  firstLocationReady,
  firstStepHref,
  nextFirstStep,
} from '../first-action';
import { signedOutDestination } from '../guest-role';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const created = new Date('2026-01-01T00:00:00.000Z');

function five(run: () => void) {
  for (let pass = 1; pass <= 5; pass += 1) run();
}

describe('updates since iOS 15', () => {
  it('keeps the revoked-session notice that shipped in iOS 16', () => {
    five(() => {
      expect(REVOKED_SESSION_MESSAGE).toBe('This saved sign-in has ended. Sign in again.');
      expect(read('app/(auth)/login.tsx')).toContain('REVOKED_SESSION_NOTICE_KEY');
    });
  });

  it('keeps Search and a plate page open for a signed-out PlateMaker and PlateTaker', () => {
    five(() => {
      expect(read('app/(tabs)/search.tsx')).not.toContain('return <GuestLimit');
      const plate = read('app/meal/[id].tsx');
      expect(plate).toContain("requireAccount('add this plate')");
      expect(plate).toContain("requireAccount('review this plate')");
      expect(plate).toContain("requireAccount('save a favorite')");
      expect(plate).not.toContain('return <GuestLimit');
    });
  });

  it('keeps Orders on the cook dashboard for a signed-out PlateMaker and the guest card for a PlateTaker', () => {
    five(() => {
      const orders = read('app/(tabs)/buyer-dashboard.tsx');
      expect(orders).toContain("guestRole === 'platemaker'");
      expect(orders).toContain('href="/(tabs)/dashboard"');
      expect(orders).toContain('<GuestLimit screen="orders" />');
    });
  });

  it('opens Sign in after an account and limited browsing when no Supabase marker is stored', () => {
    five(() => {
      expect(signedOutDestination(true, 'platemaker', 'platemaker')).toBe('/(auth)/login');
      expect(signedOutDestination(true, 'platetaker', null)).toBe('/(auth)/login');
      expect(signedOutDestination(false, 'platemaker', null)).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, 'platetaker', 'platetaker')).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, null, 'platemaker')).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, null, 'platetaker')).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, null, null)).toBe('/(auth)/limited-browsing');
    });
  });

  it('walks a PlateTaker to checkout and a PlateMaker to publish, skipping a saved step', () => {
    five(() => {
      expect(firstActionRole('order')).toBe('platetaker');
      expect(firstActionRole('publish')).toBe('platemaker');
      expect(firstActionDestination('order')).toBe('/checkout');
      expect(firstActionDestination('publish')).toBe('/publish-plate');
      expect(nextFirstStep({ legalReady: false, locationReady: false, briefReady: false })).toBe('legal');
      expect(nextFirstStep({ legalReady: true, locationReady: false, briefReady: false })).toBe('location');
      expect(nextFirstStep({ legalReady: true, locationReady: true, briefReady: false })).toBe('brief');
      expect(nextFirstStep({ legalReady: true, locationReady: true, briefReady: true })).toBe('ready');
      expect(firstLegalReady(SIGNED_LEGAL_RECORD, created)).toBe(true);
      expect(firstLegalReady(null, created)).toBe(false);
      expect(firstLocationReady('Remote/Other')).toBe(true);
      expect(firstLocationReady('')).toBe(false);
      expect(firstStepHref('legal', 'order')).toEqual({ pathname: '/legal', params: { entry: 'first-action', action: 'order' } });
      expect(firstStepHref('brief', 'publish')).toEqual({
        pathname: '/(auth)/welcome',
        params: { entry: 'first-action', action: 'publish', step: '3', role: 'platemaker' },
      });
    });
  });

  it('leaves the Legal & Safety box on Sign in and does not block either role', () => {
    five(() => {
      const login = read('app/(auth)/login.tsx');
      expect(login).not.toContain('if (!legalChecked)');
      expect(login).toContain('router.replace(\'/(auth)/limited-browsing\')');
      expect(login).toContain('Not a member yet?');
      expect(read('backend/trpc/routes/auth/login/route.ts')).not.toContain("legalDecision === 'refuse'");
      expect(read('hooks/auth-context.tsx')).not.toContain('LEGAL_SIGN_IN_MESSAGE');
      expect(legalSignInDecision({ stored: null, createdAt: created })).toBe('refuse');
    });
  });

  it('opens Your Account from the guest card and returns that back control to Sign in', () => {
    five(() => {
      const guest = read('components/GuestLimit.tsx');
      expect(guest).toContain("pathname: '/(auth)/onboarding'");
      expect(guest).toContain("step: '1'");
      expect(guest).not.toContain("pathname: '/(auth)/welcome'");
      const account = read('app/(auth)/onboarding.tsx');
      expect(account).toContain("useReplaceBack('/(auth)/login', openedOnAccount && step === 1)");
      expect(account).toContain("router.replace(firstAction === 'publish' ? '/(tabs)/create-meal' : '/(tabs)/cart')");
    });
  });

  it('puts the notes on the first PlateTaker checkout and cottage rules on the first PlateMaker plate', () => {
    five(() => {
      expect(read('app/checkout.tsx')).toContain("useFirstActionRedirect('order')");
      expect(read('app/combined-checkout.tsx')).toContain("useFirstActionRedirect('order')");
      expect(read('app/publish-plate.tsx')).toContain("useFirstActionRedirect('publish')");
      const welcome = read('app/(auth)/welcome.tsx');
      expect(welcome).toContain('A Few Notes Before You Order');
      expect(welcome).toContain('Cottage Food Rules');
      expect(welcome).toContain("isFirst ? 'Continue'");
    });
  });
});
