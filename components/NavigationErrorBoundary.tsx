import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { navLogger } from '@/lib/nav-logger';

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
  maxRetries?: number;
  retryDelay?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  shouldRetry: boolean;
}

export class NavigationErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;
  
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isNavError = error.message?.includes('NavigationContent') || 
                       error.message?.includes('PreventRemoveContext') ||
                       error.message?.includes('prevent remove context');

    // 1. Log to Sentry with context (Issue #8)
    if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: { ...errorInfo, isNavigationRaceCondition: isNavError },
        tags: { area: 'navigation' },
      });
    }

    // 2. Use navLogger instead of hypothesis fetch calls (Issue #4, #5)
    navLogger.error('components/NavigationErrorBoundary.tsx:ERROR_CATCH', error, undefined, {
      retryCount: this.state.retryCount,
      isNavError,
      componentStack: errorInfo.componentStack?.substring(0, 500),
    });

    if (this.props.onError) {
      this.props.onError(error);
    }

    // 3. Auto-retry logic for race conditions (Issue #1 mitigation)
    if (isNavError && this.state.retryCount < (this.props.maxRetries || 3)) {
      const delay = 1000 * (this.state.retryCount + 1); // Exponential backoff
      this.retryTimeout = setTimeout(() => {
        this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
      }, delay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 20, textAlign: 'center', fontSize: 16 }}>
            {this.state.retryCount < 3 
              ? "Finalizing navigation setup..." 
              : "Something went wrong while loading the menu."}
          </Text>
          
          {this.state.retryCount >= 3 && (
            <TouchableOpacity 
              onPress={() => this.setState({ hasError: false, retryCount: 0 })}
              style={{ marginTop: 20, padding: 12, backgroundColor: '#007AFF', borderRadius: 8 }}
            >
              <Text style={{ color: '#fff' }}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

