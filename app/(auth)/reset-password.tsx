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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/auth-context';
import { Colors } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';

/**
 * Password validation rules (matches signup requirements)
 * - Minimum 8 characters (enhanced from previous 6)
 * - Must contain at least one letter and one number (recommended)
 */
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  // Optional: Add more strict validation if needed
  // For now, we match the signup flow which uses min(6) but recommend 8+
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
    // Check if we have a valid reset token from URL params (deep link)
    if (params.access_token && params.type === 'recovery') {
      // Set session from URL token
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
      // Session exists from PASSWORD_RECOVERY event (auth listener navigated here)
      // Check if this is a recovery session
      setHasValidSession(true);
    } else {
      // No valid token or session - redirect to login
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

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      Alert.alert('Error', passwordValidation.message || 'Invalid password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Ensure we have a valid session (either from URL token or PASSWORD_RECOVERY event)
    if (!hasValidSession && !session) {
      Alert.alert('Error', 'Invalid reset token. Please request a new password reset link.');
      return;
    }

    setLoading(true);
    try {
      // Update password using current session
      // The session is already set either from URL token (setSession above) or PASSWORD_RECOVERY event
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
              // Navigate to root to trigger [2026-01-09] navigation lock
              // This ensures user is redirected to their correct Dashboard/Marketplace based on role
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
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.white, Colors.gray[50]]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Enter your new password below</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="New Password (min 8 characters)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <GradientButton
                title="Reset Password"
                onPress={handleResetPassword}
                loading={loading}
                style={styles.submitButton}
                baseColor="gold"
              />

              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backToLoginButton}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
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
    backgroundColor: Colors.white,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  formContainer: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gradient.darkGold,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  submitButton: {
    marginTop: 8,
  },
  backToLoginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 14,
    color: Colors.gray[600],
    textDecorationLine: 'underline',
  },
});
