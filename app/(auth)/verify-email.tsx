import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '@/lib/trpc';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { GlassPressable } from '@/components/glass-surface';

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
    if (token && verificationStatus === 'idle') {
      setVerificationStatus('verifying');
      verifyEmail.mutate({ token });
    } else if (!token && verificationStatus === 'idle') {
      setVerificationStatus('error');
      setErrorMessage('No verification token provided. Please check your email and try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    <AuthBackground>
    <View style={styles.container}>
      <AuthBrand />
      <View style={styles.sheet}>
        <View style={styles.panel}>
          {verificationStatus === 'verifying' && (
            <>
              <ActivityIndicator size="large" color={AuthColors.maroon} style={styles.spinner} />
              <Text style={styles.title}>Verifying Your Email</Text>
              <Text style={styles.subtitle}>This takes a moment.</Text>
            </>
          )}

          {verificationStatus === 'success' && (
            <>
              <Ionicons name="checkmark-circle" size={64} color={AuthColors.maroon} />
              <Text style={styles.title}>Email Verified</Text>
              <Text style={styles.subtitle}>You can sign in with this address now.</Text>
              <AuthGoldButton title="Go to sign in" onPress={handleGoToLogin} />
            </>
          )}

          {verificationStatus === 'error' && (
            <>
              <Ionicons name="alert-circle" size={64} color={AuthColors.error} />
              <Text style={styles.title}>Verification Failed</Text>
              <Text style={styles.subtitle}>{errorMessage}</Text>
              {token ? (
                <AuthGoldButton
                  title={verifyEmail.isPending ? 'Trying again' : 'Try again'}
                  onPress={handleRetry}
                  loading={verifyEmail.isPending}
                />
              ) : null}
              <GlassPressable onPress={handleGoToLogin} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>Go to sign in</Text>
              </GlassPressable>
            </>
          )}
        </View>
      </View>
    </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    padding: 14,
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    marginBottom: 8,
  },
  title: {
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: AuthColors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  loginLink: {
    paddingVertical: 8,
  },
  loginLinkText: {
    color: AuthColors.maroon,
    fontSize: 15,
    fontWeight: '700',
  },
});
