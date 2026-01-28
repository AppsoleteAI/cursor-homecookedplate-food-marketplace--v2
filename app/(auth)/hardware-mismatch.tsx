import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, monoGradients } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { router } from 'expo-router';

export default function HardwareMismatchScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={monoGradients.red}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Ionicons name="lock-closed" size={64} color={Colors.white} />
        <Text style={styles.title}>Hardware Mismatch</Text>
        <Text style={styles.subtitle}>Device Lock Verification Failed</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happened?</Text>
          <Text style={styles.cardText}>
            Your lifetime membership is device-locked and non-transferable. The device you&apos;re currently using doesn&apos;t match the device that was registered when you signed up.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why is this happening?</Text>
          <Text style={styles.cardText}>
            Lifetime memberships are tied to a specific device to prevent unauthorized transfers. This security measure protects your account and ensures fair use of promotional lifetime slots.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What can I do?</Text>
          <Text style={styles.cardText}>
            If you believe this is an error, please contact our support team. They can help verify your account and assist with device registration issues.
          </Text>
          <Text style={styles.supportText}>
            Support: support@homecookedplate.com
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Testing Note</Text>
          <Text style={styles.cardText}>
            If you&apos;re testing on an Android emulator, make sure you&apos;re using the same emulator instance that was used during signup. Each emulator has a unique Android ID that gets locked to your account.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogout}
          testID="hardware-mismatch-logout"
        >
          <Text style={styles.buttonText}>Return to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: Colors.gradient.green,
    fontWeight: '600',
    marginTop: 8,
  },
  button: {
    backgroundColor: Colors.gradient.red,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
