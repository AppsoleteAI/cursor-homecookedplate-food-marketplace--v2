import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { AuthProvider } from '@/hooks/auth-context';
import { LaunchCover, LAUNCH_LAYOUT_GIVE_UP_MS } from '@/components/launch-cover';
import Index from '@/app/index';
import { REVOKED_SESSION_MESSAGE, REVOKED_SESSION_NOTICE_KEY } from '@/backend/lib/sign-in-messages';

/**
 * Cold start after an app update. A live session stays in the account.
 * A previous member whose session is already gone opens Sign in.
 * A phone with no account marker opens the landing.
 */
const mockPhone: {
  memory: Map<string, string>;
  secure: Map<string, string>;
  getSession: () => Promise<{ data: { session: SessionShape | null }; error: null }>;
  setSession: () => Promise<{ data: { session: SessionShape | null }; error: { message: string } | null }>;
  assurance: () => Promise<{ data: { nextLevel: string; currentLevel: string } }>;
} = {
  memory: new Map(),
  secure: new Map(),
  getSession: async () => ({ data: { session: null }, error: null }),
  setSession: async () => ({ data: { session: null }, error: null }),
  assurance: async () => ({ data: { nextLevel: 'aal1', currentLevel: 'aal1' } }),
};

type SessionShape = { access_token: string; refresh_token: string; user: { id: string } };

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/sentry', () => ({
  captureException: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  Sentry: { captureException: jest.fn(), wrap: (component: unknown) => component },
}));

jest.mock('@/lib/hardwareAudit', () => ({
  runHardwareAudit: jest.fn(async () => undefined),
}));

jest.mock('@/lib/expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(mockPhone.secure.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    mockPhone.secure.set(key, value);
    return Promise.resolve();
  },
  deleteItemAsync: (key: string) => {
    mockPhone.secure.delete(key);
    return Promise.resolve();
  },
}));

jest.mock('@/lib/supabase', () => ({
  createMemoryAuthClient: jest.fn(),
  supabase: {
    auth: {
      getSession: () => mockPhone.getSession(),
      setSession: () => mockPhone.setSession(),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      mfa: { getAuthenticatorAssuranceLevel: () => mockPhone.assurance() },
    },
  },
}));

jest.mock('@/lib/trpc', () => {
  const useMutation = () => ({ mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false });
  const auth = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'me') {
        return { useQuery: () => ({ data: undefined, error: null, refetch: jest.fn() }) };
      }
      return { useMutation };
    },
  });
  const Provider = ({ children }: { children: React.ReactNode }) => children;
  return { trpc: { auth, Provider }, trpcClient: {}, trpcProxyClient: {} };
});

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string | { pathname: string } }) =>
      React.createElement(Text, null, `redirect:${typeof href === 'string' ? href : href.pathname}`),
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({}),
  };
});

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const removeItem = AsyncStorage.removeItem as jest.Mock;

const decisions: string[] = [];
const originalLog = console.log;

function setOs(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

function userRecord(role: 'platemaker' | 'platetaker') {
  const id = role === 'platemaker' ? 'cook' : 'buyer';
  return JSON.stringify({
    id,
    role,
    needsMembership: false,
    metroArea: 'Austin',
    createdAt: new Date().toISOString(),
  });
}

function liveSession(role: 'platemaker' | 'platetaker'): SessionShape {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    user: { id: role === 'platemaker' ? 'cook' : 'buyer' },
  };
}

function rememberAccount(role?: 'platemaker' | 'platetaker') {
  mockPhone.memory.set('hcp_has_account', '1');
  if (role) mockPhone.memory.set('hcp_provider_role', role);
}

function UpdateOpen() {
  return (
    <AuthProvider>
      <LaunchCover layoutReady={false}>
        <Index />
      </LaunchCover>
    </AuthProvider>
  );
}

