import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { AuthProvider, useAuth } from "@/hooks/auth-context";
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

// #region agent log - EARLY INIT: Track if _layout.tsx module loads
console.log('[DEBUG] app/_layout.tsx MODULE LOADED', JSON.stringify({location:'app/_layout.tsx:MODULE_LOAD',message:'_layout.tsx module loaded',timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'}));
try {
  const { Platform } = require('react-native');
  const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
  fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/_layout.tsx:MODULE_LOAD',message:'_layout.tsx module loaded',timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'})}).catch(()=>{});
} catch(e) {}
// #endregion

SplashScreen.preventAutoHideAsync();

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    debug: __DEV__,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'production',
  });
}



/**
 * Session verification component that handles navigation based on auth state
 * 
 * NOTE: Currently disabled - navigation logic is handled in app/index.tsx instead
 * to avoid navigation context errors. This component uses useRouter() and useSegments()
 * which require navigation context that may not be ready when rendered at layout level.
 * 
 * The error "Couldn't find the prevent remove context" comes from NativeStackView
 * (used by Expo Router's Stack), which requires a NavigationContainer. On native,
 * Expo Router should automatically provide this, but NavigationGuard was trying to
 * use navigation hooks before the context was ready.
 */
function NavigationGuard() {
  // Disabled - navigation logic moved to app/index.tsx to avoid navigation context errors
  return null;
}

function RootLayoutNav() {
  // Stack must be rendered first to create NavigationContainer context
  // NavigationGuard will be rendered inside a screen component to access navigation hooks
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }}
      />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="meal/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="reviews/[mealId]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="notifications-bell" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="active-orders" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="order/[id]" options={{ title: "Order" }} />
        <Stack.Screen name="checkout" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="filter" options={{ headerShown: false }} />
        <Stack.Screen name="legal" options={{ title: "Legal & Safety" }} />
        <Stack.Screen name="edit-profile" options={{ title: "Edit Profile" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="privacy-security" options={{ title: "Privacy & Security" }} />
        <Stack.Screen name="help-support" options={{ title: "Help & Support" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="finance/today" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="finance/periods" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="finance/earnings" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="reviews-dashboard" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="promotions" options={{ title: "Promotions" }} />
        <Stack.Screen name="messages" options={{ title: "Messages" }} />
        <Stack.Screen name="funnel" options={{ headerShown: false }} />
        <Stack.Screen name="admin-metro-caps" options={{ title: "Metro Cap Management" }} />
    </Stack>
  );
}

function RootLayout() {
  // #region agent log - ROOT LAYOUT INIT: Track RootLayout component initialization
  console.log('[DEBUG] RootLayout component initializing', JSON.stringify({location:'app/_layout.tsx:ROOT_LAYOUT_INIT',message:'RootLayout component initializing',timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'}));
  try {
    const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
    fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/_layout.tsx:ROOT_LAYOUT_INIT',message:'RootLayout component initializing',timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'})}).catch(()=>{});
  } catch(e) {}
  // #endregion

  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    // #region agent log - SPLASH SCREEN: Track splash screen hide attempt
    console.log('[DEBUG] Attempting to hide splash screen', JSON.stringify({location:'app/_layout.tsx:SPLASH_HIDE',message:'Attempting to hide splash screen',timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'}));
    try {
      const debugUrl = Platform.OS === 'android' ? 'http://10.0.2.2:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278' : 'http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278';
      fetch(debugUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/_layout.tsx:SPLASH_HIDE',message:'Attempting to hide splash screen',timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'A'})}).catch(()=>{});
    } catch(e) {}
    // #endregion
    SplashScreen.hideAsync().catch((error) => {
      if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(error);
      }
    });
  }, []);

  // CRITICAL: Platform-split navigation for Rork Lightning Preview compatibility
  // DO NOT REMOVE: Manual NavigationContainer on Web is required for Rork Preview
  // DO NOT REMOVE: The independent: true prop and type cast are intentionally required
  // NavigationGuard is rendered inside RootLayoutNav to ensure it has access to navigation context
  const LayoutContent = (
    <>
      {Platform.OS !== 'web' && StripeProvider ? (
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
          <RootLayoutNav />
        </StripeProvider>
      ) : (
        <RootLayoutNav />
      )}
    </>
  );

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
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
                            {Platform.OS === 'web' ? (
                              // DO NOT REMOVE: Required for Rork Web Preview functionality
                              <NavigationContainer {...({ independent: true } as any)}>
                                {LayoutContent}
                              </NavigationContainer>
                            ) : (
                              LayoutContent
                            )}
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