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
});
