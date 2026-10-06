import React, { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/auth-context';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBackButton, AuthGoldButton } from '@/components/auth/AuthChrome';

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ access_token?: string; type?: string }>();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    if (params.access_token && params.type === 'recovery') {
      supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: '',
      }).then(({ error }) => {
        if (error) {
          Alert.alert(
            'Invalid Link',
            'This password reset link is invalid or has expired. Please request a new one.',
            [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
          );
        } else {
          setHasValidSession(true);
        }
      });
    } else if (session) {
      setHasValidSession(true);
    } else {
      Alert.alert(
        'Invalid Link',
        'This password reset link is invalid or has expired. Please request a new one.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  }, [params, session]);

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

    if (!hasValidSession && !session) {
      Alert.alert('Error', 'Invalid reset token. Please request a new password reset link.');
      return;
    }

    setLoading(true);
    try {
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
            <AuthBackButton onPress={() => router.replace('/(auth)/login')} />
            <Text style={styles.brand}>HomeCookedPlate</Text>
            <View style={styles.sheet}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>New password</Text>
                <Text style={styles.help}>Choose a password with at least 8 characters.</Text>
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
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
                  <Text style={styles.loginLinkText}>Back to sign in</Text>
                </TouchableOpacity>
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
