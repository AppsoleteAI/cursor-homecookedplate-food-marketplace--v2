import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withinPickupRadius } from '../pickup-radius';
import { pickupConfirmedByBoth } from '../order-status';
import { orderCloseout } from '@/lib/order-closeout';
import { scrubSentryEvent, sentryIdentity } from '@/lib/sentry-user';

const root = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

function unchecked(note: string, line: string) {
  expect(note).toContain(`- [ ] ${line}`);
  expect(note).not.toContain(`- [x] ${line}`);
}

function publicAuth(): { url: string; key: string } {
  const file = readFileSync(resolve(root, '.env'), 'utf8');
  const value = (name: string) => {
    const line = file.split('\n').find((entry) => entry.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  };
  const url = value('EXPO_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const key = value('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('The public Supabase URL and anon key are missing.');
  return { url, key };
}

const cook = { lat: 40.440624, lng: -79.995888 };
const nearby = { lat: 40.5, lng: -80.0 };
const far = { lat: 25.7617, lng: -80.1918 };

describe.each([1, 2, 3, 4, 5])('open launch checks, pass %s', () => {
  it('keeps the Sentry phone check open while the shared scrub stays on the account id', () => {
    const phone = read('docs/PHONE_DIAGNOSTICS.md');
    unchecked(
      phone,
      'Prove Sentry on a phone. Install a preview or store build. Sign in as a PlateMaker, turn on airplane mode, and refresh orders. The new Sentry issue shows an account id. Email, username, and IP are empty. Repeat signed in as a PlateTaker.',
    );
    unchecked(
      phone,
      'Install a preview or store build, sign in as a PlateMaker, turn on airplane mode, and refresh orders. The new Sentry issue shows an account id. Email, username, and IP are empty.',
    );
    unchecked(phone, 'Repeat signed in as a PlateTaker.');
    expect(read('components/GetGpsCard.tsx')).toContain("user?.role !== 'platemaker'");

    for (const account of [
      { id: 'cook-account', role: 'platemaker', email: 'cook@example.com', username: 'cook' },
      { id: 'buyer-account', role: 'platetaker', email: 'buyer@example.com', username: 'buyer' },
    ]) {
      expect(account.role === 'platemaker' || account.role === 'platetaker').toBe(true);
      expect(sentryIdentity(account)).toEqual({ id: account.id });
      const event = {
        user: { id: account.id, email: account.email, username: account.username, ip_address: '203.0.113.8' },
        extra: { email: account.email, username: account.username, userId: account.id },
      };
      scrubSentryEvent(event);
      expect(event.user).toEqual({ id: account.id });
      expect(event.extra).toEqual({ userId: account.id });
    }
  });

  it('keeps the live card on the phone note and leaves the webhook secret alone', () => {
    const phone = read('docs/PHONE_DIAGNOSTICS.md');
    const handler = read('backend/hono.ts');
    unchecked(
      phone,
      'Pay one live card on two phones. On one phone, a PlateTaker pays for a plate. On the other, that plate’s PlateMaker accepts the paid order. Then Event deliveries shows `payment_intent.succeeded` with 200. Leave the webhook secret as it is.',
    );
    unchecked(
      phone,
      'On one phone, a PlateTaker pays for a plate with a live card. On the other phone, that plate’s PlateMaker accepts the paid order. On Event deliveries, `payment_intent.succeeded` shows 200. Leave the webhook secret as it is.',
    );
    expect(phone).toContain('Signed out, neither role can pay or accept.');
    expect(handler).toContain("event.type === 'payment_intent.succeeded'");
    expect(handler).toContain('return c.json({ received: true })');
    expect(handler).not.toMatch(/whsec_|sk_live_/);
    expect(read('backend/trpc/routes/orders/create/route.ts')).toContain('protectedProcedure');
    expect(read('backend/trpc/routes/platemaker/accept-order/route.ts')).toContain('protectedProcedure');
  });

  it('keeps build 9 off the public phones and off the Play internal page in the notes', () => {
    const launch = read('docs/POST_LAUNCH_DIAGNOSTICS.md');
    const phone = read('docs/PHONE_DIAGNOSTICS.md');
    const app = JSON.parse(read('app.json')) as {
      expo: { ios: { buildNumber: string }; android: { versionCode: number } };
    };
    unchecked(phone, 'Install iOS 1.0.0 (9) from TestFlight or the App Store once that review is approved.');
    unchecked(
      launch,
      'On Internal testing, the draft is version code 8 and testers still have version code 7. Version code 9 is not on that page. Production is already published. Do not use Create new release from this dashboard.',
    );
    expect(launch).toContain('The public phone apps are build 8.');
    expect(launch).toContain('Build 9 is not the public binary.');
    expect(app.expo.ios.buildNumber).toBe('9');
    expect(app.expo.android.versionCode).toBe(9);
  });

  it('keeps the maroon buttons and the cook and buyer phone path open', () => {
    const phone = read('docs/PHONE_DIAGNOSTICS.md');
    const membership = read('app/membership.tsx');
    unchecked(phone, 'Signed out: the maroon PlateMaker button opens sign-in. The maroon PlateTaker button opens sign-in.');
    unchecked(phone, 'Signed in, PlateMaker: Get GPS, publish a plate, then Accept, Ready for pickup, check the receipt acknowledgement, and tap Send.');
    unchecked(phone, 'Signed in, PlateTaker: stay inside 20 miles of that kitchen, pay by card, send a message, check the receipt acknowledgement, and tap Send.');
    expect(membership).toContain("router.push('/(auth)/login')");
    expect(membership).toContain("router.replace(isPlateTaker ? '/(tabs)/(home)/home' : '/(tabs)/dashboard')");
    expect(membership).toContain('membership-platemaker-sign-in');
    expect(membership).toContain('membership-platetaker-sign-in');
    expect(read('components/GetGpsCard.tsx')).toContain('Get GPS');
    expect(read('backend/trpc/routes/meals/create/route.ts')).toContain('Get GPS before a plate goes on the menu.');
    expect(read('backend/trpc/routes/messages/send/route.ts')).toContain('protectedProcedure');
    expect(withinPickupRadius(cook, nearby)).toBe(true);
    expect(withinPickupRadius(cook, far)).toBe(false);
    expect(orderCloseout('platemaker', 'accepted')?.label).toBe('Ready for pickup');
    expect(orderCloseout('platetaker', 'ready')?.label).toBe('Send');
    expect(pickupConfirmedByBoth(['buyer', 'seller'])).toBe(true);
    expect(pickupConfirmedByBoth(['buyer'])).toBe(false);
  });

  it('starts Apple and Google for both roles and leaves a finished session unopened', async () => {
    const launch = read('docs/POST_LAUNCH_DIAGNOSTICS.md');
    const login = read('app/(auth)/login.tsx');
    unchecked(launch, 'Turn on Apple sign-in and Google sign-in for a PlateMaker and a PlateTaker, signed in after the provider returns.');
    unchecked(launch, 'Signed out, both buttons are the ones that start that sign-in.');
    expect(login).toContain('accessibilityLabel="Sign in with Apple"');
    expect(login).toContain('accessibilityLabel="Sign in with Google"');
    expect(login).toContain("onPress={() => handleProvider('Apple')}");
    expect(login).toContain("onPress={() => handleProvider('Google')}");
    expect(read('docs/SIGN_IN_OPENS_THE_APP.md')).toContain('A finished Apple or Google session was not opened');
    expect(read('app/index.tsx')).toContain('/(tabs)/dashboard');
    expect(read('app/index.tsx')).toContain('/(tabs)/(home)/home');

    const { url, key } = publicAuth();
    for (const provider of ['apple', 'google'] as const) {
      for (const redirect of ['https://homecookedplate.com/login', 'homecookedplate://login']) {
        const started = await fetch(
          `${url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`,
          { redirect: 'manual', headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        const location = started.headers.get('location') || '';
        expect(started.status).toBe(302);
        expect(new URL(location).host).toBe(provider === 'apple' ? 'appleid.apple.com' : 'accounts.google.com');
      }
    }
  });
});
