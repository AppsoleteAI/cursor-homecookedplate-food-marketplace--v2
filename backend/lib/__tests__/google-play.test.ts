import { generateKeyPairSync } from 'node:crypto';
import { GOOGLE_PLAY_PACKAGE, readActiveGoogleSubscription } from '../google-play';

const MONTHLY = 'com.rork.homecookedplate.membership.monthly';
const TOKEN = 'purchase-token-value-1234567890';
const USER = '11111111-1111-1111-1111-111111111111';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccountJson = JSON.stringify({
  client_email: 'play@test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
});

function purchase(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Play Billing subscriptions', () => {
  const now = Date.parse('2026-10-10T00:00:00.000Z');

  function harness(options?: {
    state?: string;
    productId?: string;
    expiryTime?: string;
    accountId?: string;
    acknowledgementState?: string;
    ackStatus?: number;
    ackBody?: string;
    getStatus?: number;
  }) {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('oauth2.googleapis.com')) {
        return purchase({ access_token: 'ya29.test' });
      }
      if (url.endsWith(':acknowledge')) {
        return new Response(options?.ackBody ?? '{}', { status: options?.ackStatus ?? 200 });
      }
      if ((options?.getStatus ?? 200) !== 200) {
        return purchase({ error: 'missing' }, options?.getStatus);
      }
      return purchase({
        subscriptionState: options?.state ?? 'SUBSCRIPTION_STATE_ACTIVE',
        acknowledgementState: options?.acknowledgementState ?? 'ACKNOWLEDGEMENT_STATE_PENDING',
        latestOrderId: 'GPA.1234',
        lineItems: [{
          productId: options?.productId ?? MONTHLY,
          expiryTime: options?.expiryTime ?? '2027-01-01T00:00:00.000Z',
        }],
        externalAccountIdentifiers: options?.accountId === undefined
          ? { obfuscatedExternalAccountId: USER }
          : options.accountId
            ? { obfuscatedExternalAccountId: options.accountId }
            : undefined,
      });
    }) as typeof fetch;

    return {
      calls,
      read: () => readActiveGoogleSubscription(TOKEN, {
        serviceAccountJson,
        userId: USER,
        fetchImpl,
        now,
      }),
    };
  }

  it('verifies an active membership and acknowledges it', async () => {
    const { calls, read } = harness();
    const subscription = await read();
    expect(subscription.productId).toBe(MONTHLY);
    expect(subscription.packageName).toBe(GOOGLE_PLAY_PACKAGE);
    expect(subscription.expiresAt).toBe('2027-01-01T00:00:00.000Z');
    expect(calls.some((call) => call.startsWith('GET ') && call.includes(`/applications/${GOOGLE_PLAY_PACKAGE}/`))).toBe(true);
    expect(calls.some((call) => call.startsWith('POST ') && call.endsWith(':acknowledge'))).toBe(true);
  });

  it('skips acknowledge when Play already recorded it', async () => {
    const { calls, read } = harness({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' });
    await read();
    expect(calls.some((call) => call.includes(':acknowledge'))).toBe(false);
  });

  it('rejects a purchase linked to another account', async () => {
    const { read } = harness({ accountId: 'someone-else' });
    await expect(read()).rejects.toThrow(/different account/);
  });

  it('rejects an expired or unrelated subscription', async () => {
    const expired = harness({ expiryTime: '2020-01-01T00:00:00.000Z' });
    await expect(expired.read()).rejects.toThrow(/expired/);
    const other = harness({ productId: 'com.example.other' });
    await expect(other.read()).rejects.toThrow(/HomeCookedPlate membership/);
    const held = harness({ state: 'SUBSCRIPTION_STATE_ON_HOLD' });
    await expect(held.read()).rejects.toThrow(/not active/);
  });

  it('rejects a Play response that cannot be read', async () => {
    const { read } = harness({ getStatus: 404 });
    await expect(read()).rejects.toThrow(/could not be verified/);
  });

  it('refuses to call Play when the service account is missing', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    await expect(readActiveGoogleSubscription(TOKEN, {
      serviceAccountJson: '{}',
      userId: USER,
      fetchImpl,
      now,
    })).rejects.toThrow(/not configured/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
