import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { router, type Href } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import { isLoginLegalBoxChecked, readLegalAgreement, setLoginLegalBoxChecked, clearLoginLegalBox, toCompletedLegalAgreement } from '@/lib/legal-agreement';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackButton, AuthBackground, AuthBrand } from '@/components/auth/AuthChrome';
import { GlassPressable, glassSurface } from '@/components/glass-surface';

const ORDER_PHOTO = require('../../assets/order-a-plate.png');
const COOK_PHOTO = require('../../assets/start-cooking.png');
const APPSOLETE_MARK = require('../../assets/appsolete-mark.jpg');
const APPLE_LOGO = require('../../assets/logo-apple.png');
const GOOGLE_LOGO = require('../../assets/logo-google.png');

type SignupRole = 'platetaker' | 'platemaker';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [legalChecked, setLegalChecked] = useState(isLoginLegalBoxChecked);
  const [legalNotice, setLegalNotice] = useState<string | null>(null);
  const { login, session } = useAuth();
  const saveAgreement = trpc.auth.updateProfile.useMutation();
  const sessionRef = useRef(session);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (sessionRef.current && !session) {
      clearLoginLegalBox();
      setLegalChecked(false);
      setLegalNotice(null);
    }
    sessionRef.current = session;
  }, [session]);

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
    const pageComplete = agreement !== null;
    if (!legalChecked || !pageComplete) {
      const message = !legalChecked && !pageComplete
        ? 'Check the Legal & Safety box to enter the app. The Legal & Safety page must also be filled out on this device.'
        : !legalChecked
          ? 'Check the Legal & Safety box to enter the app.'
          : 'The Legal & Safety page must be filled out on this device before you can enter.';
      setLegalNotice(message);
      Alert.alert('Legal & Safety', message);
      return;
    }
    setLegalNotice(null);

    if (retryCount >= 3 && !isRetry) {
      setError('Too many attempts. Wait a moment, then try again.');
      return;
    }

    console.log('Final Sanitize Check:', cleanEmail);

    setLoading(true);
    setError(null);
    setProviderNotice(null);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setError('Request timed out. Check your connection and try again.');
    }, 10000);

    try {
      await login(cleanEmail, password);
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
    } catch (loginError: any) {
      console.error('[Login Error]', loginError);
      if (timedOut) return;

      if (!isRetry) {
        setRetryCount((prev) => prev + 1);
      }

      const isValidationError = loginError.message?.includes('invalid_format') ||
        loginError.shape?.message?.includes('email') ||
        loginError.data?.zodError?.issues?.some((issue: any) => issue.path?.includes('email'));

      const isNetworkError = loginError.message?.includes('fetch') ||
        loginError.message?.includes('network') ||
        loginError.message?.includes('timeout') ||
        loginError.message?.includes('Failed to fetch');

      if (isValidationError) {
        setError('Check the email address.');
      } else if (isNetworkError) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError('That email or password does not match.');
      }
    } finally {
      clearTimeout(timeoutId);
      if (!timedOut) {
        setLoading(false);
      }
    }
  };

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
            {router.canGoBack() ? <AuthBackButton onPress={() => router.back()} /> : null}
            <AuthBrand toSignIn={false} />

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

            <View style={styles.sheet}>
              <GlassPressable
                style={styles.appleButton}
                onPress={() => handleProvider('Apple')}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
              >
                <Image source={APPLE_LOGO} style={styles.providerLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text style={styles.appleText}>Sign in with Apple</Text>
              </GlassPressable>

              <GlassPressable
                style={styles.googleButton}
                onPress={() => handleProvider('Google')}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
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
                    {retryCount > 0 && retryCount < 3 ? (
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

                <GlassPressable
                  style={styles.signInButton}
                  onPress={() => handleLogin(false)}
                  disabled={loading}
                  accessibilityRole="button"
                  testID="login-submit"
                >
                  <View style={styles.signInFill}>
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
                <GlassPressable
                  onPress={() => {
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
                </GlassPressable>
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
  doors: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    backgroundColor: AuthColors.maroonDeep,
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  googleButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: AuthColors.maroonDeep,
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
    color: AuthColors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  providerNotice: {
    color: AuthColors.ink,
    fontSize: 13,
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
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
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
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: AuthColors.maroon,
  },
  errorContainer: {
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: AuthColors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '700',
  },
  signInButton: {
    borderRadius: 24,
    backgroundColor: AuthColors.maroonDeep,
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
    backgroundColor: AuthColors.maroonDeep,
  },
  signInText: {
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
    color: AuthColors.ink,
    fontSize: 14,
  },
  switchLink: {
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '700',
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
    borderColor: AuthColors.white,
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
    flex: 1,
    color: AuthColors.white,
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(20, 16, 12, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  legalStar: {
    color: AuthColors.white,
    fontWeight: '700',
  },
  legalText: {
    color: AuthColors.white,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalNotice: {
    color: AuthColors.white,
    textShadowColor: 'rgba(20, 16, 12, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 13,
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
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
});
