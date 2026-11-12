import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scrubSentryEvent, sentryIdentity } from '../sentry-user';

describe('Sentry identity', () => {
  it('sends the user id only', () => {
    expect(sentryIdentity({ id: 'user-1', email: 'a@b.co', username: 'ada' } as { id: string })).toEqual({ id: 'user-1' });
    expect(sentryIdentity(null)).toBeNull();
  });

  it('strips email, username, and request headers from an event', () => {
    const event = {
      user: { id: 'user-1', email: 'a@b.co', username: 'ada', ip_address: '1.2.3.4' },
      request: { url: 'https://example.test/checkout', method: 'POST', headers: { Authorization: 'secret' }, cookies: 'sid' },
      extra: { context: 'login', email: 'a@b.co', userId: 'user-1' },
      breadcrumbs: [{ message: 'signed in', data: { userId: 'user-1', email: 'a@b.co' } }],
    };
    scrubSentryEvent(event);

    expect(event.user).toEqual({ id: 'user-1' });
    expect(event.request).toEqual({ url: 'https://example.test/checkout', method: 'POST' });
    expect(event.extra).toEqual({ context: 'login', userId: 'user-1' });
    expect(event.breadcrumbs?.[0].data).toEqual({ userId: 'user-1' });
  });

  it('records source maps on production build 10 and leaves builds 8 and 9 unsymbolicated', () => {
    const note = readFileSync(resolve(__dirname, '../../docs/SENTRY_SETUP.md'), 'utf8');
    const app = JSON.parse(readFileSync(resolve(__dirname, '../../app.json'), 'utf8')) as {
      expo: { plugins: unknown[] };
    };
    const metro = readFileSync(resolve(__dirname, '../../metro.config.js'), 'utf8');
    const plugin = app.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === '@sentry/react-native/expo') as [string, { organization: string; project: string }];
    expect(plugin[1].organization).toBe('appsolete-ai');
    expect(plugin[1].project).toBe('homecookedplate');
    expect(metro).toContain('getSentryExpoConfig');
    expect(note).toContain('Builds 8 and 9 cannot be symbolicated.');
    expect(note).toContain('6e2dbe8f-d1a6-4c0c-88d6-08063cbeb514');
    expect(note).toContain('1d281df6-22ca-44e4-a051-288f2763e985');
    expect(note).toContain('A PlateMaker crash and a PlateTaker crash on those binaries stay without a source file.');
    expect(note).toContain('Signed out, both roles share that binary');
  });

  it('keeps the account id on an orders refresh failure for both roles', () => {
    const orders = readFileSync(resolve(__dirname, '../../hooks/orders-context.tsx'), 'utf8');
    const layout = readFileSync(resolve(__dirname, '../../app/_layout.tsx'), 'utf8');
    expect(orders).toContain("context: 'orders refresh'");
    expect(layout).toContain('sendDefaultPii: false');
    expect(layout).toContain('scrubSentryEvent(event)');

    for (const role of ['platemaker', 'platetaker'] as const) {
      const id = role === 'platemaker' ? 'cook-account' : 'buyer-account';
      const event = {
        user: { id, email: `${role}@example.com`, username: role, ip_address: '203.0.113.9' },
        extra: { context: 'orders refresh', userId: id, role, email: `${role}@example.com` },
      };
      scrubSentryEvent(event);
      expect(event.user).toEqual({ id });
      expect(event.extra).toEqual({ context: 'orders refresh', userId: id, role });
      expect(event.user).not.toHaveProperty('email');
      expect(event.user).not.toHaveProperty('ip_address');
    }
  });
});
