import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // #region agent log - HYPOTHESIS B, E: Track index.tsx render and auth state
  React.useEffect(() => {
      const logData = {location:'app/index.tsx:RENDER',message:'Index component rendered',data:{isLoading,isAuthenticated,hasUser:!!user,userRole:user?.role},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'B,E'};
      console.log('[DEBUG]', JSON.stringify(logData));
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
    fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  }, [isLoading, isAuthenticated, user]);
  // #endregion

  // 1. Wait for Auth to initialize
  if (isLoading) {
    // #region agent log - HYPOTHESIS E: Auth still loading
    React.useEffect(() => {
      const logData = {location:'app/index.tsx:LOADING',message:'Showing loading state',data:{isLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'E'};
      console.log('[DEBUG]', JSON.stringify(logData));
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
      fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }, []);
    // #endregion
    return (
      <View style={styles.container}>
        <View style={styles.loader} testID="index-loading">
          <ActivityIndicator color={Colors.gray[400]} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // 2. Declarative Redirects (Native-Safe)
  if (!isAuthenticated) {
    // #region agent log - HYPOTHESIS B: Redirecting to login from index
    React.useEffect(() => {
      const logData = {location:'app/index.tsx:REDIRECT_LOGIN',message:'Redirecting to login (not authenticated)',data:{isAuthenticated},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'B'};
      console.log('[DEBUG]', JSON.stringify(logData));
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
      fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }, []);
    // #endregion
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Role-based routing for authenticated users
  if (user?.role === 'platemaker') {
    // #region agent log - HYPOTHESIS B: Redirecting to dashboard
    React.useEffect(() => {
      const logData = {location:'app/index.tsx:REDIRECT_DASHBOARD',message:'Redirecting to dashboard (platemaker)',data:{userRole:user?.role},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'B'};
      console.log('[DEBUG]', JSON.stringify(logData));
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
      fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }, []);
    // #endregion
    return <Redirect href="/(tabs)/dashboard" />;
  }

  // #region agent log - HYPOTHESIS B: Redirecting to home
  React.useEffect(() => {
    const logData = {location:'app/index.tsx:REDIRECT_HOME',message:'Redirecting to home (platetaker)',data:{userRole:user?.role},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'B'};
    console.log('[DEBUG]', JSON.stringify(logData));
    const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
    fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  }, []);
  // #endregion
  return <Redirect href="/(tabs)/(home)/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 16,
  },
});
