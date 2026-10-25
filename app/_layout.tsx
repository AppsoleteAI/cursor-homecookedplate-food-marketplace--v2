/* eslint-disable import/first */
// The "PostHog Ghost" Final Silence
// This kills the fetch attempt to the local PostHog proxy to stop ERR_CONNECTION_REFUSED errors
if (__DEV__) {
  // This kills the fetch attempt to the local PostHog proxy
  const nativeFetch = global.fetch;
  global.fetch = (input, init) => {
    if (typeof input === 'string' && input.includes('127.0.0.1:7242')) {
      return Promise.reject(new Error('PostHog Disabled'));
    }
    return nativeFetch(input, init);
  };
  
  // Also poison the posthog object as a fallback
  const noop = () => {};
  if (typeof global !== 'undefined') {
    (global as any).posthog = { capture: noop, identify: noop, track: noop };
  }
  if (typeof window !== 'undefined') {
    (window as any).posthog = { capture: noop, identify: noop, track: noop };
  }
}

import '@/lib/apply-default-font';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, usePathname, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, NavigationContainer, NavigationIndependentTree, ThemeProvider } from "@react-navigation/native";
import * as SystemUI from "expo-system-ui";
import { Asset } from "expo-asset";
import { AuthProvider } from "@/hooks/auth-context";
import { LaunchCover } from "@/components/launch-cover";
import { CartProvider } from "@/hooks/cart-context";
import { FavoritesProvider } from "@/hooks/favorites-context";
import { NotificationsProvider } from "@/hooks/notifications-context";
import { ReviewsProvider } from "@/hooks/reviews-context";
import { MetroStayWatch } from "@/components/MetroStayWatch";
import { OrdersProvider } from "@/hooks/orders-context";
import { MealsProvider } from "@/hooks/meals-context";
import { AdminsProvider } from "@/hooks/admin-context";
import { trpc, trpcClient } from "@/lib/trpc";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StripeProvider } from '@/lib/stripe';
import { navLogger } from '@/lib/nav-logger';
import { captureException, scrubSentryEvent, Sentry } from '@/lib/sentry';
import { SENTRY_TRACE_SAMPLE_RATE } from '@/lib/sentry-rate';
import { applyScrollbarAccent } from '@/lib/web-scrollbar';
import { applyPageFill } from '@/lib/web-page-fill';
import { ChromeActivity } from '@/components/IdleChrome';
import { pokeChromeActivity } from '@/lib/chrome-activity';

const LAUNCH_BACKGROUND = '#1A0F0A';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (Platform.OS !== 'web') {
  SystemUI.setBackgroundColorAsync(LAUNCH_BACKGROUND).catch(() => undefined);
}

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    debug: __DEV__,
    tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
    environment: process.env.NODE_ENV || 'production',
    sendDefaultPii: false,
    beforeSend(event) {
      scrubSentryEvent(event);
      return event;
    },
  });
}

// Phase 1: Asset preloading will be handled inside RootLayout component
// This allows state management and proper gating

// Core providers needed for auth (mounted immediately)
function CoreProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// App providers (only needed after auth - mounted lazily)
function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <FavoritesProvider>
        <NotificationsProvider>
          <OrdersProvider>
            <MealsProvider>
              <AdminsProvider>
                <ReviewsProvider>
                  <MetroStayWatch />
                  {children}
                </ReviewsProvider>
              </AdminsProvider>
            </MealsProvider>
          </OrdersProvider>
        </NotificationsProvider>
      </FavoritesProvider>
    </CartProvider>
  );
}

// App providers stay mounted for logged-out sessions.
// Screens such as the tab layout call useCart() before sign-in.
function ConditionalAppProviders({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

// Navigation content component using Slot pattern
// Slot renders child routes directly without explicit Screen registrations
// This makes the boot process "straight-line" like web version
function LayoutContent() {
  return <Slot />;
}

const webNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};

const nativeLaunchTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: LAUNCH_BACKGROUND,
    card: LAUNCH_BACKGROUND,
  },
};

function ScrollbarAccent() {
  const path = usePathname();
  useEffect(() => {
    applyScrollbarAccent(path);
    applyPageFill(path);
  }, [path]);
  return null;
}

