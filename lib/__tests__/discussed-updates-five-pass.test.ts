import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDuplicateAuthError } from '@/backend/lib/signup-account';
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  PROVIDER_CONTINUE_MESSAGE,
  signupAlreadyRegisteredMessage,
} from '@/backend/lib/provider-profile';
import { accountEntryDestination, homeEntryDestination, signedOutDestination } from '../guest-role';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

function five(run: () => void) {
  for (let pass = 1; pass <= 5; pass += 1) run();
}

describe('discussed updates', () => {
  it('opens Sign in only when this device has had a Supabase account', () => {
    five(() => {
      expect(signedOutDestination(true, 'platemaker', null)).toBe('/(auth)/login');
      expect(signedOutDestination(true, 'platetaker', 'platetaker')).toBe('/(auth)/login');
      expect(signedOutDestination(false, 'platemaker', 'platemaker')).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, 'platetaker', null)).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, null, 'platemaker')).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, null, 'platetaker')).toBe('/(auth)/limited-browsing');
      expect(signedOutDestination(false, null, null)).toBe('/(auth)/limited-browsing');
      expect(homeEntryDestination(false, 'platetaker', null)).toBe('/(tabs)/(home)/home');
      expect(homeEntryDestination(false, 'platemaker', 'platemaker')).toBe('/(tabs)/(home)/home');
      expect(homeEntryDestination(false, null, 'platemaker')).toBe('/(auth)/limited-browsing');
      expect(homeEntryDestination(true, null, null)).toBe('/(auth)/login');
      expect(accountEntryDestination(true, false)).toBe('/');
      expect(accountEntryDestination(false, true)).toBe('/');
      expect(accountEntryDestination(false, false)).toBe('location');
    });
  });

  it('does not treat a bare 422 as an Apple or Google account', () => {
    five(() => {
      expect(isDuplicateAuthError({ status: 422, message: 'Unprocessable' })).toBe(false);
      expect(isDuplicateAuthError({ code: 422, message: 'Unprocessable' })).toBe(false);
      expect(isDuplicateAuthError({ message: 'A user with this email address has already been registered' })).toBe(true);
      expect(isDuplicateAuthError({ code: '23505' })).toBe(true);
      expect(signupAlreadyRegisteredMessage({
        profileExists: false,
        passwordAccepted: false,
        identity: 'email',
      })).toBe(EMAIL_ALREADY_REGISTERED_MESSAGE);
      expect(signupAlreadyRegisteredMessage({
        profileExists: false,
        passwordAccepted: false,
        identity: 'apple',
      })).toBe(PROVIDER_CONTINUE_MESSAGE);
      expect(signupAlreadyRegisteredMessage({
        profileExists: false,
        passwordAccepted: false,
        identity: 'google',
      })).toBe(PROVIDER_CONTINUE_MESSAGE);
    });
  });

  it('keeps the typed username and sends confirmation after the first order or plate', () => {
    five(() => {
      const finish = read('backend/trpc/routes/auth/finish-provider-account/route.ts');
      const screen = read('app/(auth)/account-name.tsx');
      const orders = read('backend/trpc/routes/orders/create/route.ts');
      const meals = read('backend/trpc/routes/meals/create/route.ts');
      const checkout = read('backend/trpc/routes/payments/combined-checkout/route.ts');
      expect(finish).toContain('input.username');
      expect(finish).toContain('action_email_pending: true');
      expect(finish).not.toContain('usernameCandidates');
      expect(screen).toContain('saveProviderIdentity');
      expect(orders).toContain('sendActionEmailIfDue');
      expect(meals).toContain('sendActionEmailIfDue');
      expect(checkout).toContain('sendActionEmailIfDue');
    });
  });

  it('asks for location before Home or the cook dashboard and matches the swipe to that back target', () => {
    five(() => {
      const login = read('app/(auth)/login.tsx');
      const onboarding = read('app/(auth)/onboarding.tsx');
      const accountName = read('app/(auth)/account-name.tsx');
      const leave = read('hooks/use-leave-screen.ts');
      expect(login).toContain("entry: 'enter'");
      expect(onboarding).toContain("entry === 'enter'");
      expect(onboarding).toContain("backParam === 'account-name'");
      expect(accountName).toContain("back: 'account-name'");
      expect(onboarding).toContain('Find My Location before the kitchen or the plate list opens.');
      expect(onboarding).toContain("backParam === 'near-you'");
      expect(onboarding).toContain("router.replace('/(auth)/limited-browsing')");
      expect(onboarding).toContain('HomeCookedPlate, back to limited browsing');
      expect(onboarding).toContain('markGuestLocationPassed');
      expect(login).toContain('accountEntryDestination');
      expect(accountName).toContain('accountEntryDestination');
      expect(read('app/(auth)/limited-browsing.tsx')).toContain('writeGuestRole');
      expect(read('app/(auth)/welcome.tsx')).toContain("back: 'near-you'");
      expect(read('app/(tabs)/_layout.tsx')).toContain('homeEntryDestination');
      expect(leave).toContain('beforeRemove');
      expect(leave).toContain("type !== 'GO_BACK' && type !== 'POP'");
    });
  });

  it('keeps sample plates when the 20-mile circle is empty', () => {
    five(() => {
      const list = read('backend/trpc/routes/meals/list/route.ts');
      expect(list).not.toContain('if (!traveling && nearby.available && nearby.ids.length === 0) return [];');
      expect(list).toContain('if (input?.userId) return realMeals;');
      expect(list).toContain('visibleSampleMeals');
      expect(list).not.toContain('if (input?.userId || nearby.available || traveling) return realMeals;');
    });
  });

  it('keeps the card hit box still and uses a cookie photo that loads', () => {
    five(() => {
      const glass = read('components/glass-surface.tsx');
      const market = read('constants/farm-grown-basket.ts');
      expect(glass).toContain('const PRESS_SCALE_ON_BUTTON = false');
      expect(glass).toContain("minHeight: '100%'");
      expect(glass).toContain('pointerEvents="box-none"');
      expect(glass).toContain('style={PRESS_SCALE_ON_BUTTON ? [flatStyle, bounce.animStyle] : [flatStyle, styles.pressBox]}');
      expect(glass).toContain('styles.pressShade');
      expect(glass).not.toContain('style={[pressFaceLayout(flatStyle), bounce.animStyle]}');
      expect(market).toContain('https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800');
      expect(market).not.toContain('photo-1499636136210-6f4ee915583a');
    });
  });
});
