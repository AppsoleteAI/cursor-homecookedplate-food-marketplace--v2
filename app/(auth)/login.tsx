import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { openSignInCanEmailNewCode } from '@/backend/lib/sign-in-code';
import {
  isIneligibleAccountMessage,
  isMissingAccountMessage,
  MEMBERSHIP_INELIGIBLE_MESSAGE,
  NO_ACCOUNT_MESSAGE,
} from '@/backend/lib/sign-in-messages';
import { trpc } from '@/lib/trpc';
import { isLoginLegalBoxChecked, readLegalAgreement, setLoginLegalBoxChecked, toCompletedLegalAgreement } from '@/lib/legal-agreement';
import { AuthColors, preAppFont } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, MaroonButtonFill } from '@/components/auth/AuthChrome';
import { OrderHoursSlogan } from '@/components/OrderHoursSlogan';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { ResendConfirmation } from '@/components/auth/ResendConfirmation';

const ORDER_PHOTO = require('../../assets/order-a-plate.png');
const COOK_PHOTO = require('../../assets/start-cooking.png');
const APPSOLETE_MARK = require('../../assets/appsolete-mark.jpg');
const APPLE_LOGO = require('../../assets/logo-apple.png');
const GOOGLE_LOGO = require('../../assets/logo-google.png');

type SignupRole = 'platetaker' | 'platemaker';

