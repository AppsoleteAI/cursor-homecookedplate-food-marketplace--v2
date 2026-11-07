import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { BackCircle } from '@/components/BackCircle';
import { useReplaceBack } from '@/hooks/use-leave-screen';
import { GlassPressable } from '@/components/glass-surface';
import { PasswordStrengthMeter, PASSWORD_RULE_MESSAGE, passwordMeetsRules } from '@/components/PasswordStrengthMeter';
import { recoveryFromLink, recoveryLinkPresent, markRecoveryScreen, type RecoveryLink } from '@/lib/verification-link';

const INVALID_LINK = 'This password reset link is invalid or has expired. Please request a new one.';

function one(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : null;
}

function linkFromParams(params: {
  access_token?: string | string[];
  refresh_token?: string | string[];
  type?: string | string[];
  code?: string | string[];
  token_hash?: string | string[];
  error_description?: string | string[];
}): string | null {
  const query = new URLSearchParams();
  const accessToken = one(params.access_token);
  const refreshToken = one(params.refresh_token);
  const type = one(params.type);
  const code = one(params.code);
  const tokenHash = one(params.token_hash);
  const errorDescription = one(params.error_description);
  if (accessToken) query.set('access_token', accessToken);
  if (refreshToken) query.set('refresh_token', refreshToken);
  if (type) query.set('type', type);
  if (code) query.set('code', code);
  if (tokenHash) query.set('token_hash', tokenHash);
  if (errorDescription) query.set('error_description', errorDescription);
  const text = query.toString();
  return text ? `?${text}` : null;
}

function userIdFromAccessToken(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part || typeof globalThis.atob !== 'function') return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(padded)) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!passwordMeetsRules(password)) {
    return { valid: false, message: PASSWORD_RULE_MESSAGE };
  }
  return { valid: true };
}

async function acceptRecovery(recovery: RecoveryLink): Promise<'ready' | 'invalid' | 'continue'> {
  if (recovery.errorDescription) return 'invalid';
  const recoveryTokens = recovery.accessToken && recovery.refreshToken
    && (recovery.type === 'recovery' || recovery.type == null);
  if (recoveryTokens && recovery.accessToken && recovery.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: recovery.accessToken,
      refresh_token: recovery.refreshToken,
    });
    return error ? 'invalid' : 'ready';
  }
  if (recovery.tokenHash && (recovery.type === 'recovery' || recovery.type == null)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: recovery.tokenHash,
      type: 'recovery',
    });
    return error ? 'invalid' : 'ready';
  }
  if (recovery.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(recovery.code);
    return error ? 'invalid' : 'ready';
  }
  return 'continue';
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    access_token?: string | string[];
    refresh_token?: string | string[];
    type?: string | string[];
    code?: string | string[];
    token_hash?: string | string[];
    error_description?: string | string[];
  }>();
  const linkedUrl = Linking.useURL();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const recoveryUserId = useRef<string | null>(null);
  const backToSignIn = useReplaceBack('/(auth)/login');
  const paramLink = linkFromParams(params);
  markRecoveryScreen(true);

  useEffect(() => {
    return () => markRecoveryScreen(false);
  }, []);

  useEffect(() => {
    let live = true;
    let wait: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const opened = await Linking.getInitialURL().catch(() => null);
      if (!live) return;
      const webHref = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;
      const recovery = recoveryFromLink(webHref, linkedUrl, opened, paramLink);
      if (recoveryLinkPresent(recovery)) {
        const accepted = await acceptRecovery(recovery);
        if (!live) return;
        if (accepted !== 'ready') {
          recoveryUserId.current = null;
          setPhase('invalid');
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (!live) return;
        const userId = data.session?.user?.id ?? null;
        const expectedId = recovery.accessToken ? userIdFromAccessToken(recovery.accessToken) : null;
        if (!userId || (expectedId && userId !== expectedId)) {
          recoveryUserId.current = null;
          setPhase('invalid');
          return;
        }
        recoveryUserId.current = userId;
        setPhase('ready');
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!live) return;
      const hasLink = Boolean(opened || linkedUrl || paramLink);
      if (!hasLink && Platform.OS !== 'web') {
        wait = setTimeout(() => {
          void supabase.auth.getSession().then(({ data: latest }) => {
            if (!live) return;
            const latestUserId = latest.session?.user?.id ?? null;
            if (!latestUserId) {
              setPhase((current) => (current === 'checking' ? 'invalid' : current));
              return;
            }
            recoveryUserId.current = latestUserId;
            setPhase('ready');
          });
        }, 2000);
        return;
      }
      if (data.session?.user?.id) {
        recoveryUserId.current = data.session.user.id;
        setPhase('ready');
        return;
      }
      setPhase((current) => (current === 'ready' ? current : 'invalid'));
    })().catch(() => {
      if (live) setPhase((current) => (current === 'ready' ? current : 'invalid'));
    });
    return () => {
      live = false;
      if (wait) clearTimeout(wait);
    };
  }, [linkedUrl, paramLink]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      Alert.alert('Error', passwordValidation.message || 'Invalid password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (phase !== 'ready') {
      Alert.alert('Invalid Link', INVALID_LINK);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const currentUserId = data.session?.user?.id ?? null;
      if (!currentUserId || currentUserId !== recoveryUserId.current) {
        setPhase('invalid');
        Alert.alert('Invalid Link', INVALID_LINK);
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success',
        'Your password has been reset successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/');
            },
          },
        ]
      );
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password. Please try again.';
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
            <BackCircle tone="honey" onPress={backToSignIn} testID="reset-password-back" />
            <AuthBrand />
            <View style={styles.sheet}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{phase === 'invalid' ? 'Invalid Link' : 'New Password'}</Text>
                {phase === 'checking' ? (
                  <>
                    <ActivityIndicator color={AuthColors.maroon} style={styles.spinner} />
                    <Text style={styles.help}>Checking your reset link.</Text>
                  </>
                ) : null}
                {phase === 'invalid' ? (
                  <>
                    <Text style={styles.help}>{INVALID_LINK}</Text>
                    <AuthGoldButton
                      title="Request a new link"
                      onPress={() => router.replace('/(auth)/recover')}
                      testID="reset-request-new"
                    />
                  </>
                ) : null}
                {phase === 'ready' ? (
                <>
                <Text style={styles.help}>Use 8 or more characters with an uppercase letter, a lowercase letter, a number, and a symbol.</Text>
                <View style={styles.field}>
                  <Ionicons name="lock-closed-outline" size={18} color={AuthColors.maroon} />
                  <TextInput
                    style={styles.input}
                    placeholder="New password"
                    placeholderTextColor={AuthColors.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    testID="reset-password"
                  />
                </View>
                {password.length > 0 ? <PasswordStrengthMeter password={password} /> : null}
                <View style={styles.field}>
                  <Ionicons name="lock-closed-outline" size={18} color={AuthColors.maroon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor={AuthColors.placeholder}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    testID="reset-confirm-password"
                  />
                </View>
                <AuthGoldButton
                  title="Reset password"
                  onPress={handleResetPassword}
                  loading={loading}
                  testID="reset-submit"
                />
                </>
                ) : null}
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
    paddingTop: 16,
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
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  spinner: {
    marginTop: 8,
    marginBottom: 8,
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
    marginBottom: 12,
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
