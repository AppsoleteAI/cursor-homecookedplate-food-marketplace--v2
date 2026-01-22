import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { captureException } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // #region agent log - ERROR BOUNDARY: Track error caught
    console.log('[DEBUG] ErrorBoundary caught error', JSON.stringify({location:'components/ErrorBoundary.tsx:GET_DERIVED_STATE',message:'ErrorBoundary caught error',data:{errorMessage:error.message,errorName:error.name,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'}));
    try {
      const { Platform } = require('react-native');
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
      fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/ErrorBoundary.tsx:GET_DERIVED_STATE',message:'ErrorBoundary caught error',data:{errorMessage:error.message,errorName:error.name,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'})}).catch(()=>{});
    } catch(e) {}
    // #endregion
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // #region agent log - ERROR BOUNDARY: Track error details
    console.log('[DEBUG] ErrorBoundary componentDidCatch', JSON.stringify({location:'components/ErrorBoundary.tsx:COMPONENT_DID_CATCH',message:'ErrorBoundary componentDidCatch',data:{errorMessage:error.message,errorName:error.name,componentStack:errorInfo.componentStack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'}));
    try {
      const { Platform } = require('react-native');
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
      fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/ErrorBoundary.tsx:COMPONENT_DID_CATCH',message:'ErrorBoundary componentDidCatch',data:{errorMessage:error.message,errorName:error.name,componentStack:errorInfo.componentStack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'})}).catch(()=>{});
    } catch(e) {}
    // #endregion
    captureException(error, {
      context: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  message: {
    fontSize: 16,
    color: '#666',
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
