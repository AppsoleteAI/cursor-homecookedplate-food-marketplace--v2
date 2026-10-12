import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { X509Certificate, sign } from 'node:crypto';
import { APPLE_BUNDLE_ID, readActiveAppleSubscription } from '../apple-transaction';

const MONTHLY = 'com.rork.homecookedplate.membership.monthly';

function base64url(value: Buffer | string): string {
  const buffer = typeof value === 'string' ? Buffer.from(value) : value;
  return buffer.toString('base64url');
}

function certChain() {
  const dir = mkdtempSync(join(tmpdir(), 'apple-jws-'));
  const run = (command: string) => execSync(command, { cwd: dir, stdio: 'ignore' });
  run('openssl ecparam -name prime256v1 -genkey -noout -out root.key');
  run('openssl req -new -x509 -key root.key -out root.pem -days 3650 -subj "/CN=Test Root"');
  run('openssl ecparam -name prime256v1 -genkey -noout -out mid.key');
  run('openssl req -new -key mid.key -out mid.csr -subj "/CN=Test Intermediate"');
  run('openssl x509 -req -in mid.csr -CA root.pem -CAkey root.key -CAcreateserial -out mid.pem -days 3650');
  run('openssl ecparam -name prime256v1 -genkey -noout -out leaf.key');
  run('openssl req -new -key leaf.key -out leaf.csr -subj "/CN=Test Leaf"');
  run('openssl x509 -req -in leaf.csr -CA mid.pem -CAkey mid.key -CAcreateserial -out leaf.pem -days 3650');
  const der = (name: string) => new X509Certificate(readFileSync(join(dir, name))).raw.toString('base64');
  return {
    rootPem: readFileSync(join(dir, 'root.pem'), 'utf8'),
    leafKey: readFileSync(join(dir, 'leaf.key'), 'utf8'),
    x5c: [der('leaf.pem'), der('mid.pem')],
  };
}

function signedTransaction(chain: ReturnType<typeof certChain>, payload: Record<string, unknown>) {
  const header = base64url(JSON.stringify({ alg: 'ES256', x5c: chain.x5c }));
  const body = base64url(JSON.stringify(payload));
  const signature = sign('sha256', Buffer.from(`${header}.${body}`), {
    key: chain.leafKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${header}.${body}.${base64url(signature)}`;
}

describe('App Store signed transactions', () => {
  const chain = certChain();
  const activePayload = () => ({
    bundleId: APPLE_BUNDLE_ID,
    productId: MONTHLY,
    transactionId: '1000000000000001',
    originalTransactionId: '1000000000000001',
    expiresDate: Date.now() + 86_400_000,
    environment: 'Sandbox',
  });

  it('accepts a membership signed by the provided root', () => {
    const subscription = readActiveAppleSubscription(
      signedTransaction(chain, activePayload()),
      Date.now(),
      chain.rootPem,
    );
    expect(subscription.productId).toBe(MONTHLY);
    expect(subscription.originalTransactionId).toBe('1000000000000001');
    expect(subscription.environment).toBe('Sandbox');
  });

  it('rejects a changed payload, the wrong app, an unknown product, expiry, and revocation', () => {
    const token = signedTransaction(chain, activePayload());
    const [header, payload, signature] = token.split('.');
    const flippedSignature = `${signature.slice(0, -2)}${signature.endsWith('A') ? 'B' : 'A'}`;
    expect(() => readActiveAppleSubscription(`${header}.${payload}.${flippedSignature}`, Date.now(), chain.rootPem)).toThrow(/signature/i);
    expect(() => readActiveAppleSubscription(
      signedTransaction(chain, { ...activePayload(), bundleId: 'com.other.app' }),
      Date.now(),
      chain.rootPem,
    )).toThrow(/different app/);
    expect(() => readActiveAppleSubscription(
      signedTransaction(chain, { ...activePayload(), productId: 'com.other.product' }),
      Date.now(),
      chain.rootPem,
    )).toThrow(/membership/);
    expect(() => readActiveAppleSubscription(
      signedTransaction(chain, { ...activePayload(), expiresDate: Date.now() - 1000 }),
      Date.now(),
      chain.rootPem,
    )).toThrow(/expired/);
    expect(() => readActiveAppleSubscription(
      signedTransaction(chain, { ...activePayload(), revocationDate: Date.now() }),
      Date.now(),
      chain.rootPem,
    )).toThrow(/revoked/);
  });
});
