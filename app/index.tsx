import React from 'react';
import { Redirect } from 'expo-router';
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

  // Extended Splash: Native splash handles loading state (via ExtendedSplashHandler in _layout.tsx)
  // No need for LoadingSplashScreen - eliminates double-flicker
  // During loading, native splash remains visible until auth hydration completes
  // Allow timeout to break through stuck loading states
  if (isLoading && !hasTimedOut) {
    // Return null - native splash is already showing
    return null;
  }

  // 2. Declarative Redirects: Let React handle the timing
  // Phase 5: Index Redirect Decision - Only renders AFTER Phase 3 (Auth) and Phase 4 (Navigation) are complete
  // The <Redirect /> component is "safe" because it only renders AFTER the RootLayout's appIsReady check has passed
  if (!isAuthenticated) {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', false, undefined, '/(auth)/login');
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Additional check: Ensure session is fully loaded before redirecting
  // This prevents race conditions where isAuthenticated is true but session isn't ready
  if (isAuthenticated && !session && !hasTimedOut) {
    // Wait a bit for session to load
    return null;
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

  // 6. Default Authenticated Route
  if (userRole === 'platemaker') {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platemaker', '/(tabs)/dashboard');
    return <Redirect href="/(tabs)/dashboard" />;
  }

  navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platetaker', '/(tabs)/(home)/home');
  return <Redirect href="/(tabs)/(home)/home" />;
}
