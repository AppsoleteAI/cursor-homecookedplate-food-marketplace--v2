import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { recordOperationalFailure } from '../failure-alert';
import { sentryIdentity } from '@/lib/sentry-user';
import { reportWorkerCrash, scrubCrashText, sentryStoreTarget } from '../worker-sentry';

type AlertRow = Record<string, unknown>;

function alertAdmin(rows: AlertRow[]) {
  return {
    from() {
      return {
        insert: async (row: AlertRow) => {
          rows.push(row);
          return { error: null };
        },
      };
    },
  };
}

describe.each([1, 2, 3])('observability, run %s', () => {
  it('sends the phone crash with the account id only for both roles', () => {
    const orders = readFileSync(resolve(__dirname, '../../../hooks/orders-context.tsx'), 'utf8');
    const layout = readFileSync(resolve(__dirname, '../../../app/_layout.tsx'), 'utf8');
    expect(orders).toContain("context: 'orders refresh'");
    expect(layout).toContain('scrubSentryEvent(event)');
    expect(sentryIdentity({ id: 'cook-account' })).toEqual({ id: 'cook-account' });
    expect(sentryIdentity({ id: 'buyer-account' })).toEqual({ id: 'buyer-account' });
    expect(sentryIdentity(null)).toBeNull();
  });

  it('writes payment, webhook, and security alerts without a secret or an email', async () => {
    const rows: AlertRow[] = [];
    const admin = alertAdmin(rows);
    await recordOperationalFailure('payment_error', 'Payment failed for cook@example.com Bearer raw-token', admin as never);
    await recordOperationalFailure('webhook_error', 'Stripe webhook could not update orders.', admin as never);
    await recordOperationalFailure('security_alert', 'Metro webhook secret was rejected.', admin as never);
    expect(rows.map((row) => row.alert_type)).toEqual(['payment_error', 'webhook_error', 'security_alert']);
    const saved = JSON.stringify(rows);
    expect(saved).toContain('[email]');
    expect(saved).toContain('Bearer [token]');
    expect(saved).not.toContain('cook@example.com');
    expect(saved).not.toContain('raw-token');
    expect(saved).not.toMatch(/sk_live|sk_test|whsec_|acct_/);
  });

  it('sends a Worker crash to Sentry with the account id only', async () => {
    const calls: { url: string; body: string; auth: string }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: String(init?.body ?? ''),
        auth: new Headers(init?.headers).get('X-Sentry-Auth') ?? '',
      });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    expect(await reportWorkerCrash({
      error: new Error('orders refresh failed'),
      dsn: '',
      fetchImpl,
    })).toBe(false);
    expect(calls).toHaveLength(0);
    expect(sentryStoreTarget('not a dsn')).toBeNull();

    for (const role of ['platemaker', 'platetaker'] as const) {
      calls.length = 0;
      const id = role === 'platemaker' ? 'cook-account' : 'buyer-account';
      const sent = await reportWorkerCrash({
        error: new Error(`refresh failed for ${role}@example.com Bearer raw-token`),
        method: 'GET',
        path: '/api/trpc/orders.list',
        userId: id,
        dsn: 'https://public@example.test/123',
        fetchImpl,
      });
      expect(sent).toBe(true);
      expect(calls[0].url).toBe('https://example.test/api/123/store/');
      expect(calls[0].auth).toContain('sentry_key=public');
      const body = JSON.parse(calls[0].body) as {
        user?: { id?: string; email?: string };
        request?: { url?: string; headers?: unknown };
        exception?: { values?: { value?: string }[] };
      };
      expect(body.user).toEqual({ id });
      expect(body.request).toEqual({ url: '/api/trpc/orders.list', method: 'GET' });
      expect(body.exception?.values?.[0].value).toContain('[email]');
      expect(body.exception?.values?.[0].value).toContain('Bearer [token]');
      expect(calls[0].body).not.toContain(`${role}@example.com`);
      expect(calls[0].body).not.toContain('raw-token');
    }

    const thrown = await reportWorkerCrash({
      error: new Error('network'),
      dsn: 'https://public@example.test/123',
      fetchImpl: (async () => {
        throw new Error('sentry down');
      }) as typeof fetch,
    });
    expect(thrown).toBe(false);
    expect(scrubCrashText('cook@example.com')).toBe('[email]');
  });

  it('reports Worker crashes from the API error handler', () => {
    const worker = readFileSync(resolve(__dirname, '../../hono.ts'), 'utf8');
    const payment = readFileSync(resolve(__dirname, '../../trpc/routes/payments/create-payment-intent/route.ts'), 'utf8');
    const connect = readFileSync(resolve(__dirname, '../../trpc/routes/payments/create-connect-account/route.ts'), 'utf8');
    expect(worker).toContain('reportWorkerCrash');
    expect(worker).toContain('c.executionCtx.waitUntil(pending)');
    expect(worker).toContain('workerSentryDsn');
    expect(worker).toContain("recordOperationalFailure('payment_error'");
    expect(worker).toContain("noteFailure(c.env, 'webhook_error'");
    expect(worker).toContain("noteFailure(c.env, 'security_alert'");
    expect(payment).toContain("recordOperationalFailure('payment_error', 'Payment intent creation failed.'");
    expect(connect).toContain("recordOperationalFailure('payment_error', 'Stripe Connect account creation failed.'");
  });
});
