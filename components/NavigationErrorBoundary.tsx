import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassPressable } from '@/components/glass-surface';
import { navLogger } from '@/lib/nav-logger';
import { Sentry } from '@/lib/sentry';

const LAUNCH_BACKGROUND = '#1A0F0A';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

function isNavigationRace(error: Error | null): boolean {
  const message = error?.message ?? '';
  return (
    message.includes('NavigationContent') ||
    message.includes('PreventRemoveContext') ||
    message.includes('prevent remove context')
  );
}

export class NavigationErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Pick<State, 'hasError' | 'error'> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isNavError = isNavigationRace(error);
    if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          isNavigationRaceCondition: isNavError,
        },
        tags: { area: 'navigation' },
      });
    }
    navLogger.error('components/NavigationErrorBoundary.tsx:ERROR_CATCH', error, undefined, {
      retryCount: this.state.retryCount,
      isNavError,
      componentStack: errorInfo.componentStack?.substring(0, 500),
    });
    if (isNavError && this.state.retryCount < 3) {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      const delay = 1000 * (this.state.retryCount + 1);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, delay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleReset = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      if (isNavigationRace(this.state.error) && this.state.retryCount < 3) {
        return <View style={styles.launch} />;
      }
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something Went Wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Text>
          <GlassPressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </GlassPressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  launch: {
    flex: 1,
    backgroundColor: LAUNCH_BACKGROUND,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: LAUNCH_BACKGROUND,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
