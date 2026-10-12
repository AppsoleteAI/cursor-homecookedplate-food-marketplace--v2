import { createSign } from 'node:crypto';

export const GOOGLE_PLAY_PACKAGE = 'com.rork.homecookedplate';

export const GOOGLE_MEMBERSHIP_PRODUCT_IDS = [
  'com.rork.homecookedplate.membership.monthly',
  'com.rork.homecookedplate.membership.annual',
] as const;

export type GoogleMembershipProductId = (typeof GOOGLE_MEMBERSHIP_PRODUCT_IDS)[number];

export interface GoogleSubscription {
  packageName: string;
  productId: GoogleMembershipProductId;
  purchaseToken: string;
  expiresAt: string;
  orderId: string | null;
}

const ENTITLED_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

function base64url(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value) : value;
  return buffer.toString('base64url');
}

function parseAccount(raw: string): { client_email: string; private_key: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Play Billing verification is not configured.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Play Billing verification is not configured.');
  }
  const email = 'client_email' in parsed ? parsed.client_email : undefined;
  const key = 'private_key' in parsed ? parsed.private_key : undefined;
  if (typeof email !== 'string' || typeof key !== 'string' || !key.includes('PRIVATE KEY')) {
    throw new Error('Play Billing verification is not configured.');
  }
  return { client_email: email, private_key: key };
}

async function accessToken(
  account: { client_email: string; private_key: string },
  fetchImpl: typeof fetch,
  now: number,
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key).toString('base64url')}`;
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`,
  });
  if (!response.ok) {
    throw new Error('Play subscription could not be verified.');
  }
  const body = await response.json() as { access_token?: unknown };
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw new Error('Play subscription could not be verified.');
  }
  return body.access_token;
}

function entitledLine(payload: Record<string, unknown>, now: number): { productId: GoogleMembershipProductId; expiresAt: string } {
  const state = payload.subscriptionState;
  if (typeof state !== 'string' || !ENTITLED_STATES.has(state)) {
    throw new Error('Subscription is not active');
  }
  const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];
  let matched = false;
  for (const item of lineItems) {
    if (!item || typeof item !== 'object') continue;
    const productId = 'productId' in item ? item.productId : undefined;
    const expiryTime = 'expiryTime' in item ? item.expiryTime : undefined;
    if (typeof productId !== 'string' || !GOOGLE_MEMBERSHIP_PRODUCT_IDS.includes(productId as GoogleMembershipProductId)) {
      continue;
    }
    matched = true;
    if (typeof expiryTime !== 'string') continue;
    const expiresAt = Date.parse(expiryTime);
    if (Number.isNaN(expiresAt) || expiresAt <= now) continue;
    return { productId: productId as GoogleMembershipProductId, expiresAt: new Date(expiresAt).toISOString() };
  }
  throw new Error(matched ? 'Subscription is expired' : 'Subscription is not a HomeCookedPlate membership');
}

export async function readActiveGoogleSubscription(
  purchaseToken: string,
  options: {
    serviceAccountJson: string;
    userId: string;
    fetchImpl?: typeof fetch;
    now?: number;
  },
): Promise<GoogleSubscription> {
  const token = purchaseToken.trim();
  if (token.length < 20) {
    throw new Error('Play subscription could not be verified.');
  }
  const account = parseAccount(options.serviceAccountJson);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const bearer = await accessToken(account, fetchImpl, now);
  const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
  const response = await fetchImpl(endpoint, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  if (!response.ok) {
    throw new Error('Play subscription could not be verified.');
  }
  const payload = await response.json() as Record<string, unknown>;
  const line = entitledLine(payload, now);
  const linked = payload.externalAccountIdentifiers;
  if (linked && typeof linked === 'object' && 'obfuscatedExternalAccountId' in linked) {
    const accountId = linked.obfuscatedExternalAccountId;
    if (typeof accountId === 'string' && accountId.length > 0 && accountId !== options.userId) {
      throw new Error('This Play purchase belongs to a different account.');
    }
  }
  const acknowledgement = payload.acknowledgementState;
  if (acknowledgement !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    const ack = await fetchImpl(`${endpoint}:acknowledge`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    if (!ack.ok) {
      const text = await ack.text();
      if (!/already acknowledged/i.test(text)) {
        throw new Error('Play subscription could not be verified.');
      }
    }
  }
  const orderId = typeof payload.latestOrderId === 'string' ? payload.latestOrderId : null;
  return {
    packageName: GOOGLE_PLAY_PACKAGE,
    productId: line.productId,
    purchaseToken: token,
    expiresAt: line.expiresAt,
    orderId,
  };
}
