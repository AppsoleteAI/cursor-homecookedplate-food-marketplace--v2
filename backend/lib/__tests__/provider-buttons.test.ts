import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { providerAccountBlock } from '../provider-account';

/**
 * Review-account columns already used by the diagnostic suite.
 * The public profile list returns no rows, so these runs do not read, write, or delete live accounts.
 */
const PLATE_MAKER_ID = '11111111-1111-4111-8111-111111111111';
const PLATE_TAKER_ID = '22222222-2222-4222-8222-222222222222';
const confirmed = '2026-11-02T18:00:00.000Z';

const RETURNS = [
  'https://homecookedplate.com/login',
  'homecookedplate://login',
] as const;

function publicAuth(): { url: string; key: string } {
  const file = readFileSync(resolve(__dirname, '../../../.env'), 'utf8');
  const read = (name: string) => {
    const line = file.split('\n').find((entry) => entry.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  };
  const url = read('EXPO_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const key = read('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('The public Supabase URL and anon key are missing.');
  return { url, key };
}

describe.each([1, 2, 3])('Apple and Google sign-in buttons, run %s', () => {
  it('opens the kitchen for a PlateMaker and home for a PlateTaker after the provider returns', () => {
    const accounts = [
      { id: PLATE_MAKER_ID, role: 'platemaker' as const, next: '/(tabs)/dashboard' },
      { id: PLATE_TAKER_ID, role: 'platetaker' as const, next: '/(tabs)/(home)/home' },
    ];
    const index = readFileSync(resolve(__dirname, '../../../app/index.tsx'), 'utf8');
    for (const account of accounts) {
      expect(providerAccountBlock({
        role: account.role,
        is_paused: false,
        ordering_removed: false,
        email_confirmed_at: confirmed,
      })).toBeNull();
      expect(index).toContain(account.next);
    }
    expect(providerAccountBlock({ role: 'platemaker', email_confirmed_at: null })).toMatch(/Confirm your email/);
    expect(providerAccountBlock({ role: 'platetaker', is_paused: true, email_confirmed_at: confirmed })).toMatch(/paused/);
  });

  it('wires both buttons to the provider call', () => {
    const login = readFileSync(resolve(__dirname, '../../../app/(auth)/login.tsx'), 'utf8');
    expect(login.includes('not available yet')).toBe(false);
    expect(login).toContain('accessibilityLabel="Sign in with Apple"');
    expect(login).toContain('accessibilityLabel="Sign in with Google"');
    expect(login).toContain("onPress={() => handleProvider('Apple')}");
    expect(login).toContain("onPress={() => handleProvider('Google')}");
    expect(login).toContain("loginWithProvider(provider === 'Apple' ? 'apple' : 'google')");
  });

  it('starts Apple and Google for the website and the phone', async () => {
    const { url, key } = publicAuth();
    const settings = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await settings.json() as { external?: { apple?: boolean; google?: boolean } };
    expect(settings.ok).toBe(true);
    expect(body.external?.apple).toBe(true);
    expect(body.external?.google).toBe(true);

    for (const provider of ['apple', 'google'] as const) {
      for (const redirect of RETURNS) {
        const target = `${url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`;
        const started = await fetch(target, {
          redirect: 'manual',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        const location = started.headers.get('location') || '';
        expect(started.status).toBe(302);
        expect(new URL(location).host).toBe(provider === 'apple' ? 'appleid.apple.com' : 'accounts.google.com');
      }
    }
  });
});
