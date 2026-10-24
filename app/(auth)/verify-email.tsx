import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '@/lib/trpc';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { ResendConfirmation } from '@/components/auth/ResendConfirmation';
import { GlassPressable } from '@/components/glass-surface';
import { BackCircle } from '@/components/BackCircle';
import { useReplaceBack } from '@/hooks/use-leave-screen';
import { confirmationAlreadyDone, tokenFromLink } from '@/lib/verification-link';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const linkedUrl = Linking.useURL();
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);
  const [linkChecked, setLinkChecked] = useState(false);
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const sent = useRef<string | null>(null);
  const token = tokenFromLink(Array.isArray(params.token) ? params.token[0] : params.token)
    || tokenFromLink(linkedUrl)
    || tokenFromLink(openedUrl);

  const backToSignIn = useReplaceBack('/(auth)/login');
  const verifyEmail = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setVerificationStatus('success');
    },
    onError: (error) => {
      if (confirmationAlreadyDone(error.message)) {
        setVerificationStatus('success');
        return;
      }
      setVerificationStatus('error');
      setErrorMessage(error.message || 'Failed to verify email. Please try again.');
    },
  });

  useEffect(() => {
    let live = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!live) return;
        setOpenedUrl(url);
        setLinkChecked(true);
      })
      .catch(() => {
        if (live) setLinkChecked(true);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (token) {
      if (sent.current === token) return;
      sent.current = token;
      setVerificationStatus('verifying');
      setErrorMessage('');
      verifyEmail.mutate({ token });
      return;
    }
    if (linkChecked && sent.current === null) {
      setVerificationStatus('error');
      setErrorMessage('No verification token provided. Please check your email and try again.');
    }
    // The mutation identity changes after each result. The ref sends each token once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, linkChecked]);

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
      <BackCircle tone="honey" onPress={backToSignIn} testID="verify-email-back" />
      <View style={styles.body}>
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
              <Text style={styles.title}>Email confirmed</Text>
              <Text style={styles.subtitle}>You can sign in with this address now.</Text>
              <AuthGoldButton title="Go to sign in" onPress={handleGoToLogin} />
            </>
          )}

          {verificationStatus === 'error' && (
            <>
              <Ionicons name="alert-circle" size={64} color={AuthColors.error} />
              <Text style={styles.title}>Verification Failed</Text>
              <Text style={styles.subtitle}>{errorMessage}</Text>
              <ResendConfirmation showEmailField />
              {token && !/expired|already been used|invalid verification/i.test(errorMessage) ? (
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
    </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
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
