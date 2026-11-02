import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/auth-context';
import { router } from 'expo-router';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { useStayBack } from '@/hooks/use-leave-screen';

export default function HardwareMismatchScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  useStayBack(true);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <AuthBackground>
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AuthBrand />

        <View style={styles.sheet}>
          <View style={styles.panel}>
            <Text style={styles.title}>Sign in on this install</Text>
            <Text style={styles.subtitle}>A lifetime membership stays on the account. A new install can save a new token after you sign in.</Text>
          </View>

          <Card title="What happened?">
            This install does not yet have the token saved on the lifetime account. Deleting the app and downloading it again from the App Store creates a new token.
          </Card>
          <Card title="What to do">
            Return to sign in and use the same account. The lifetime membership stays on that account, and this install is saved. It is not moved to a different account.
          </Card>
          <Card title="If sign-in does not restore it">
            Write to support@homecookedplate.com. Support can check the account. The token is a random id for this install. It is not the phone&apos;s hardware id.
          </Card>

          <AuthGoldButton
            title="Return to sign in"
            onPress={handleLogout}
            testID="hardware-mismatch-logout"
          />
        </View>
      </ScrollView>
    </View>
    </AuthBackground>
  );
}

function Card({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brand: {
    color: AuthColors.brand,
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  sheet: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    padding: 14,
    gap: 12,
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  title: {
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: AuthColors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    backgroundColor: AuthColors.field,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardText: {
    color: AuthColors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
