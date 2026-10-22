import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/auth-context';
import { Sentry } from '@/lib/sentry';

export const LAUNCH_LAYOUT_GIVE_UP_MS = 1000;
export const LAUNCH_AUTH_GIVE_UP_MS = 10000;
const LAUNCH_BACKGROUND = '#1A0F0A';

// The slot stays mounted under this cover. Waiting to mount the slot
// leaves the navigation key unset, and the splash then never leaves.
// onLayout can also stay silent while the native splash is up, and a
// saved sign-in can leave auth loading. Either one used to pin the splash
// on both phones. The native splash hides once the dark view is up. The
// cover then follows auth, and both waits give up.
export function LaunchCover({
  children,
  layoutReady,
}: {
  children: React.ReactNode;
  layoutReady: boolean;
}) {
  const { isLoading: authIsLoading } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [layoutGaveUp, setLayoutGaveUp] = useState(false);
  const [authGaveUp, setAuthGaveUp] = useState(false);
  const layoutSettled = layoutReady || layoutGaveUp;
  const cover = !isWeb && (!layoutSettled || (authIsLoading && !authGaveUp));

  useEffect(() => {
    if (isWeb || layoutReady) return;
    const timer = setTimeout(() => setLayoutGaveUp(true), LAUNCH_LAYOUT_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [isWeb, layoutReady]);

  useEffect(() => {
    if (isWeb || !authIsLoading) {
      setAuthGaveUp(false);
      return;
    }
    const timer = setTimeout(() => setAuthGaveUp(true), LAUNCH_AUTH_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [authIsLoading, isWeb]);

  useEffect(() => {
    if (!layoutSettled || isWeb) return;
    SplashScreen.hideAsync().catch((error) => {
      if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(error);
      }
    });
  }, [layoutSettled, isWeb]);

  return (
    <>
      {children}
      {cover ? (
        <View testID="launch-cover" pointerEvents="auto" style={[StyleSheet.absoluteFill, styles.gate]}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  gate: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LAUNCH_BACKGROUND,
  },
});
