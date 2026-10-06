import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { AuthGreen } from '@/constants/auth-palette';
import { AuthBackButton, AuthGoldButton } from '@/components/auth/AuthChrome';

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

            <Text style={styles.brand}>HomeCookedPlate</Text>

            <View style={styles.sheet}>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'password' && styles.modeButtonOn]}
                  onPress={() => setMode('password')}
                  accessibilityRole="button"
                  accessibilityLabel="Reset password"
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={mode === 'password' ? AuthGreen.ink : AuthGreen.ink}
                  />
                  <Text style={[styles.modeText, mode === 'password' && styles.modeTextOn]}>Reset password</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'reactivate' && styles.modeButtonOn]}
                  onPress={() => setMode('reactivate')}
                  accessibilityRole="button"
                  accessibilityLabel="Reactivate account"
                >
                  <Ionicons name="refresh-outline" size={18} color={AuthGreen.ink} />
                  <Text style={[styles.modeText, mode === 'reactivate' && styles.modeTextOn]}>Reactivate</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>
                  {mode === 'password' ? 'Forgot password' : 'Reactivate account'}
                </Text>
                <Text style={styles.help}>
                  {mode === 'password'
                    ? 'We will email a reset link if this address has an account.'
                    : 'If this address was paused, we will turn the account back on.'}
                </Text>
                <View style={styles.field}>
                  <Ionicons name="mail-outline" size={18} color={AuthGreen.gold} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={AuthGreen.muted}
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
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
                  <Text style={styles.loginLinkText}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthGreen.bg,
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
    color: AuthGreen.gold,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginBottom: 18,
  },
  sheet: {
    backgroundColor: AuthGreen.cream,
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
    backgroundColor: '#E7DFD2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  modeButtonOn: {
    backgroundColor: AuthGreen.gold,
  },
  modeText: {
    color: AuthGreen.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextOn: {
    fontWeight: '700',
  },
  panel: {
    backgroundColor: AuthGreen.panel,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  panelTitle: {
    color: AuthGreen.white,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  help: {
    color: AuthGreen.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AuthGreen.fieldLine,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    color: AuthGreen.white,
    fontSize: 16,
    paddingVertical: 0,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 14,
  },
  loginLinkText: {
    color: AuthGreen.gold,
    fontSize: 14,
    fontWeight: '700',
  },
});
