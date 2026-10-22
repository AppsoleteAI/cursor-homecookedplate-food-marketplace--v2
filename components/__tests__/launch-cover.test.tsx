import React from 'react';
import { Platform, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/auth-context';
import { LaunchCover, LAUNCH_AUTH_GIVE_UP_MS, LAUNCH_LAYOUT_GIVE_UP_MS } from '@/components/launch-cover';

jest.mock('@/hooks/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));

const useAuthMock = useAuth as jest.Mock;
const hideAsync = SplashScreen.hideAsync as jest.Mock;

function setOs(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

/**
 * Gate that shipped on iOS 1.0.0 (4) and Android version code 3.
 * It has no clock. A missed layout or a sign-in that never returns keeps the splash up.
 */
function installedStoreCoverStaysUp(layoutReady: boolean, authIsLoading: boolean): boolean {
  return !layoutReady || authIsLoading;
}

/**
 * Gate in the last commit, which is iOS build 3 in app.json.
 * The splash hides only when auth has finished and the navigation key exists.
 */
function committedBuild3HidesSplash(authIsLoading: boolean, hasNavigationKey: boolean): boolean {
  return !authIsLoading && hasNavigationKey;
}

describe('launch cover', () => {
  beforeEach(() => {
    hideAsync.mockClear();
    useAuthMock.mockReturnValue({ isLoading: true });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('the installed store builds never leave a stuck launch', () => {
    expect(installedStoreCoverStaysUp(false, true)).toBe(true);
    jest.advanceTimersByTime(60_000);
    expect(installedStoreCoverStaysUp(false, true)).toBe(true);
    expect(committedBuild3HidesSplash(true, false)).toBe(false);
    jest.advanceTimersByTime(60_000);
    expect(committedBuild3HidesSplash(true, false)).toBe(false);
  });

  it.each(['ios', 'android'] as const)(
    'on %s, a layout that never fires and a sign-in that never returns still opens',
    (os) => {
      setOs(os);
      const view = render(
        <LaunchCover layoutReady={false}>
          <Text>welcome</Text>
        </LaunchCover>,
      );

      expect(view.getByTestId('launch-cover')).toBeTruthy();
      expect(hideAsync).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(LAUNCH_LAYOUT_GIVE_UP_MS);
      });
      expect(hideAsync).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('launch-cover')).toBeTruthy();
      expect(view.getByText('welcome')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(LAUNCH_AUTH_GIVE_UP_MS - LAUNCH_LAYOUT_GIVE_UP_MS);
      });
      expect(view.queryByTestId('launch-cover')).toBeNull();
      expect(view.getByText('welcome')).toBeTruthy();
    },
  );
});
