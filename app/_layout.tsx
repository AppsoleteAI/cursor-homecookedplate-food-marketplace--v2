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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Platform, View, ActivityIndicator, InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { AuthProvider } from "@/hooks/auth-context";
import { CartProvider } from "@/hooks/cart-context";
import { FavoritesProvider } from "@/hooks/favorites-context";
import { NotificationsProvider } from "@/hooks/notifications-context";
import { ReviewsProvider } from "@/hooks/reviews-context";
import { OrdersProvider } from "@/hooks/orders-context";
import { MealsProvider } from "@/hooks/meals-context";
import { AdminsProvider } from "@/hooks/admin-context";
import { trpc, trpcClient } from "@/lib/trpc";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StripeProvider } from '@/lib/stripe';
import { navLogger } from '@/lib/nav-logger';
import { captureException, Sentry } from '@/lib/sentry';

SplashScreen.preventAutoHideAsync();

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    debug: __DEV__,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'production',
  });
}

// Phase 1: Asset preloading will be handled inside RootLayout component
// This allows state management and proper gating

// Providers component that wraps all context providers
function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <NotificationsProvider>
                <OrdersProvider>
                  <MealsProvider>
                    <AdminsProvider>
                      <ReviewsProvider>
                        {children}
                      </ReviewsProvider>
                    </AdminsProvider>
                  </MealsProvider>
                </OrdersProvider>
              </NotificationsProvider>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Navigation content component using Slot pattern
// Slot renders child routes directly without explicit Screen registrations
// This makes the boot process "straight-line" like web version
function LayoutContent() {
  return <Slot />;
}

