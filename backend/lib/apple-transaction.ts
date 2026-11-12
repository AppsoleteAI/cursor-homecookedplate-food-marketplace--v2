import { X509Certificate, verify as verifySignature } from 'node:crypto';
import { APPLE_ROOT_CA_G3_PEM } from './apple-root-ca';
import { APPLE_MEMBERSHIP_PRODUCT_IDS, type AppleMembershipProductId } from './membership-products';

export { APPLE_MEMBERSHIP_PRODUCT_IDS, type AppleMembershipProductId };

export const APPLE_BUNDLE_ID = 'app.rork.homecookedplate-dynamic-gradient-food-marketplace-v1-1';

export interface AppleSubscription {
  bundleId: string;
  productId: AppleMembershipProductId;
  transactionId: string;
  originalTransactionId: string;
  expiresDate: number;
  environment: string | null;
}

function decodeBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function certificateFromX5c(part: string): X509Certificate {
  const body = part.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return new X509Certificate(Buffer.from(body, 'base64'));
}

function assertCurrent(cert: X509Certificate, now: Date) {
  const from = new Date(cert.validFrom);
  const to = new Date(cert.validTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || now < from || now > to) {
    throw new Error('Certificate is outside its validity period');
  }
}

function leafSignedByRoot(x5c: unknown, rootPem: string, now: Date): X509Certificate {
  if (!Array.isArray(x5c) || x5c.length === 0 || x5c.some((part) => typeof part !== 'string')) {
    throw new Error('Signed transaction is missing its certificate chain');
  }
  const certs = x5c.map((part) => certificateFromX5c(part));
  const root = new X509Certificate(rootPem);
  for (const cert of certs) assertCurrent(cert, now);
  assertCurrent(root, now);
  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].verify(certs[i + 1].publicKey)) {
      throw new Error('Certificate chain signature is invalid');
    }
  }
  const anchor = certs[certs.length - 1];
  const anchoredToApple = anchor.fingerprint256 === root.fingerprint256 || anchor.verify(root.publicKey);
  if (!anchoredToApple) {
    throw new Error('Certificate chain is not signed by Apple');
  }
  return certs[0];
}

export interface AppleTransactionClaims extends AppleSubscription {
  revoked: boolean;
  expired: boolean;
}

export interface AppleServerNotification {
  notificationType: string;
  subtype: string | null;
  transaction: AppleTransactionClaims | null;
  autoRenews: boolean | null;
}

export function readAppleJwsPayload(
  jws: string,
  now = Date.now(),
  rootPem = APPLE_ROOT_CA_G3_PEM,
): Record<string, unknown> {
  const parts = jws.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error('Signed transaction is not a JWS');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header: { alg?: unknown; x5c?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8'));
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8'));
  } catch {
    throw new Error('Signed transaction could not be read');
  }
  if (header.alg !== 'ES256') {
    throw new Error('Signed transaction uses an unexpected algorithm');
  }
  const leaf = leafSignedByRoot(header.x5c, rootPem, new Date(now));
  const signatureOk = verifySignature(
    'sha256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' },
    decodeBase64Url(encodedSignature),
  );
  if (!signatureOk) {
    throw new Error('Signed transaction signature is invalid');
  }
  return payload;
}

function membershipClaims(payload: Record<string, unknown>, now: number): AppleTransactionClaims {
  if (payload.bundleId !== APPLE_BUNDLE_ID) {
    throw new Error('Signed transaction is for a different app');
  }
  if (typeof payload.productId !== 'string' || !APPLE_MEMBERSHIP_PRODUCT_IDS.includes(payload.productId as AppleMembershipProductId)) {
    throw new Error('Signed transaction is not a HomeCookedPlate membership');
  }
  if (typeof payload.expiresDate !== 'number') {
    throw new Error('Subscription is expired');
  }
  if (typeof payload.transactionId !== 'string' || typeof payload.originalTransactionId !== 'string') {
    throw new Error('Signed transaction is missing its transaction id');
  }
  const revoked = payload.revocationDate != null;
  return {
    bundleId: payload.bundleId,
    productId: payload.productId as AppleMembershipProductId,
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId,
    expiresDate: payload.expiresDate,
    environment: typeof payload.environment === 'string' ? payload.environment : null,
    revoked,
    expired: payload.expiresDate <= now,
  };
}

export function readAppleTransactionClaims(
  jws: string,
  now = Date.now(),
  rootPem = APPLE_ROOT_CA_G3_PEM,
): AppleTransactionClaims {
  return membershipClaims(readAppleJwsPayload(jws, now, rootPem), now);
}

export function readActiveAppleSubscription(
  jws: string,
  now = Date.now(),
  rootPem = APPLE_ROOT_CA_G3_PEM,
): AppleSubscription {
  const claims = readAppleTransactionClaims(jws, now, rootPem);
  if (claims.revoked) {
    throw new Error('Subscription was revoked');
  }
  if (claims.expired) {
    throw new Error('Subscription is expired');
  }
  return {
    bundleId: claims.bundleId,
    productId: claims.productId,
    transactionId: claims.transactionId,
    originalTransactionId: claims.originalTransactionId,
    expiresDate: claims.expiresDate,
    environment: claims.environment,
  };
}

export function readAppleServerNotification(
  jws: string,
  now = Date.now(),
  rootPem = APPLE_ROOT_CA_G3_PEM,
): AppleServerNotification {
  const payload = readAppleJwsPayload(jws, now, rootPem);
  if (typeof payload.notificationType !== 'string' || payload.notificationType.length === 0) {
    throw new Error('App Store notification could not be read');
  }
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const signedTransactionInfo = typeof data.signedTransactionInfo === 'string' ? data.signedTransactionInfo : '';
  const signedRenewalInfo = typeof data.signedRenewalInfo === 'string' ? data.signedRenewalInfo : '';
  const transaction = signedTransactionInfo ? readAppleTransactionClaims(signedTransactionInfo, now, rootPem) : null;
  let autoRenews: boolean | null = null;
  if (signedRenewalInfo) {
    const renewal = readAppleJwsPayload(signedRenewalInfo, now, rootPem);
    if (renewal.autoRenewStatus === 0 || renewal.autoRenewStatus === false) autoRenews = false;
    if (renewal.autoRenewStatus === 1 || renewal.autoRenewStatus === true) autoRenews = true;
  }
  return {
    notificationType: payload.notificationType,
    subtype: typeof payload.subtype === 'string' ? payload.subtype : null,
    transaction,
    autoRenews,
  };
}
