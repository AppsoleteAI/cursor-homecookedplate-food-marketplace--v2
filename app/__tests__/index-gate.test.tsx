import React from 'react';
import { act, render } from '@testing-library/react-native';
import { useAuth } from '@/hooks/auth-context';
import Index from '@/app/index';

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

  it('a sign-in that never finishes still reaches welcome', () => {
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
    expect(view.getByText('redirect:/(auth)/welcome')).toBeTruthy();
  });

  it('a signed-out PlateMaker or PlateTaker reaches welcome', () => {
    signedOut();
    const view = render(<Index />);
    expect(view.getByText('redirect:/(auth)/welcome')).toBeTruthy();
  });

  it('a PlateMaker who needs a plan reaches membership', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      session: { user: { id: 'cook' } },
      user: { id: 'cook', role: 'platemaker', needsMembership: true, metroArea: 'Austin' },
    });
    const view = render(<Index />);
    expect(view.getByText('redirect:/membership')).toBeTruthy();
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
