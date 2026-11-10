import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(__dirname, '../../..');

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

describe.each([1, 2, 3])('key names, run %s', () => {
  it('names the Worker bindings mail and push already read', () => {
    const hono = read('backend/hono.ts');
    for (const name of ['RESEND_API_KEY', 'OFFICIAL_EMAIL_FROM', 'EXPO_PUBLIC_WEB_URL', 'EXPO_ACCESS_TOKEN']) {
      expect(hono).toContain(`${name}?: string`);
    }
    expect(hono).toContain('applyWorkerEnv(env)');
  });

  it('accepts the Resend secret only under its Worker name', () => {
    const email = read('backend/lib/email.ts');
    expect(email).toContain('process.env.RESEND_API_KEY');
    expect(email.includes('EXPO_PUBLIC_RESEND_API_KEY')).toBe(false);
  });

  it('lists example names without the old service-role name', () => {
    const appExample = read('.env.example');
    const apiExample = read('backend/.env.example');
    expect(appExample).toContain('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=');
    expect(appExample.split('\n').some((line) => line.includes('SUPABASE_SERVICE_KEY='))).toBe(false);
    for (const name of [
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'RESEND_API_KEY',
      'OFFICIAL_EMAIL_FROM',
      'METRO_WEBHOOK_SECRET',
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
      'ASC_API_KEY_ID',
      'ASC_API_ISSUER_ID',
      'ASC_API_PRIVATE_KEY',
      'EXPO_ACCESS_TOKEN',
      'SENTRY_DSN',
      'EXPO_PUBLIC_WEB_URL',
    ]) {
      expect(apiExample).toContain(name);
    }
    expect(apiExample.includes('sk_live_')).toBe(false);
    expect(apiExample.includes('whsec_')).toBe(false);
  });

  it('keeps the API on the Pages host and names the anon key on the deploy list', () => {
    expect(read('lib/trpc.ts')).toContain("const API_BASE_URL = 'https://homecookedplate.com'");
    const deploy = read('docs/CLOUDFLARE_DEPLOYMENT.md');
    expect(deploy).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    const staging = read('wrangler.worker.toml');
    expect(staging).toContain('ENVIRONMENT = "staging"');
    expect(staging).toContain('EXPO_PUBLIC_WEB_URL = "https://homecookedplate.com"');
  });

  it('leaves the store and Pages jobs off, and does not call the unused price helper', () => {
    expect(read('.github/workflows/store-release.yml')).toContain('if: false');
    expect(read('.github/workflows/deploy-pages.yml')).toContain('if: false');
    const callers = sourceFiles(root).filter((file) => readFileSync(file, 'utf8').includes('getStripePriceId('));
    expect(callers).toEqual([]);
    const invoked = sourceFiles(root).filter((file) => readFileSync(file, 'utf8').includes('functions.invoke'));
    expect(invoked).toEqual([]);
  });
});