function readLoginError(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const record = error as {
    message?: unknown;
    shape?: { message?: unknown };
    data?: { message?: unknown };
  };
  const parts = [record.message, record.shape?.message, record.data?.message]
    .filter((part): part is string => typeof part === 'string');
  return [...new Set(parts)].join(' ');
}

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signInCode, setSignInCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationExpired, setConfirmationExpired] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [legalChecked, setLegalChecked] = useState(isLoginLegalBoxChecked);
  const [agreementOnFile, setAgreementOnFile] = useState(false);
  const [legalNotice, setLegalNotice] = useState<string | null>(null);
  const { login, user } = useAuth();
  const saveAgreement = trpc.auth.updateProfile.useMutation();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      readLegalAgreement().then((record) => {
        if (!active || !toCompletedLegalAgreement(record)) return;
        setAgreementOnFile(true);
        setLegalChecked(true);
        setLoginLegalBoxChecked(true);
        setLegalNotice(null);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const openSignup = (role?: SignupRole) => {
    const href = (
      role
        ? { pathname: '/(auth)/welcome', params: { role } }
        : '/(auth)/welcome'
    ) as unknown as Href;
    router.push(href);
  };

  const handleProvider = (provider: 'Apple' | 'Google') => {
    setProviderNotice(`${provider} sign-in is not available yet. Use email to sign in.`);
  };

  const handleLogin = async (isRetry = false) => {
    console.log('Sign-in triggered', { isRetry, retryCount });

    if (!username || !password) {
      setError('Enter your email and password.');
      return;
    }

    const cleanEmail = username.trim().toLowerCase();

    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Check the email address.');
      return;
    }

    const agreement = toCompletedLegalAgreement(await readLegalAgreement());
    if (agreement) {
      setAgreementOnFile(true);
      setLegalChecked(true);
      setLoginLegalBoxChecked(true);
      setLegalNotice(null);
    }

    if (retryCount >= 3 && !isRetry) {
      setError('Too many attempts. Wait a moment, then try again.');
      return;
    }

    console.log('Final Sanitize Check:', cleanEmail);

    setLoading(true);
    setError(null);
    setNeedsConfirmation(false);
    setConfirmationExpired(false);
    setProviderNotice(null);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setError('Request timed out. Check your connection and try again.');
    }, 10000);

    try {
      if (needsCode && signInCode.length !== 6) {
        setError('Enter the 6-digit code from your email.');
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }
      const signedIn = await login(cleanEmail, password, needsCode ? signInCode : undefined);
      if (signedIn?.needsTwoFactor) {
        setNeedsCode(true);
        setError(signedIn.codeReused
          ? 'Enter the sign-in code already emailed. A new sign-in does not replace it.'
          : 'A sign-in code was emailed. Enter it here.');
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }
      AsyncStorage.setItem('hcp_has_account', '1').catch(() => undefined);
      if (timedOut) return;
      if (agreement) {
        try {
          await saveAgreement.mutateAsync({ legalSafetyAgreement: agreement });
        } catch (syncError) {
          console.error('[Login] Legal agreement was not stored on the account', syncError);
        }
      }
      setRetryCount(0);
      setError(null);
      router.replace('/');
    } catch (loginError: any) {
      console.error('[Login Error]', loginError);
      if (timedOut) return;

      const serverMessage = readLoginError(loginError);
      const loginCode = typeof loginError?.data?.code === 'string' ? loginError.data.code : '';
      const confirmationExpiredNow = /expired after 24 hours/i.test(serverMessage);
      const confirmationNeeded = confirmationExpiredNow || /confirm your email|email not confirmed/i.test(serverMessage);
      const legalNeeded = serverMessage.includes('Complete the Legal & Safety page');

      const isValidationError = serverMessage.includes('invalid_format') ||
        loginError.data?.zodError?.issues?.some((issue: any) => issue.path?.includes('email'));

      const isNetworkError = serverMessage.includes('fetch') ||
        serverMessage.includes('network') ||
        serverMessage.includes('timeout') ||
        serverMessage.includes('Failed to fetch');

      if (!isRetry && !confirmationNeeded && !legalNeeded) {
        setRetryCount((prev) => prev + 1);
      }

      if (openSignInCanEmailNewCode(serverMessage)) {
        setNeedsCode(false);
        setSignInCode('');
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError(serverMessage);
      } else if (legalNeeded) {
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError(null);
        setLegalNotice('Check each section on the Legal & Safety page, then enter today\'s date.');
        Alert.alert('Legal & Safety', 'Check each section on the Legal & Safety page, then enter today\'s date.');
      } else if (isIneligibleAccountMessage(serverMessage)) {
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError(MEMBERSHIP_INELIGIBLE_MESSAGE);
      } else if (isMissingAccountMessage(serverMessage) || loginCode === 'NOT_FOUND') {
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError(NO_ACCOUNT_MESSAGE);
      } else if (isValidationError) {
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError('Check the email address.');
      } else if (isNetworkError) {
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError('Network error. Check your connection and try again.');
      } else if (confirmationNeeded) {
        setNeedsConfirmation(true);
        setConfirmationExpired(confirmationExpiredNow);
        setError(null);
      } else {
        setNeedsConfirmation(false);
        setConfirmationExpired(false);
        setError(serverMessage || 'That email or password does not match.');
      }
    } finally {
      clearTimeout(timeoutId);
      if (!timedOut) {
        setLoading(false);
      }
    }
  };

  if (user) {
    return <Redirect href="/" />;
  }

  return (
    <AuthBackground testID="login-screen">
      <StatusBar style="light" />
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
            <View style={styles.brandSlot}>
              <AuthBrand toSignIn={false} />
            </View>

            <View style={styles.doors}>
              <GlassPressable
                style={styles.door}
                activeOpacity={0.9}
                onPress={() => openSignup('platetaker')}
                accessibilityRole="button"
                accessibilityLabel="Order a plate"
              >
                <View style={styles.doorClip}>
                <Image source={ORDER_PHOTO} style={styles.doorImage} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(8,20,16,0.82)']}
                  locations={[0, 0.62, 1]}
                  style={styles.doorShade}
                />
                <Text style={styles.doorLabel}>Order a Plate</Text>
                </View>
              </GlassPressable>

              <GlassPressable
                style={styles.door}
                activeOpacity={0.9}
                onPress={() => openSignup('platemaker')}
                accessibilityRole="button"
                accessibilityLabel="Start cooking"
              >
                <View style={styles.doorClip}>
                <Image source={COOK_PHOTO} style={styles.doorImageCook} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(8,20,16,0.82)']}
                  locations={[0, 0.62, 1]}
                  style={styles.doorShade}
                />
                <Text style={styles.doorLabel}>Start Cooking</Text>
                </View>
              </GlassPressable>
            </View>
            <OrderHoursSlogan style={styles.slogan} />

            <View style={styles.sheet}>
              <GlassPressable
                style={styles.appleButton}
                onPress={() => handleProvider('Apple')}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
              >
                <MaroonButtonFill />
                <Image source={APPLE_LOGO} style={styles.providerLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text style={styles.appleText}>Sign in with Apple</Text>
              </GlassPressable>

              <GlassPressable
                style={styles.googleButton}
                onPress={() => handleProvider('Google')}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
                <MaroonButtonFill />
                <Image source={GOOGLE_LOGO} style={styles.providerLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text style={styles.googleText}>Sign in with Google</Text>
              </GlassPressable>

              {providerNotice ? (
                <Text style={styles.providerNotice}>{providerNotice}</Text>
              ) : null}

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Sign in</Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={AuthColors.maroon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={AuthColors.placeholder}
                    value={username}
                    onChangeText={(value) => {
                      setUsername(value);
                      if (error) setError(null);
                      if (needsConfirmation) setNeedsConfirmation(false);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    keyboardType="email-address"
                    testID="login-email"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={AuthColors.maroon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={AuthColors.placeholder}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    testID="login-password"
                  />
                  <GlassPressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIconButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={AuthColors.maroon}
                    />
                  </GlassPressable>
                </View>

                {needsCode ? (
                  <View style={styles.inputContainer}>
                    <Ionicons name="key-outline" size={18} color={AuthColors.maroon} />
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit sign-in code"
                      placeholderTextColor={AuthColors.placeholder}
                      value={signInCode}
                      onChangeText={(value) => {
                        setSignInCode(value.replace(/\D/g, '').slice(0, 6));
                        if (error) setError(null);
                      }}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      testID="login-code"
                    />
                  </View>
                ) : null}

                <GlassPressable
                  onPress={() => router.push('/(auth)/recover')}
                  style={styles.forgotPasswordButton}
                  accessibilityRole="button"
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password</Text>
                </GlassPressable>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    {retryCount > 0 && retryCount < 3 && !needsConfirmation ? (
                      <GlassPressable
                        onPress={() => handleLogin(true)}
                        style={styles.retryButton}
                        disabled={loading}
                      >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                      </GlassPressable>
                    ) : null}
                  </View>
                ) : null}

                {needsConfirmation && confirmationExpired ? (
                  <GlassPressable
                    onPress={() => router.push({ pathname: '/(auth)/recover', params: { mode: 'confirm', email: username.trim() } } as Href)}
                    style={styles.confirmNotice}
                    accessibilityLabel="This confirmation link expired after 24 hours. Open Confirm email."
                    testID="login-confirm-notice"
                  >
                    <Ionicons name="mail-outline" size={18} color={AuthColors.maroon} />
                    <View style={styles.confirmNoticeCopy}>
                      <Text style={styles.confirmNoticeTitle}>This confirmation link expired after 24 hours.</Text>
                      <Text style={styles.confirmNoticeBody}>Tap to open Confirm email and send a new one.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={AuthColors.ink} />
                  </GlassPressable>
                ) : null}
                {needsConfirmation && !confirmationExpired ? (
                  <View style={styles.confirmNotice} testID="login-confirm-waiting">
                    <Ionicons name="mail-outline" size={18} color={AuthColors.maroon} />
                    <View style={styles.confirmNoticeCopy}>
                      <Text style={styles.confirmNoticeTitle}>This email is not confirmed.</Text>
                      <Text style={styles.confirmNoticeBody}>Open the link in that email. It lasts 24 hours. If it did not arrive, email a new link.</Text>
                      <ResendConfirmation email={username} />
                    </View>
                  </View>
                ) : null}

                <GlassPressable
                  style={styles.signInButton}
                  onPress={() => handleLogin(false)}
                  disabled={loading}
                  accessibilityRole="button"
                  testID="login-submit"
                >
                  <View style={styles.signInFill}>
                    <MaroonButtonFill />
                    {loading ? (
                      <ActivityIndicator color={AuthColors.white} />
                    ) : (
                      <Text style={styles.signInText}>Sign In</Text>
                    )}
                  </View>
                </GlassPressable>

                <View style={styles.switchRow}>
                  <Text style={styles.switchMuted}>New here? </Text>
                  <GlassPressable onPress={() => openSignup()} accessibilityRole="button">
                    <Text style={styles.switchLink}>Create an Account</Text>
                  </GlassPressable>
                </View>
              </View>

              <View style={styles.legalRow}>
                <Pressable
                  onPress={() => {
                    if (agreementOnFile) return;
                    setLegalChecked((current) => {
                      const next = !current;
                      setLoginLegalBoxChecked(next);
                      return next;
                    });
                    setLegalNotice(null);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: legalChecked }}
                  accessibilityLabel="Agree to Legal and Safety"
                  testID="login-legal-check"
                  style={styles.legalCheckHit}
                >
                  <View style={[styles.legalCheckbox, legalChecked && styles.legalCheckboxOn]}>
                    {legalChecked ? <Ionicons name="checkmark" size={14} color={AuthColors.ink} /> : null}
                  </View>
                </Pressable>
                <Text style={styles.legalAgreement}>
                  {legalNotice ? <Text style={styles.legalStar}>* </Text> : null}
                  I agree to the{' '}
                  <Text style={styles.legalText} onPress={() => router.push('/legal')}>
                    Legal & Safety
                  </Text>
                  {' '}page
                </Text>
              </View>
              {legalNotice ? <Text style={styles.legalNotice}>{legalNotice}</Text> : null}
            </View>

            <View style={styles.credit}>
              <View style={styles.creditLogoWrap}>
                <Image source={APPSOLETE_MARK} style={styles.creditLogo} resizeMode="cover" accessibilityLabel="Appsolete AI" />
              </View>
              <Text style={styles.creditText}>Powered by Appsolete AI</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 28,
  },
  brandSlot: {
    paddingHorizontal: 20,
  },
  doors: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  slogan: {
    color: AuthColors.ink,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  door: {
    flex: 1,
    height: 148,
    borderRadius: 18,
    backgroundColor: '#6B2A12',
    ...glassSurface,
  },
  doorClip: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  doorImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  doorImageCook: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '128%',
  },
  doorShade: {
    ...StyleSheet.absoluteFillObject,
  },
  doorLabel: {
    ...preAppFont,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  sheet: {
    marginHorizontal: 16,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    gap: 10,
  },
  appleButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  providerLogo: {
    width: 22,
    height: 22,
  },
  appleText: {
    ...preAppFont,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  googleButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleText: {
    ...preAppFont,
    color: AuthColors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  providerNotice: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.36)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  panelTitle: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AuthColors.field,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    ...preAppFont,
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '400',
    color: AuthColors.ink,
    paddingVertical: 0,
  },
  eyeIconButton: {
    padding: 6,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 14,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    ...preAppFont,
    fontSize: 14,
    fontWeight: '500',
    color: AuthColors.maroon,
  },
  errorContainer: {
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    ...preAppFont,
    color: AuthColors.error,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: AuthColors.field,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.36)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  confirmNoticeCopy: {
    flex: 1,
    gap: 2,
  },
  confirmNoticeTitle: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmNoticeBody: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  signInButton: {
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.36)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  signInFill: {
    height: 50,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  signInText: {
    ...preAppFont,
    color: AuthColors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  switchMuted: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '400',
  },
  switchLink: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '600',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  legalCheckHit: {
    paddingTop: 1,
  },
  legalCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AuthColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#14100C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.55,
    shadowRadius: 2,
  },
  legalCheckboxOn: {
    backgroundColor: AuthColors.brand,
  },
  legalAgreement: {
    ...preAppFont,
    flex: 1,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  legalStar: {
    ...preAppFont,
    color: AuthColors.ink,
    fontWeight: '600',
  },
  legalText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalNotice: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  credit: {
    alignItems: 'center',
    marginTop: 28,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  creditLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
  },
  creditLogo: {
    width: 64,
    height: 64,
  },
  creditText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '400',
  },
});
