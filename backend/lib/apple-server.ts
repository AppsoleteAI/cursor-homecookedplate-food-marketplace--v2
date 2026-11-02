import { sign } from 'node:crypto';
import { APPLE_BUNDLE_ID, APPLE_MEMBERSHIP_PRODUCT_IDS, readAppleJwsPayload, type AppleMembershipProductId } from './apple-transaction';

export interface AppleApiCredentials {
  keyId?: string;
  issuerId?: string;
  privateKey?: string;
}

export interface AppleRenewalStatus {
  configured: boolean;
  entitled: boolean;
  renewing: boolean;
  revoked: boolean;
  expiresAt: string | null;
}

const PRODUCTION = 'https://api.storekit.itunes.apple.com';
const SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

function normalizeKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function configured(credentials: AppleApiCredentials): credentials is { keyId: string; issuerId: string; privateKey: string } {
  return Boolean(credentials.keyId && credentials.issuerId && credentials.privateKey?.includes('PRIVATE KEY'));
}

function appStoreJwt(credentials: { keyId: string; issuerId: string; privateKey: string }, now: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: credentials.keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.issuerId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 600,
    aud: 'appstoreconnect-v1',
    bid: APPLE_BUNDLE_ID,
  })).toString('base64url');
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: normalizeKey(credentials.privateKey),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function renewalFromBody(body: unknown, now: number): AppleRenewalStatus {
  const groups = body && typeof body === 'object' && 'data' in body && Array.isArray(body.data) ? body.data : [];
  let best: { expiresAt: number; entitled: boolean; renewing: boolean; revoked: boolean } | null = null;
  for (const group of groups) {
    if (!group || typeof group !== 'object' || !('lastTransactions' in group) || !Array.isArray(group.lastTransactions)) continue;
    for (const row of group.lastTransactions) {
      if (!row || typeof row !== 'object') continue;
      const signedTransactionInfo = 'signedTransactionInfo' in row && typeof row.signedTransactionInfo === 'string'
        ? row.signedTransactionInfo
        : '';
      if (!signedTransactionInfo) continue;
      const transaction = readAppleJwsPayload(signedTransactionInfo, now);
      const productId = transaction.productId;
      if (typeof productId !== 'string' || !APPLE_MEMBERSHIP_PRODUCT_IDS.includes(productId as AppleMembershipProductId)) continue;
      const expiresAt = typeof transaction.expiresDate === 'number' ? transaction.expiresDate : 0;
      const revoked = transaction.revocationDate != null || row.status === 5;
      const status = typeof row.status === 'number' ? row.status : 0;
      let renewing = false;
      const signedRenewalInfo = 'signedRenewalInfo' in row && typeof row.signedRenewalInfo === 'string'
        ? row.signedRenewalInfo
        : '';
      if (signedRenewalInfo) {
        const renewal = readAppleJwsPayload(signedRenewalInfo, now);
        renewing = renewal.autoRenewStatus === 1 || renewal.autoRenewStatus === true;
      }
      const entitled = !revoked && expiresAt > now && (status === 1 || status === 3 || status === 4);
      if (!best || expiresAt >= best.expiresAt) {
        best = { expiresAt, entitled, renewing: entitled && renewing, revoked };
      }
    }
  }
  if (!best) {
    return { configured: true, entitled: false, renewing: false, revoked: false, expiresAt: null };
  }
  return {
    configured: true,
    entitled: best.entitled,
    renewing: best.renewing,
    revoked: best.revoked,
    expiresAt: best.expiresAt > 0 ? new Date(best.expiresAt).toISOString() : null,
  };
}

export async function readAppleRenewalStatus(
  originalTransactionId: string,
  credentials: AppleApiCredentials,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<AppleRenewalStatus> {
  if (!configured(credentials)) {
    return { configured: false, entitled: false, renewing: false, revoked: false, expiresAt: null };
  }
  const token = appStoreJwt(credentials, now);
  const load = async (host: string) => fetchImpl(
    `${host}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  let response = await load(PRODUCTION);
  if (response.status === 404) response = await load(SANDBOX);
  if (response.status === 404) {
    return { configured: true, entitled: false, renewing: false, revoked: false, expiresAt: null };
  }
  if (!response.ok) {
    throw new Error('The App Store subscription could not be checked.');
  }
  return renewalFromBody(await response.json(), now);
}