async function openPhone() {
  const view = render(<UpdateOpen />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

function lastDecision() {
  return decisions.filter((line) => line.includes('app/index.tsx:REDIRECT_CHECK')).at(-1) ?? '';
}

function expectEntry(kind: 'authenticated' | 'unauthenticated', route: string) {
  const line = lastDecision();
  expect(line).toContain(`Auth decision: ${kind}`);
  expect(line).toContain(`→ Route: ${route}`);
}

describe.each(['ios', 'android'] as const)('update open on %s', (os) => {
  beforeEach(() => {
    mockPhone.memory.clear();
    mockPhone.secure.clear();
    mockPhone.getSession = async () => ({ data: { session: null }, error: null });
    mockPhone.setSession = async () => ({ data: { session: null }, error: null });
    mockPhone.assurance = async () => ({ data: { nextLevel: 'aal1', currentLevel: 'aal1' } });
    decisions.length = 0;
    console.log = (...args: unknown[]) => {
      decisions.push(args.map((item) => String(item)).join(' '));
      originalLog(...args);
    };
    getItem.mockImplementation(async (key: string) => mockPhone.memory.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      mockPhone.memory.set(key, value);
    });
    removeItem.mockImplementation(async (key: string) => {
      mockPhone.memory.delete(key);
    });
    setOs(os);
    jest.useFakeTimers();
  });

  afterEach(() => {
    console.log = originalLog;
    jest.useRealTimers();
  });

  it('a signed-in PlateMaker stays on the dashboard when a role key is also stored', async () => {
    mockPhone.getSession = async () => ({ data: { session: liveSession('platemaker') }, error: null });
    mockPhone.memory.set('auth_user_v2', userRecord('platemaker'));
    rememberAccount('platemaker');
    await openPhone();
    expectEntry('authenticated', '/(tabs)/dashboard');
  });

  it('a signed-in PlateTaker stays on home when a role key is also stored', async () => {
    mockPhone.getSession = async () => ({ data: { session: liveSession('platetaker') }, error: null });
    mockPhone.memory.set('auth_user_v2', userRecord('platetaker'));
    rememberAccount('platetaker');
    await openPhone();
    expectEntry('authenticated', '/(tabs)/(home)/home');
  });

  it('a PlateMaker keystore session restores the dashboard', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platemaker')));
    mockPhone.setSession = async () => ({ data: { session: liveSession('platemaker') }, error: null });
    mockPhone.memory.set('auth_user_v2', userRecord('platemaker'));
    rememberAccount('platemaker');
    await openPhone();
    expectEntry('authenticated', '/(tabs)/dashboard');
  });

  it('a PlateTaker keystore session restores home', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platetaker')));
    mockPhone.setSession = async () => ({ data: { session: liveSession('platetaker') }, error: null });
    mockPhone.memory.set('auth_user_v2', userRecord('platetaker'));
    rememberAccount('platetaker');
    await openPhone();
    expectEntry('authenticated', '/(tabs)/(home)/home');
  });

  it('a PlateMaker stays signed in when the restore error is not a revoked token', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platemaker')));
    mockPhone.setSession = async () => ({ data: { session: null }, error: { message: 'Network request failed' } });
    mockPhone.memory.set('auth_user_v2', userRecord('platemaker'));
    rememberAccount('platemaker');
    await openPhone();
    expectEntry('authenticated', '/(tabs)/dashboard');
  });

  it('a PlateTaker stays signed in when the restore error is not a revoked token', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platetaker')));
    mockPhone.setSession = async () => ({ data: { session: null }, error: { message: 'Network request failed' } });
    mockPhone.memory.set('auth_user_v2', userRecord('platetaker'));
    rememberAccount('platetaker');
    await openPhone();
    expectEntry('authenticated', '/(tabs)/(home)/home');
  });

  it('a previous member with the account flag and no role opens Sign in', async () => {
    rememberAccount();
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a previous PlateMaker with the account flag and a stored role opens Sign in', async () => {
    rememberAccount('platemaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a previous PlateTaker with the account flag and a stored role opens Sign in', async () => {
    rememberAccount('platetaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a previous PlateMaker whose only leftover is the role key opens limited browsing', async () => {
    mockPhone.memory.set('hcp_provider_role', 'platemaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });

  it('a previous PlateTaker whose only leftover is the role key opens limited browsing', async () => {
    mockPhone.memory.set('hcp_provider_role', 'platetaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });

  it('a previous PlateMaker whose profile is still stored and whose session is gone opens Sign in', async () => {
    mockPhone.memory.set('auth_user_v2', userRecord('platemaker'));
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a previous PlateTaker whose profile is still stored and whose session is gone opens Sign in', async () => {
    mockPhone.memory.set('auth_user_v2', userRecord('platetaker'));
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a revoked PlateMaker token opens Sign in and stores the notice', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platemaker')));
    mockPhone.setSession = async () => ({ data: { session: null }, error: { message: 'refresh token revoked' } });
    mockPhone.memory.set('auth_user_v2', userRecord('platemaker'));
    rememberAccount('platemaker');
    await openPhone();
    expect(mockPhone.memory.get(REVOKED_SESSION_NOTICE_KEY)).toBe(REVOKED_SESSION_MESSAGE);
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a revoked PlateTaker token opens Sign in and stores the notice', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platetaker')));
    mockPhone.setSession = async () => ({ data: { session: null }, error: { message: 'refresh token revoked' } });
    mockPhone.memory.set('auth_user_v2', userRecord('platetaker'));
    rememberAccount('platetaker');
    await openPhone();
    expect(mockPhone.memory.get(REVOKED_SESSION_NOTICE_KEY)).toBe(REVOKED_SESSION_MESSAGE);
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a revoked token with only a PlateMaker role key opens limited browsing', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platemaker')));
    mockPhone.setSession = async () => ({ data: { session: null }, error: { message: 'invalid_grant' } });
    mockPhone.memory.set('hcp_provider_role', 'platemaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });

  it('a revoked token with only a PlateTaker role key opens limited browsing', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platetaker')));
    mockPhone.setSession = async () => ({ data: { session: null }, error: { message: 'invalid_grant' } });
    mockPhone.memory.set('hcp_provider_role', 'platetaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });

  it('an unfinished PlateMaker authenticator opens Sign in', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platemaker')));
    mockPhone.setSession = async () => ({ data: { session: liveSession('platemaker') }, error: null });
    mockPhone.assurance = async () => ({ data: { nextLevel: 'aal2', currentLevel: 'aal1' } });
    mockPhone.memory.set('auth_user_v2', userRecord('platemaker'));
    rememberAccount('platemaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('an unfinished PlateTaker authenticator opens Sign in', async () => {
    mockPhone.secure.set('hcp-auth-session', JSON.stringify(liveSession('platetaker')));
    mockPhone.setSession = async () => ({ data: { session: liveSession('platetaker') }, error: null });
    mockPhone.assurance = async () => ({ data: { nextLevel: 'aal2', currentLevel: 'aal1' } });
    mockPhone.memory.set('auth_user_v2', userRecord('platetaker'));
    rememberAccount('platetaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a PlateMaker who chose limited browsing, with no account, opens limited browsing', async () => {
    mockPhone.memory.set('hcp_guest_role', 'platemaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });

  it('a PlateTaker who chose limited browsing, with no account, opens limited browsing', async () => {
    mockPhone.memory.set('hcp_guest_role', 'platetaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });

  it('a previous PlateMaker with the account flag and a guest role opens Sign in', async () => {
    rememberAccount('platemaker');
    mockPhone.memory.set('hcp_guest_role', 'platemaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a previous PlateTaker with the account flag and a guest role opens Sign in', async () => {
    rememberAccount('platetaker');
    mockPhone.memory.set('hcp_guest_role', 'platetaker');
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/login');
  });

  it('a wiped phone opens the landing', async () => {
    await openPhone();
    expectEntry('unauthenticated', '/(auth)/limited-browsing');
  });
});
