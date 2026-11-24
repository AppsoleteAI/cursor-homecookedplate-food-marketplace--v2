import React from 'react';
import { act, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/auth-context';
import Index from '@/app/index';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/hooks/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-router', () => {
  // The factory is hoisted above the file imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string | { pathname: string } }) =>
      React.createElement(Text, null, `redirect:${typeof href === 'string' ? href : href.pathname}`),
  };
});

const useAuthMock = useAuth as jest.Mock;

function signedOut() {
  useAuthMock.mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    session: null,
  });
}

describe('index gate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a slow restore stays off welcome until the session arrives', () => {
    useAuthMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      session: null,
    });
    const view = render(<Index />);
    expect(view.queryByText(/redirect:/)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(view.queryByText(/redirect:/)).toBeNull();

    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      session: { user: { id: 'cook' } },
      user: { id: 'cook', role: 'platemaker', needsMembership: true, metroArea: 'Austin' },
    });
    view.rerender(<Index />);
    expect(view.getByText('redirect:/(tabs)/dashboard')).toBeTruthy();

    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      session: { user: { id: 'buyer' } },
      user: { id: 'buyer', role: 'platetaker', needsMembership: true },
    });
    view.rerender(<Index />);
    expect(view.getByText('redirect:/(tabs)/(home)/home')).toBeTruthy();
  });

  it('a signed-out person with no role reaches the image landing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    signedOut();
    const view = render(<Index />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.getByText('redirect:/(auth)/limited-browsing')).toBeTruthy();
  });

  it('a signed-out PlateTaker who already chose a role reaches home', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('platetaker');
    signedOut();
    const view = render(<Index />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.getByText('redirect:/(tabs)/(home)/home')).toBeTruthy();
  });

  it('a signed-out PlateMaker who already chose a role reaches home', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('platemaker');
    signedOut();
    const view = render(<Index />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.getByText('redirect:/(tabs)/(home)/home')).toBeTruthy();
  });

  it('a signed-in PlateMaker reaches the dashboard', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      session: { user: { id: 'cook' } },
      user: { id: 'cook', role: 'platemaker', needsMembership: true, metroArea: 'Austin' },
    });
    const view = render(<Index />);
    expect(view.getByText('redirect:/(tabs)/dashboard')).toBeTruthy();
  });

  it('a PlateMaker with a plan reaches the dashboard', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      session: { user: { id: 'cook' } },
      user: {
        id: 'cook',
        role: 'platemaker',
        needsMembership: false,
        membershipTier: 'premium',
        metroArea: 'Austin',
      },
    });
    const view = render(<Index />);
    expect(view.getByText('redirect:/(tabs)/dashboard')).toBeTruthy();
  });

  it('a PlateTaker reaches home', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      session: { user: { id: 'buyer' } },
      user: { id: 'buyer', role: 'platetaker', needsMembership: true },
    });
    const view = render(<Index />);
    expect(view.getByText('redirect:/(tabs)/(home)/home')).toBeTruthy();
  });
});
