import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationErrorBoundary } from '@/components/NavigationErrorBoundary';
import { navLogger } from '@/lib/nav-logger';
import { Sentry } from '@/lib/sentry';

jest.mock('@/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));

jest.mock('@/lib/nav-logger', () => ({
  navLogger: { error: jest.fn() },
}));

jest.mock('@/components/glass-surface');

const captureException = Sentry.captureException as jest.Mock;
const navError = navLogger.error as jest.Mock;

function Race(): React.ReactElement {
  throw new Error('PreventRemoveContext');
}

function OtherFailure(): React.ReactElement {
  throw new Error('The plate list failed');
}

/**
 * The root wrap is the same component for a PlateMaker and a PlateTaker,
 * signed out and signed in, on web, iOS, and Android.
 */
describe('NavigationErrorBoundary', () => {
  beforeEach(() => {
    captureException.mockClear();
    navError.mockClear();
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'present';
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    (console.error as jest.Mock).mockRestore();
  });

  it('retries a navigation race three times, then shows Try Again, and reports each catch to Sentry', () => {
    const view = render(
      <NavigationErrorBoundary>
        <Race />
      </NavigationErrorBoundary>
    );

    expect(view.queryByText('Something Went Wrong')).toBeNull();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1].tags).toEqual({ area: 'navigation' });
    expect(captureException.mock.calls[0][1].extra.isNavigationRaceCondition).toBe(true);
    expect(navError).toHaveBeenCalledWith(
      'components/NavigationErrorBoundary.tsx:ERROR_CATCH',
      expect.any(Error),
      undefined,
      expect.objectContaining({ isNavError: true, retryCount: 0 })
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(captureException).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(captureException).toHaveBeenCalledTimes(3);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(captureException).toHaveBeenCalledTimes(4);
    expect(view.getByText('Something Went Wrong')).toBeTruthy();
    expect(view.getByText('Try Again')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(captureException).toHaveBeenCalledTimes(4);
  });

  it('shows the failure immediately when the error is not a navigation race', () => {
    const view = render(
      <NavigationErrorBoundary>
        <OtherFailure />
      </NavigationErrorBoundary>
    );

    expect(view.getByText('Something Went Wrong')).toBeTruthy();
    expect(view.getByText('The plate list failed')).toBeTruthy();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1].extra.isNavigationRaceCondition).toBe(false);
    expect(navError.mock.calls[0][3]).toEqual(expect.objectContaining({ isNavError: false }));

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('Try Again mounts the screen again after the race is gone', () => {
    let fail = true;
    function Recover() {
      if (fail) throw new Error('PreventRemoveContext');
      return <Text>kitchen is open</Text>;
    }

    const view = render(
      <NavigationErrorBoundary>
        <Recover />
      </NavigationErrorBoundary>
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(view.getByText('Try Again')).toBeTruthy();

    fail = false;
    fireEvent.press(view.getByText('Try Again'));
    expect(view.getByText('kitchen is open')).toBeTruthy();
  });
});
