import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sameSecret } from '../same-secret';

describe('constant-time secret compare', () => {
  it('matches equal secrets and refuses a different byte', () => {
    expect(sameSecret('abc123', 'abc123')).toBe(true);
    expect(sameSecret('abc123', 'abc124')).toBe(false);
    expect(sameSecret('abc123', 'abc1234')).toBe(false);
    expect(sameSecret('', 'x')).toBe(false);
  });

  it('the Stripe signature and the metro secret use that compare', () => {
    const worker = readFileSync(resolve(__dirname, '../../hono.ts'), 'utf8');
    expect(worker).toContain('sameSecret(computedSignature, signature)');
    expect(worker).toContain('sameSecret(providedSecret, metroWebhookSecret)');
    expect(worker).not.toContain('computedSignature !== signature');
    expect(worker).not.toContain('providedSecret !== metroWebhookSecret');
  });
});