// Root layout component
function RootLayout() {
  const stripeKey = Platform.OS !== 'web' ? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY : null;
  const shouldWrapStripe = Platform.OS !== 'web' && StripeProvider !== null && stripeKey;
  const isWeb = Platform.OS === 'web';
  
  // Phase 1: Asset preloading state
  // Prevents white flash, missing icons, and silent first trigger for audio assets
  const [isAssetsReady, setIsAssetsReady] = useState(isWeb); // Web doesn't need asset preloading
  
  // Stability Triangle: Gate Providers behind native layout readiness
  // This ensures AuthProvider (Phase 3) only starts after Navigation (Phase 4) is ready
  // Prevents PreventRemoveContext crash by eliminating race condition
  const rootNavigationState = useRootNavigationState();
  const hasNavigationKey = !!rootNavigationState?.key;
  const [isNativeLayoutReady, setIsNativeLayoutReady] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [hasEverHadKey, setHasEverHadKey] = useState(false);

  // Phase 1: Preload critical assets before layout mounts (mobile only)
  useEffect(() => {
    if (isWeb) return; // Web doesn't need asset preloading
    
    async function prepare() {
      try {
        // Preload critical assets (splash icon, app icon, adaptive icon)
        await Asset.loadAsync([
          require('@/assets/images/splash-icon.png'),
          require('@/assets/images/icon.png'),
          require('@/assets/images/adaptive-icon.png'),
        ]);
        navLogger.stateChange('app/_layout.tsx:ASSETS_PRELOADED', 'assets_ready', undefined, {
          platform: Platform.OS,
        });
        setIsAssetsReady(true);
      } catch (error) {
        console.warn('[Asset Preload] Failed:', error);
        if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
          captureException(error as Error, { context: 'AssetPreload' });
        }
        // Fail gracefully - allow app to continue even if assets fail
        setIsAssetsReady(true);
      }
    }
    prepare();
  }, [isWeb]);

  // Track if we've ever seen a navigation key (prevents Fast Refresh from breaking the lock)
  useEffect(() => {
    if (hasNavigationKey && !hasEverHadKey) {
      setHasEverHadKey(true);
      navLogger.stateChange('app/_layout.tsx:NAV_KEY_DETECTED', 'nav_key_detected', undefined, {
        platform: Platform.OS,
        key: rootNavigationState?.key,
      });
    }
  }, [hasNavigationKey, hasEverHadKey, rootNavigationState?.key]);

  // Diagnostic: Log lock state changes for debugging
  useEffect(() => {
    if (!isWeb) {
      navLogger.stateChange('app/_layout.tsx:TRIPLE_LOCK_STATUS', 'lock_status_check', undefined, {
        platform: Platform.OS,
        isAssetsReady,
        hasNavigationKey,
        hasEverHadKey,
        isNativeLayoutReady,
        isNavigationReady,
        allLocksGreen: isAssetsReady && hasEverHadKey && isNativeLayoutReady && isNavigationReady,
      });
    }
  }, [isAssetsReady, hasNavigationKey, hasEverHadKey, isNativeLayoutReady, isNavigationReady, isWeb]);

  // Hardware-Aware Synchronization: Wait for navigation state to be ready
  // CRITICAL: Wait for BOTH hasNavigationKey AND isNativeLayoutReady (Double-Lock)
  // InteractionManager ensures the Double-Lock only opens once the native bridge has finished
  // all layout calculations and animations, respecting actual hardware speed
  useEffect(() => {
    // Only trigger if both physical locks are green
    if (hasNavigationKey && isNativeLayoutReady && !isNavigationReady && !isWeb) {
      const task = InteractionManager.runAfterInteractions(() => {
        // Re-verify key hasn't been lost during the interaction
        if (!!rootNavigationState?.key || hasEverHadKey) {
          navLogger.stateChange('app/_layout.tsx:NAV_STATE_READY', 'nav_state_ready', undefined, {
            platform: Platform.OS,
            hasKey: !!rootNavigationState?.key,
            hasEverHadKey,
            source: 'interaction_manager',
          });
          setIsNavigationReady(true);
        } else {
          navLogger.warn('app/_layout.tsx:NAV_STATE_READY', 'Key disappeared during interaction wait, retrying...', undefined, {
            platform: Platform.OS,
          });
        }
      });

      return () => task.cancel(); // Critical: cleanup if component unmounts
    }
  }, [hasNavigationKey, isNativeLayoutReady, isNavigationReady, isWeb, rootNavigationState?.key, hasEverHadKey]);

  // Layout trigger: fires when native view hierarchy is ready
  // This is the ONLY reliable signal on Fabric/Android that the navigation bridge is ready
  // Phase 4: Hardware Sync - Native bridge confirms screen dimensions and context are ready
  const onLayoutRootView = useCallback(async () => {
    if (!isNativeLayoutReady && !isWeb) {
      navLogger.stateChange('app/_layout.tsx:LAYOUT_READY', 'native_layout_ready', undefined, {
        platform: Platform.OS,
      });
      setIsNativeLayoutReady(true);
    }
  }, [isNativeLayoutReady, isWeb]);

  // Hide splash screen only after ALL conditions are met: assets ready, navigation ready, layout ready
  useEffect(() => {
    if (!isWeb && isAssetsReady && isNavigationReady && isNativeLayoutReady) {
      SplashScreen.hideAsync().catch((error) => {
        if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
          Sentry.captureException(error);
        }
      });
    }
  }, [isWeb, isAssetsReady, isNavigationReady, isNativeLayoutReady]);

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
        <GestureHandlerRootView style={styles.container}>
          <Providers>
            <NavigationContainer {...({ independent: true } as any)}>
              {content}
            </NavigationContainer>
          </Providers>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Native: Straight-line boot process (like web)
  // Triple-Lock system: Assets + Navigation + Layout must all be ready
  // This prevents PreventRemoveContext crash while maintaining straight-line flow
  // Also prevents white flash and missing icons by ensuring assets are preloaded
  if (!isAssetsReady || !isNavigationReady || !isNativeLayoutReady || (!hasEverHadKey && !isWeb)) {
    // Log which lock is blocking for better debugging
    if (__DEV__) {
      console.log('[Stability Gate] Blocked:', {
        isAssetsReady,
        isNavigationReady,
        isNativeLayoutReady,
        hasEverHadKey,
        platform: Platform.OS,
      });
    }
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // Native: Straight-line render after all locks pass
  // Same structure as web - just wrapped in onLayout for native bridge sync
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <View 
          style={{ flex: 1 }} 
          onLayout={onLayoutRootView}
        >
          <Providers>
            {content}
          </Providers>
        </View>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default process.env.EXPO_PUBLIC_SENTRY_DSN
  ? Sentry.wrap(RootLayout)
  : RootLayout;
