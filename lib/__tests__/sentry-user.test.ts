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
