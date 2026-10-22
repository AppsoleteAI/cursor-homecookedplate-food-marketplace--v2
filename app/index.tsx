import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { userNeedsMembership } from '@/backend/lib/trial-access';
import { useAuth } from '@/hooks/auth-context';
import { navLogger } from '@/lib/nav-logger';

export default function Index() {
  const { isAuthenticated, isLoading, user, session } = useAuth();
  const [hasTimedOut, setHasTimedOut] = React.useState(false);

  // Log entry point for debugging (Issue #4: Code Clarity)
  if (__DEV__) {
    console.log('[INDEX_GATE]', { isLoading, isAuthenticated, hasSession: !!session });
  }

  // Timeout fallback for stuck loading states (10 seconds)
  React.useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('[INDEX_GATE] Auth loading timeout - forcing render');
        setHasTimedOut(true);
      }, 10000);
      return () => clearTimeout(timeout);
    } else {
      setHasTimedOut(false);
    }
  }, [isLoading]);

  // The native splash stays up while this is true. A null view here is the
  // white frame after that splash drops, on the signed-out gate and on both
  // signed-in roles. The fill matches the splash.
  if (isLoading && !hasTimedOut) {
    if (Platform.OS === 'web') return null;
    return <View style={styles.launch} />;
  }

  // 2. Declarative Redirects: Let React handle the timing
  // Phase 5: Index Redirect Decision - Only renders AFTER Phase 3 (Auth) and Phase 4 (Navigation) are complete
  // The <Redirect /> component is "safe" because it only renders AFTER the RootLayout's appIsReady check has passed
  if (!isAuthenticated) {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', false, undefined, '/(auth)/welcome');
    return <Redirect href={{ pathname: '/(auth)/welcome', params: { entry: 'gate' } }} />;
  }

  // 4. Null check for user before accessing role
  if (!user) {
    navLogger.error('app/index.tsx:NULL_USER', 'User is null but isAuthenticated is true', undefined, {
      isAuthenticated,
      hasSession: !!session,
    });
    return <Redirect href="/(auth)/login" />;
  }

  // 5. Role-based routing for authenticated users
  const userRole = user.role;
  if (!userRole || (userRole !== 'platemaker' && userRole !== 'platetaker')) {
    navLogger.error('app/index.tsx:INVALID_ROLE', `Invalid user role: ${userRole}`, undefined, {
      userRole,
    });
    // Default handling: redirect to home as fallback
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  if (userNeedsMembership(user)) {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platemaker', '/membership');
    return <Redirect href="/membership" />;
  }

  // 6. Default Authenticated Route
  if (userRole === 'platemaker') {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platemaker', '/(tabs)/dashboard');
    return <Redirect href="/(tabs)/dashboard" />;
  }

  navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platetaker', '/(tabs)/(home)/home');
  return <Redirect href="/(tabs)/(home)/home" />;
}

const styles = StyleSheet.create({
  launch: {
    flex: 1,
    backgroundColor: '#1A0F0A',
  },
});