// Root layout component
function RootLayout() {
  const stripeKey = Platform.OS !== 'web' ? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY : null;
  const shouldWrapStripe = Platform.OS !== 'web' && StripeProvider !== null && stripeKey;
  const isWeb = Platform.OS === 'web';
  
  // Simplified gate system: Only essential gates remain
  // Modern React Native renders fast enough that separate asset/navigation gates are unnecessary
  const rootNavigationState = useRootNavigationState();
  const hasNavigationKey = !!rootNavigationState?.key;
  const [isNativeLayoutReady, setIsNativeLayoutReady] = useState(false);
  const [hasEverHadKey, setHasEverHadKey] = useState(false);
  
  // Combined asset preloading and navigation readiness check
  // Parallelized for faster initialization
  useEffect(() => {
    if (isWeb) return; // Web doesn't need asset preloading
    
    async function prepare() {
      try {
        // Parallelize asset loading (no need to wait for navigation key separately)
        await Promise.all([
          Asset.loadAsync([
            require('@/assets/images/splash-icon.png'),
            require('@/assets/images/icon.png'),
            require('@/assets/images/adaptive-icon.png'),
          ]),
          // Navigation key detection happens automatically via useRootNavigationState
        ]);
        navLogger.stateChange('app/_layout.tsx:ASSETS_PRELOADED', 'assets_ready', undefined, {
          platform: Platform.OS,
        });
      } catch (error) {
        console.warn('[Asset Preload] Failed:', error);
        if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
          captureException(error as Error, { context: 'AssetPreload' });
        }
        // Fail gracefully - allow app to continue even if assets fail
      }
    }
    prepare();
  }, [isWeb]);

  // Log the first navigation key. The spinner does not wait on this flag.
  useEffect(() => {
    if (hasNavigationKey && !hasEverHadKey) {
      setHasEverHadKey(true);
      navLogger.stateChange('app/_layout.tsx:NAV_KEY_DETECTED', 'nav_key_detected', undefined, {
        platform: Platform.OS,
        key: rootNavigationState?.key,
      });
    }
  }, [hasNavigationKey, hasEverHadKey, rootNavigationState?.key]);

  // Layout trigger: fires when native view hierarchy is ready
  // This is the ONLY reliable signal on Fabric/Android that the navigation bridge is ready
  // Simplified: Set immediately when onLayout fires (no InteractionManager delay)
  const onLayoutRootView = useCallback(async () => {
    if (!isNativeLayoutReady && !isWeb) {
      navLogger.stateChange('app/_layout.tsx:LAYOUT_READY', 'native_layout_ready', undefined, {
        platform: Platform.OS,
      });
      setIsNativeLayoutReady(true);
    }
  }, [isNativeLayoutReady, isWeb]);

  // CRITICAL: Platform-split navigation for Rork Lightning Preview compatibility
  // DO NOT REMOVE: Manual NavigationContainer on Web is required for Rork Preview
  // DO NOT REMOVE: The independent: true prop and type cast are intentionally required
  // DO NOT REMOVE: On Native, Expo Router provides NavigationContainer automatically
  
  // Straight-line pattern: Same structure for both web and mobile
  // The only difference is the NavigationContainer wrapper on web
  const content = shouldWrapStripe ? (
    <StripeProvider publishableKey={stripeKey!}>
      <LayoutContent />
    </StripeProvider>
  ) : (
    <LayoutContent />
  );

  // Web: Always render immediately with manual NavigationContainer
  // This makes web boot process straight-line (no gates)
  if (isWeb) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={styles.container} onTouchMove={pokeChromeActivity}>
          <CoreProviders>
            <ConditionalAppProviders>
              <NavigationIndependentTree>
                <NavigationContainer
                  {...({ independent: true } as any)}
                  theme={webNavigationTheme}
                  documentTitle={{ enabled: false }}
                >
                  <View />
                </NavigationContainer>
              </NavigationIndependentTree>
              <ScrollbarAccent />
              <ChromeActivity />
              {content}
            </ConditionalAppProviders>
          </CoreProviders>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.launch} onTouchMove={pokeChromeActivity}>
        <View
          style={styles.launch}
          onLayout={onLayoutRootView}
        >
          <ChromeActivity />
          <CoreProviders>
            <ConditionalAppProviders>
              <ThemeProvider value={nativeLaunchTheme}>
                <LaunchCover layoutReady={isNativeLayoutReady}>
                  {content}
                </LaunchCover>
              </ThemeProvider>
            </ConditionalAppProviders>
          </CoreProviders>
        </View>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  launch: {
    flex: 1,
    backgroundColor: LAUNCH_BACKGROUND,
  },
});

export default process.env.EXPO_PUBLIC_SENTRY_DSN
  ? Sentry.wrap(RootLayout)
  : RootLayout;
