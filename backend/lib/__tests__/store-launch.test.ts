import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withinPickupRadius } from '../pickup-radius';
import { pickupConfirmedByBoth } from '../order-status';
import { applePayMerchantName, profilePayeeName } from '../payee-name';
import { orderCloseout } from '@/lib/order-closeout';
import { scrubSentryEvent, sentryIdentity } from '@/lib/sentry-user';

const root = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

function unchecked(note: string, line: string) {
  expect(note).toContain(`- [ ] ${line}`);
  expect(note).not.toContain(`- [x] ${line}`);
}

describe.each([1, 2, 3, 4, 5])('store launch still open, pass %s', () => {
  it('leaves one live order unproven and leaves the webhook secret alone', () => {
    const note = read('docs/POST_LAUNCH_DIAGNOSTICS.md');
    const phone = read('docs/PHONE_DIAGNOSTICS.md');
    const stripe = read('docs/STRIPE_LIVE_WEBHOOK.md');
    const handler = read('backend/hono.ts');
    const accept = read('backend/trpc/routes/platemaker/accept-order/route.ts');
    const create = read('backend/trpc/routes/orders/create/route.ts');
    const gate = read('backend/trpc/create-context.ts');

    expect(note).toContain('A full launch of both stores is not ready.');
    expect(note).not.toContain('Pay one live card on two phones.');
    expect(stripe).not.toContain('On one phone, a signed-in PlateTaker pays');
    unchecked(
      phone,
      'Pay one live card on two phones. On one phone, a PlateTaker pays for a plate. On the other, that plate’s PlateMaker accepts the paid order. Then Event deliveries shows `payment_intent.succeeded` with 200. Leave the webhook secret as it is.',
    );
    unchecked(
      phone,
      'On one phone, a PlateTaker pays for a plate with a live card. On the other phone, that plate’s PlateMaker accepts the paid order. On Event deliveries, `payment_intent.succeeded` shows 200. Leave the webhook secret as it is.',
    );
    expect(phone).toContain('A live plate payment on this account is not confirmed.');
    expect(phone).toContain('Signed out, neither role can pay or accept.');
    expect(phone).toContain('Leave the webhook secret as it is.');
    expect(stripe).toContain('Do not change the Worker secret `STRIPE_WEBHOOK_SECRET`');
    expect(stripe).not.toMatch(/whsec_/);

    expect(handler).toContain("event.type === 'payment_intent.succeeded'");
    expect(handler).toContain('return c.json({ received: true })');
    expect(handler).toContain('c.env?.STRIPE_WEBHOOK_SECRET');
    expect(handler).not.toMatch(/whsec_|sk_live_/);
    expect(accept).toContain('protectedProcedure');
    expect(create).toContain('protectedProcedure');
    expect(gate).toContain('if (!ctx.userId)');
    expect(gate).toContain("code: 'UNAUTHORIZED'");
  });

  it('keeps the public phone apps on build 8', () => {
    const note = read('docs/POST_LAUNCH_DIAGNOSTICS.md');
    const app = JSON.parse(read('app.json')) as {
      expo: { ios: { buildNumber: string }; android: { versionCode: number } };
    };
    const agreement = read('app/kitchen-permit.tsx');
    const license = read('lib/legal-agreement.ts');
    const sheet = read('app/privacy-security.tsx');
    const providers = read('docs/SIGN_IN_OPENS_THE_APP.md');

    expect(note).toContain('The public phone apps are build 8.');
    expect(note).toContain('Build 9 is not the public binary.');
    expect(note).toContain('Build 8 has no home-kitchen agreement screen.');
    expect(note).toContain('A signed-in PlateMaker saves that agreement on the website.');
    expect(note).toContain('A signed-in PlateTaker on build 8 can order a plate after that save.');
    expect(note).toContain('Signed out, both roles use the public site.');
    expect(note).toContain('Apple sign-in and Google sign-in are in neither build 8 nor build 9.');
    expect(app.expo.ios.buildNumber).toBe('9');
    expect(app.expo.android.versionCode).toBe(9);
    expect(agreement.length).toBeGreaterThan(0);
    expect(license).toContain('apple_eula');
    expect(profilePayeeName({ business_name: 'Ada Kitchen', username: 'ada' })).toBe('Ada Kitchen');
    expect(applePayMerchantName(['Ada Kitchen'])).toBe('Ada Kitchen');
    expect(sheet).toContain('openStoreSubscriptions');
    expect(providers).toContain('Build 8 and build 9 do not include this call.');
  });

  it('leaves the phone pass unchecked while the shared closeout rule stays checked', () => {
    const note = read('docs/POST_LAUNCH_DIAGNOSTICS.md');
    const phone = read('docs/PHONE_DIAGNOSTICS.md');
    const membership = read('app/membership.tsx');
    const cook = { lat: 40.440624, lng: -79.995888 };
    const nearby = { lat: 40.5, lng: -80.0 };
    const far = { lat: 25.7617, lng: -80.1918 };

    unchecked(phone, 'Signed out: the maroon PlateMaker button opens sign-in. The maroon PlateTaker button opens sign-in.');
    unchecked(phone, 'Signed in, PlateMaker: Get GPS, publish a plate, then Accept, Ready for pickup, check the receipt acknowledgement, and tap Send.');
    unchecked(phone, 'Signed in, PlateTaker: stay inside 20 miles of that kitchen, pay by card, send a message, check the receipt acknowledgement, and tap Send.');
    unchecked(phone, 'Prove Sentry on a phone. Install a preview or store build. Sign in as a PlateMaker, turn on airplane mode, and refresh orders. The new Sentry issue shows an account id. Email, username, and IP are empty. Repeat signed in as a PlateTaker.');
    unchecked(phone, 'Install a preview or store build, sign in as a PlateMaker, turn on airplane mode, and refresh orders. The new Sentry issue shows an account id. Email, username, and IP are empty.');
    unchecked(phone, 'Repeat signed in as a PlateTaker.');
    unchecked(phone, 'On the later Android build, test Membership and plate checkout for a PlateMaker and a PlateTaker.');
    unchecked(phone, 'On Android, test the hardware back button and check for console errors.');
    unchecked(phone, 'On iOS, test swipe-to-dismiss and the iOS animations, and check for console errors.');
    expect(note).not.toContain('Signed out: the maroon PlateMaker button opens sign-in.');
    expect(note).toContain('- [x] The order completes only after both people confirm.');

    expect(membership).toContain("router.push('/(auth)/login')");
    expect(membership).toContain("router.replace(isPlateTaker ? '/(tabs)/(home)/home' : '/(tabs)/dashboard')");
    expect(withinPickupRadius(cook, nearby)).toBe(true);
    expect(withinPickupRadius(cook, far)).toBe(false);
    expect(orderCloseout('platemaker', 'accepted')?.label).toBe('Ready for pickup');
    expect(orderCloseout('platetaker', 'ready')?.label).toBe('Send');
    expect(pickupConfirmedByBoth(['seller'])).toBe(false);
    expect(pickupConfirmedByBoth(['buyer'])).toBe(false);
    expect(pickupConfirmedByBoth(['buyer', 'seller'])).toBe(true);

    for (const account of [
      { id: 'cook-account', email: 'cook@example.com', username: 'cook' },
      { id: 'buyer-account', email: 'buyer@example.com', username: 'buyer' },
    ]) {
      expect(sentryIdentity(account)).toEqual({ id: account.id });
      const event = {
        user: { id: account.id, email: account.email, username: account.username, ip_address: '203.0.113.8' },
        extra: { email: account.email, username: account.username, userId: account.id },
      };
      scrubSentryEvent(event);
      expect(event.user).toEqual({ id: account.id });
      expect(event.user).not.toHaveProperty('email');
      expect(event.user).not.toHaveProperty('username');
      expect(event.user).not.toHaveProperty('ip_address');
      expect(event.extra).toEqual({ userId: account.id });
    }
  });
});
