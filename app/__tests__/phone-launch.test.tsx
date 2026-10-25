import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/hooks/auth-context';
import { LaunchCover, LAUNCH_LAYOUT_GIVE_UP_MS } from '@/components/launch-cover';
import { SESSION_RESTORE_MS } from '@/lib/settle-within';
import Index from '@/app/index';

/**
 * Same first screen the phones mount. layoutReady stays false, which is the
 * native splash holding onLayout back. SecureStore and setSession stand in
 * for the keychain and the network. Each case runs as iOS and as Android.
 */
const mockPhone: {
  readSession: () => Promise<string | null>;
  restoreSession: () => Promise<unknown>;
} = {
  readSession: () => Promise.resolve(null),
  restoreSession: () => new Promise(() => undefined),
};

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

jest.mock('@/lib/expo-secure-store', () => ({
  getItemAsync: () => mockPhone.readSession(),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: () => mockPhone.restoreSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
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
  // The factory is hoisted above the file imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string | { pathname: string } }) =>
      React.createElement(Text, null, `redirect:${typeof href === 'string' ? href : href.pathname}`),
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  };
});

const hideAsync = SplashScreen.hideAsync as jest.Mock;
const getItem = AsyncStorage.getItem as jest.Mock;

function setOs(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

function storedSession() {
  return JSON.stringify({ access_token: 'access', refresh_token: 'refresh' });
}

function restoredSession(id: string) {
  return Promise.resolve({
    data: { session: { access_token: 'access', refresh_token: 'refresh', user: { id } } },
    error: null,
  });
}

function storedUser(user: Record<string, unknown>) {
  getItem.mockResolvedValue(JSON.stringify({ ...user, createdAt: new Date().toISOString() }));
}

function PhoneLaunch() {
  return (
    <AuthProvider>
      <LaunchCover layoutReady={false}>
        <Index />
      </LaunchCover>
    </AuthProvider>
  );
}

async function boot(os: 'ios' | 'android') {
  setOs(os);
  const view = render(<PhoneLaunch />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

describe.each(['ios', 'android'] as const)('phone launch on %s', (os) => {
  beforeEach(() => {
    hideAsync.mockClear();
    getItem.mockReset();
    getItem.mockResolvedValue(null);
    mockPhone.readSession = () => Promise.resolve(null);
    mockPhone.restoreSession = () => new Promise(() => undefined);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a fresh install leaves the splash and opens Welcome', async () => {
    const view = await boot(os);
    expect(view.getByTestId('launch-cover')).toBeTruthy();
    expect(hideAsync).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
    });

    expect(hideAsync).toHaveBeenCalled();
    expect(view.queryByTestId('launch-cover')).toBeNull();
    expect(view.getByText('redirect:/(auth)/welcome')).toBeTruthy();
  });

  it('a saved sign-in that never answers still opens Welcome', async () => {
    mockPhone.readSession = () => Promise.resolve(storedSession());
    const view = await boot(os);
    expect(view.getByTestId('launch-cover')).toBeTruthy();
    expect(hideAsync).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
    });
    expect(hideAsync).toHaveBeenCalled();
    expect(view.getByTestId('launch-cover')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(SESSION_RESTORE_MS);
    });
    expect(view.queryByTestId('launch-cover')).toBeNull();
    expect(view.getByText('redirect:/(auth)/welcome')).toBeTruthy();
  });

  it('a restored PlateMaker opens the dashboard', async () => {
    mockPhone.readSession = () => Promise.resolve(storedSession());
    mockPhone.restoreSession = () => restoredSession('cook');
    storedUser({ id: 'cook', role: 'platemaker', needsMembership: true, metroArea: 'Austin' });
    const view = await boot(os);
    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
    });
    expect(hideAsync).toHaveBeenCalled();
    expect(view.queryByTestId('launch-cover')).toBeNull();
    expect(view.getByText('redirect:/(tabs)/dashboard')).toBeTruthy();
  });

  it('a restored PlateMaker with a plan opens the dashboard', async () => {
    mockPhone.readSession = () => Promise.resolve(storedSession());
    mockPhone.restoreSession = () => restoredSession('cook');
    storedUser({
      id: 'cook',
      role: 'platemaker',
      needsMembership: false,
      membershipTier: 'premium',
      metroArea: 'Austin',
    });
    const view = await boot(os);
    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
    });
    expect(hideAsync).toHaveBeenCalled();
    expect(view.queryByTestId('launch-cover')).toBeNull();
    expect(view.getByText('redirect:/(tabs)/dashboard')).toBeTruthy();
  });

  it('a restored PlateTaker opens home', async () => {
    mockPhone.readSession = () => Promise.resolve(storedSession());
    mockPhone.restoreSession = () => restoredSession('buyer');
    storedUser({ id: 'buyer', role: 'platetaker', needsMembership: true });
    const view = await boot(os);
    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
    });
    expect(hideAsync).toHaveBeenCalled();
    expect(view.queryByTestId('launch-cover')).toBeNull();
    expect(view.getByText('redirect:/(tabs)/(home)/home')).toBeTruthy();
  });
});
