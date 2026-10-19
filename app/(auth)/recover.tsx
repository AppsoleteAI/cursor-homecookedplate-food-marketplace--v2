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
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import { AuthColors, preAppFont } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { BackCircle } from '@/components/BackCircle';
import { useReplaceBack } from '@/hooks/use-leave-screen';
import { GlassPressable } from '@/components/glass-surface';

type RecoveryMode = 'password' | 'reactivate' | 'confirm';

function startingMode(value: string | string[] | undefined): RecoveryMode {
  const mode = Array.isArray(value) ? value[0] : value;
  if (mode === 'confirm' || mode === 'reactivate') return mode;
  return 'password';
}

export default function RecoverScreen() {
  const params = useLocalSearchParams<{ mode?: string; email?: string }>();
  const [mode, setMode] = useState<RecoveryMode>(startingMode(params.mode));
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { resetPassword, reactivateAccount } = useAuth();
  const resendConfirmation = trpc.auth.resendVerificationEmail.useMutation();
  const backToSignIn = useReplaceBack('/(auth)/login');

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
    setNotice(null);
    try {
      if (mode === 'confirm') {
        const result = await resendConfirmation.mutateAsync({ email: cleanEmail });
        setNotice(result.message);
        return;
      }
      if (mode === 'password') {
        await resetPassword(cleanEmail);
        Alert.alert(
          'Password Reset',
          'If an account exists with this email, a password reset link has been sent. Please check your email.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      } else {
        await reactivateAccount(cleanEmail);
        Alert.alert(
          'Account Reactivation',
          'If your account was paused, it has been reactivated. You can now log in normally.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
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
            <BackCircle tone="honey" onPress={backToSignIn} testID="recover-back" />

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
                  <Text style={[styles.modeText, mode === 'password' && styles.modeTextOn]} numberOfLines={2}>Reset password</Text>
                </GlassPressable>
                <GlassPressable
                  style={[styles.modeButton, mode === 'reactivate' && styles.modeButtonOn]}
                  onPress={() => setMode('reactivate')}
                  accessibilityRole="button"
                  accessibilityLabel="Reactivate account"
                >
                  <Ionicons name="refresh-outline" size={18} color={AuthColors.ink} />
                  <Text style={[styles.modeText, mode === 'reactivate' && styles.modeTextOn]} numberOfLines={2}>Reactivate</Text>
                </GlassPressable>
                <GlassPressable
                  style={[styles.modeButton, mode === 'confirm' && styles.modeButtonOn]}
                  onPress={() => setMode('confirm')}
                  accessibilityRole="button"
                  accessibilityLabel="Resend confirmation email"
                  testID="recover-confirm-mode"
                >
                  <Ionicons name="mail-outline" size={18} color={AuthColors.ink} />
                  <Text style={[styles.modeText, mode === 'confirm' && styles.modeTextOn]} numberOfLines={2}>Confirm email</Text>
                </GlassPressable>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>
                  {mode === 'password' ? 'Forgot Password' : mode === 'confirm' ? 'Confirm email' : 'Reactivate Account'}
                </Text>
                <Text style={styles.help}>
                  {mode === 'password'
                    ? 'We will email a reset link if this address has an account.'
                    : mode === 'confirm'
                      ? 'We will email a new confirmation link if this address still needs one.'
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
                  title={mode === 'password' ? 'Send reset link' : mode === 'confirm' ? 'Email me a new link' : 'Reactivate account'}
                  onPress={handleSubmit}
                  loading={loading}
                  testID="recover-submit"
                />
                {notice ? <Text style={styles.notice}>{notice}</Text> : null}
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
    ...preAppFont,
    color: AuthColors.brand,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  modeButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: AuthColors.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null),
  },
  modeButtonOn: {
    backgroundColor: AuthColors.button,
  },
  modeText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
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
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 8,
  },
  help: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 14,
    fontWeight: '400',
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
    ...preAppFont,
    flex: 1,
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 0,
  },
  notice: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 14,
  },
  loginLinkText: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '600',
  },
});
