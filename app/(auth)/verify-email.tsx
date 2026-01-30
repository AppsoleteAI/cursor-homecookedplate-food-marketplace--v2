import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '@/lib/trpc';
import { Colors } from '@/constants/colors';

/**
 * Email Verification Screen
 * 
 * Handles email verification via token from confirmation email.
 * Users are redirected here after clicking the confirmation link in their email.
 * 
 * Flow:
 * 1. User signs up → receives confirmation email via Resend
 * 2. User clicks link → navigates here with token in URL
 * 3. This screen calls verifyEmail procedure
 * 4. On success → redirects to login
 */
export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const verifyEmail = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setVerificationStatus('success');
      Alert.alert(
        'Email Verified!',
        data.message || 'Your email has been verified successfully. You can now log in.',
        [
          {
            text: 'Go to Login',
            onPress: () => {
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    },
    onError: (error) => {
      setVerificationStatus('error');
      setErrorMessage(error.message || 'Failed to verify email. Please try again.');
    },
  });

  useEffect(() => {
    // Handle token from URL query parameter or deep link
    // This runs once when the component mounts with a token
    if (token && verificationStatus === 'idle') {
      setVerificationStatus('verifying');
      verifyEmail.mutate({ token });
    } else if (!token && verificationStatus === 'idle') {
      setVerificationStatus('error');
      setErrorMessage('No verification token provided. Please check your email and try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Only depend on token - verificationStatus changes are handled internally

  const handleRetry = () => {
    if (token) {
      setVerificationStatus('verifying');
      setErrorMessage('');
      verifyEmail.mutate({ token });
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <LinearGradient
      colors={[Colors.gradient.purple, Colors.gradient.blue]}
      style={styles.container}
    >
      <View style={styles.content}>
        {verificationStatus === 'verifying' && (
          <>
            <ActivityIndicator size="large" color={Colors.white} style={styles.spinner} />
            <Text style={styles.title}>Verifying Your Email</Text>
            <Text style={styles.subtitle}>Please wait while we verify your email address...</Text>
          </>
        )}

        {verificationStatus === 'success' && (
          <>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.subtitle}>
              Your email has been verified successfully. You can now log in to your account.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={handleGoToLogin}
            >
              <Text style={styles.buttonText}>Go to Login</Text>
            </TouchableOpacity>
          </>
        )}

        {verificationStatus === 'error' && (
          <>
            <Text style={styles.errorIcon}>✗</Text>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <View style={styles.buttonContainer}>
              {token && (
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={handleRetry}
                  disabled={verifyEmail.isLoading}
                >
                  <Text style={styles.buttonText}>
                    {verifyEmail.isLoading ? 'Retrying...' : 'Try Again'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleGoToLogin}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 80,
    color: Colors.white,
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 80,
    color: '#ff4444',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.9,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  retryButton: {
    backgroundColor: Colors.white,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  buttonText: {
    color: Colors.gradient.purple,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: Colors.white,
  },
});
