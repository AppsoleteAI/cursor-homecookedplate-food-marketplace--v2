import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBackButton, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { GlassPressable } from '@/components/glass-surface';

type RecoveryMode = 'password' | 'reactivate';

export default function RecoverScreen() {
  const [mode, setMode] = useState<RecoveryMode>('password');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword, reactivateAccount } = useAuth();

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Invalid Email', 'Please check for hidden spaces or typos in: ' + cleanEmail);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'password') {
        await resetPassword(cleanEmail);
        Alert.alert(
          'Password Reset',
          'If an account exists with this email, a password reset link has been sent. Please check your email.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        await reactivateAccount(cleanEmail);
        Alert.alert(
          'Account Reactivation',
          'If your account was paused, it has been reactivated. You can now log in normally.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AuthBackButton onPress={() => router.back()} />

            <AuthBrand />

            <View style={styles.sheet}>
              <View style={styles.modeRow}>
                <GlassPressable
                  style={[styles.modeButton, mode === 'password' && styles.modeButtonOn]}
                  onPress={() => setMode('password')}
                  accessibilityRole="button"
                  accessibilityLabel="Reset password"
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={mode === 'password' ? AuthColors.ink : AuthColors.ink}
                  />
                  <Text style={[styles.modeText, mode === 'password' && styles.modeTextOn]}>Reset password</Text>
                </GlassPressable>
                <GlassPressable
                  style={[styles.modeButton, mode === 'reactivate' && styles.modeButtonOn]}
                  onPress={() => setMode('reactivate')}
                  accessibilityRole="button"
                  accessibilityLabel="Reactivate account"
                >
                  <Ionicons name="refresh-outline" size={18} color={AuthColors.ink} />
                  <Text style={[styles.modeText, mode === 'reactivate' && styles.modeTextOn]}>Reactivate</Text>
                </GlassPressable>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>
                  {mode === 'password' ? 'Forgot Password' : 'Reactivate Account'}
                </Text>
                <Text style={styles.help}>
                  {mode === 'password'
                    ? 'We will email a reset link if this address has an account.'
                    : 'If this address was paused, we will turn the account back on.'}
                </Text>
                <View style={styles.field}>
                  <Ionicons name="mail-outline" size={18} color={AuthColors.maroon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={AuthColors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="recover-email"
                  />
                </View>
                <AuthGoldButton
                  title={mode === 'password' ? 'Send reset link' : 'Reactivate account'}
                  onPress={handleSubmit}
                  loading={loading}
                  testID="recover-submit"
                />
                <GlassPressable onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
                  <Text style={styles.loginLinkText}>Back to sign in</Text>
                </GlassPressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  brand: {
    color: AuthColors.brand,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginBottom: 18,
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: AuthColors.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  modeButtonOn: {
    backgroundColor: AuthColors.button,
  },
  modeText: {
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextOn: {
    fontWeight: '700',
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  panelTitle: {
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  help: {
    color: AuthColors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AuthColors.field,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    color: AuthColors.ink,
    fontSize: 16,
    paddingVertical: 0,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 14,
  },
  loginLinkText: {
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '700',
  },
});
