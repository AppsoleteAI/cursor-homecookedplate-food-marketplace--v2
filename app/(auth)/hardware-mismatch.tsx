import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/auth-context';
import { router } from 'expo-router';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthGoldButton } from '@/components/auth/AuthChrome';

export default function HardwareMismatchScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

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
        <View style={styles.brandRow}>
          <Ionicons name="lock-closed" size={28} color={AuthColors.maroon} />
          <Text style={styles.brand}>HomeCookedPlate</Text>
        </View>

        <View style={styles.sheet}>
          <View style={styles.panel}>
            <Text style={styles.title}>Hardware mismatch</Text>
            <Text style={styles.subtitle}>This device does not match the one locked to the membership.</Text>
          </View>

          <Card title="What happened?">
            Your lifetime membership is device-locked and non-transferable. The device you are using does not match the device registered at signup.
          </Card>
          <Card title="Why this happens">
            Lifetime memberships stay on one device so a promotional slot cannot be moved to someone else.
          </Card>
          <Card title="What you can do">
            If this looks wrong, write to support@homecookedplate.com. Support can check the account and the registered device.
          </Card>
          <Card title="Emulator testing">
            An Android emulator lock follows that emulator&apos;s Android ID. Use the same emulator instance that created the account.
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
