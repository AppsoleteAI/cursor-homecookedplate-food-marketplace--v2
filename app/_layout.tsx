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
 * This ensures seamless redirects between auth and main app screens
 * 
 * Verification Logic:
 * 1. Checks session state and verifies profile exists before navigating
 * 2. Redirects authenticated users out of auth screens to dashboard
 * 3. Redirects unauthenticated users trying to access protected routes to login
 * 4. Handles role-based routing (platemaker -> dashboard, platetaker -> home)
 */
function NavigationGuard() {
  const { session, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to finish loading before making navigation decisions
    if (isLoading) return;

    // Handle empty segments (initial load)
    if (!segments || segments.length === 0) return;

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === '(auth)';
    const inTabsGroup = currentSegment === '(tabs)';
    const isIndexRoute = currentSegment === 'index';

    // PUBLIC ROUTES: These can be accessed without authentication
    // - index (handled separately for initial routing)
    // - legal, help-support (if they're at root level)
    const publicRoutes = ['index', 'legal', 'help-support', 'privacy-security'];
    const isPublicRoute = publicRoutes.includes(currentSegment);

    // Case 1: No session and trying to access protected routes -> Redirect to Login
    if (!session && !inAuthGroup && !isPublicRoute) {
      router.replace('/(auth)/login');
      return;
    }

    // Case 2: Have session but no profile yet -> Wait for profile to load
    // The AuthProvider will fetch profile via trpc.auth.me.useQuery when session exists
    // This prevents premature navigation before profile data is available
    if (session && !user) {
      // Profile is being fetched, don't navigate yet
      return;
    }

    // Case 3: Logged in with profile & in Auth screens -> Redirect to appropriate dashboard
    // Verify profile exists before redirecting (ensures profile verification)
    if (session && user && inAuthGroup) {
      // Redirect based on user role
      const destination = user.role === 'platemaker' 
        ? '/(tabs)/dashboard' 
        : '/(tabs)/(home)/home';
      router.replace(destination);
      return;
    }

    // Case 4: Logged in with profile but accessing index -> Redirect to appropriate dashboard
    // This handles the initial route when user is already authenticated
    if (session && user && isIndexRoute) {
      const destination = user.role === 'platemaker' 
        ? '/(tabs)/dashboard' 
        : '/(tabs)/(home)/home';
      router.replace(destination);
      return;
    }

    // Case 5: Have session and profile, trying to access protected routes -> Allow
    // (No action needed, user is authenticated and accessing valid routes)
  }, [session, isLoading, user, segments, router]);

  // Render nothing - this is just for navigation logic
  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NavigationGuard />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
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
        <Stack.Screen name="reviews-dashboard" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="promotions" options={{ title: "Promotions" }} />
        <Stack.Screen name="messages" options={{ title: "Messages" }} />
        <Stack.Screen name="funnel" options={{ headerShown: false }} />
        <Stack.Screen name="admin-metro-caps" options={{ title: "Metro Cap Management" }} />
      </Stack>
    </>
  );
}

function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    SplashScreen.hideAsync().catch((error) => {
      if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(error);
      }
    });
  }, []);

  // CRITICAL: Platform-split navigation for Rork Lightning Preview compatibility
  // DO NOT REMOVE: Manual NavigationContainer on Web is required for Rork Preview
  // DO NOT REMOVE: The independent: true prop and type cast are intentionally required
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