import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Colors, pagePastel } from '@/constants/colors';
import { GlassPressable } from '@/components/glass-surface';
import { useAuth } from '@/hooks/auth-context';
import { useGuestRole } from '@/hooks/use-guest-role';

/** The signed-out card from Profile. Limited browsing returns to that role's home. */
export function GuestLimit({ screen = 'guest' }: { screen?: string }) {
  const guestRole = useGuestRole();

  return (
    <SafeAreaView style={styles.container} testID={`${screen}-guest`}>
      <View style={styles.card}>
        <Text style={styles.name}>Hello, Guest!</Text>
        <Text style={styles.copy}>Create an account, sign in, or limited browsing.</Text>
        <GlassPressable
          style={styles.button}
          onPress={() => router.push({
            pathname: '/(auth)/welcome',
            params: {
              step: guestRole ? '3' : '1',
              entry: 'signup',
              ...(guestRole ? { role: guestRole } : {}),
            },
          })}
          accessibilityRole="button"
          testID={`${screen}-create-account`}
        >
          <Text style={styles.buttonText}>Create an account</Text>
        </GlassPressable>
        <GlassPressable
          style={styles.button}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          testID={`${screen}-sign-in`}
        >
          <Text style={styles.buttonText}>Sign in</Text>
        </GlassPressable>
        <GlassPressable
          style={styles.quiet}
          onPress={() => router.replace('/(tabs)/(home)/home')}
          accessibilityRole="button"
          testID={`${screen}-limited-access`}
        >
          <Text style={styles.quietText}>Limited browsing</Text>
        </GlassPressable>
      </View>
    </SafeAreaView>
  );
}

/** Section menus stay open. Every option under that menu shows the guest card. */
export function SectionGuestGate({
  root,
  children,
}: {
  root: string;
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const guestRole = useGuestRole();
  const path = usePathname().replace(/\/$/, '');
  const atRoot = path === root;
  if (!isAuthenticated && (isLoading || guestRole === undefined)) {
    if (atRoot) return <>{children}</>;
    return null;
  }
  if (!isAuthenticated && !atRoot) return <GuestLimit screen="section" />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pagePastel.gold,
  },
  card: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.gray[700],
    marginBottom: 8,
  },
  button: {
    backgroundColor: Colors.gray[900],
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  quiet: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  quietText: {
    color: Colors.gray[800],
    fontSize: 16,
    fontWeight: '600',
  },
});
