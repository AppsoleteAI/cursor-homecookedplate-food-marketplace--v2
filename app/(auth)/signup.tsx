import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { MetroProgressBar } from '@/components/Registration/MetroProgressBar';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { useSignupForm } from '@/hooks/useSignupForm';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { BUYER_AFTER_NOTE } from '@/lib/buyer-safety';
import { GlassPressable, glassSurface } from '@/components/glass-surface';

export default function SignupScreen() {
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const roleParam = typeof params.role === 'string' ? params.role : undefined;
  // Local UI state (not part of form logic)
  const [showSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Use the comprehensive signup form hook
  const {
    formData,
    setFormData,
    isUsernameAvailable,
    isCheckingUsername,
    usernameError,
    passwordScore,
    isMembershipEnabled,
    handleToggleMembership,
    isEligibleForTrial,
    trialMeta,
    checkingEligibility,
    handleSignup,
    isLoading: loading,
    isSigningUp,
    error,
    retryCount,
  } = useSignupForm({
    onSuccess: (result) => {
      // Sign-in stays closed until the verification link is confirmed.
      console.log('[Signup] Success callback:', result);
    },
    onError: (error) => {
      console.error('[Signup] Error callback:', error);
    },
  });

  // Extract form fields for easier access
  const { username, email, password, confirmPassword, agreedToTerms, foodSafetyAcknowledged } = formData;

  // Complete any pending auth session for native redirects
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (roleParam === 'platetaker' || roleParam === 'platemaker') {
      setFormData((current) => ({ ...current, role: roleParam }));
    }
  }, [roleParam, setFormData]);

  // Show success message during signup
  // Don't auto-redirect - let auth context handle navigation if session was created
  // If no session, user can manually navigate to login
  if (isSigningUp) {
    return (
      <AuthBackground>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <AuthBrand />
            <Ionicons name="checkmark-circle" size={80} color={AuthColors.maroon} />
            <Text style={styles.successTitle}>Account Created!</Text>
            <Text style={styles.successText}>Check your email and confirm the link before you sign in.</Text>
            <GlassPressable
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </GlassPressable>
          </View>
        </SafeAreaView>
      </View>
      </AuthBackground>
    );
  }


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
          >
            <AuthBrand />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community of food lovers</Text>

            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>I want to:</Text>
              <View style={styles.roleButtons}>
                <GlassPressable
                  style={[
                    styles.roleButton,
                    formData.role === 'platetaker' && styles.roleButtonActive,
                    formData.role === 'platetaker' && styles.roleButtonActivePlatetaker,
                  ]}
                  onPress={() => setFormData({ ...formData, role: 'platetaker' })}
                >
                  <Ionicons
                    name="bag-outline"
                    size={20}
                    color={formData.role === 'platetaker' ? AuthColors.ink : AuthColors.maroon}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      formData.role === 'platetaker' && styles.roleButtonTextActive,
                    ]}
                  >
                    Order Food
                  </Text>
                </GlassPressable>

                <GlassPressable
                  style={[
                    styles.roleButton,
                    formData.role === 'platemaker' && styles.roleButtonActive,
                    formData.role === 'platemaker' && styles.roleButtonActivePlatemaker,
                  ]}
                  onPress={() => setFormData({ ...formData, role: 'platemaker' })}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={20}
                    color={formData.role === 'platemaker' ? AuthColors.ink : AuthColors.maroon}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      formData.role === 'platemaker' && styles.roleButtonTextActive,
                    ]}
                  >
                    Sell Food
                  </Text>
                </GlassPressable>
              </View>
            </View>

            {/* Premium Membership Toggle */}
            <View style={styles.membershipContainer}>
              <View style={styles.membershipHeader}>
                <View style={styles.membershipInfo}>
                  <Ionicons name="star" size={20} color={AuthColors.maroon} />
                  <Text style={styles.membershipTitle}>Enroll in HomeCooked Premium</Text>
                </View>
                <Switch
                  value={isMembershipEnabled}
                  onValueChange={handleToggleMembership}
                  trackColor={{ false: '#8A7568', true: AuthColors.brand }}
                  thumbColor={isMembershipEnabled ? AuthColors.field : AuthColors.muted}
                  disabled={checkingEligibility}
                />
              </View>
              {checkingEligibility && (
                <View style={styles.eligibilityLoading}>
                  <ActivityIndicator size="small" color={AuthColors.maroon} />
                  <Text style={styles.eligibilityLoadingText}>Checking eligibility...</Text>
                </View>
              )}
              {isEligibleForTrial && trialMeta && trialMeta.metro && !checkingEligibility && (
                <View style={styles.progressBarContainer}>
                  <View style={styles.eligibilityMessage}>
                    <Ionicons name="checkmark-circle" size={20} color={AuthColors.maroon} />
                    <Text style={styles.eligibilityText}>
                      Congrats! You qualify for Early Bird trial in {trialMeta.metro}!
                    </Text>
                  </View>
                  <MetroProgressBar
                    metroName={trialMeta.metro}
                    role={formData.role}
                    refetchInterval={20000} // Poll every 20 seconds for live updates
                  />
                </View>
              )}
              {isMembershipEnabled && !isEligibleForTrial && !checkingEligibility && trialMeta === null && (
                <View style={styles.eligibilityMessage}>
                  <Ionicons name="information-circle" size={20} color={AuthColors.maroon} />
                  <Text style={styles.eligibilityTextNeutral}>
                    Premium membership: $4.99/month after trial
                  </Text>
                </View>
              )}
              {isMembershipEnabled && !isEligibleForTrial && trialMeta && !checkingEligibility && (
                <View style={styles.eligibilityMessage}>
                  <Ionicons name="close-circle" size={20} color={AuthColors.muted} />
                  <Text style={styles.eligibilityTextNeutral}>
                    {trialMeta.metro ? `All spots taken in ${trialMeta.metro}` : 'Not eligible for trial in your area'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={AuthColors.maroon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={AuthColors.placeholder}
                  value={username}
                  onChangeText={(text) => setFormData({ ...formData, username: text })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                />
              </View>
              {/* Username Availability Indicator */}
              {username.length >= 3 && (
                <View style={{ marginTop: 4, marginLeft: 40 }}>
                  {isCheckingUsername ? (
                    <Text style={{ fontSize: 12, color: AuthColors.muted }}>Checking...</Text>
                  ) : usernameError ? (
                    <Text style={{ fontSize: 12, color: AuthColors.error }}>
                      {usernameError}
                    </Text>
                  ) : isUsernameAvailable === true ? (
                    <Text style={{ fontSize: 12, color: AuthColors.brand }}>✓ Username available</Text>
                  ) : isUsernameAvailable === false ? (
                    <Text style={{ fontSize: 12, color: AuthColors.error }}>✗ Username taken</Text>
                  ) : null}
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={AuthColors.maroon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={AuthColors.placeholder}
                  value={email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={AuthColors.maroon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={AuthColors.placeholder}
                  value={password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <GlassPressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIconButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={AuthColors.maroon}
                  />
                </GlassPressable>
              </View>
              {/* Password Strength Meter */}
              {password.length > 0 && <PasswordStrengthMeter password={password} />}

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={AuthColors.maroon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={AuthColors.placeholder}
                  value={confirmPassword}
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <GlassPressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIconButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={AuthColors.maroon}
                  />
                </GlassPressable>
              </View>

              <GlassPressable
                style={styles.termsContainer}
                onPress={() => setFormData({ ...formData, agreedToTerms: !agreedToTerms })}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
                  {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => router.push('/legal')}
                  >
                    Terms & Conditions
                  </Text>
                  {' '}and understand the legal disclaimers
                </Text>
              </GlassPressable>

              {/* Cottage Laws Warning - ALWAYS SHOWN for ALL users */}
              <View style={styles.foodSafetyContainer}>
                <View style={styles.foodSafetyInfoBox}>
                  <Ionicons name="information-circle" size={20} color={AuthColors.maroon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodSafetyInfoText}>
                      Ingredients and allergens are listed by the cook. Tell them about your allergies before you order. If something looks or smells wrong at pickup, do not eat it.
                    </Text>
                    <Text style={[styles.foodSafetyInfoText, { marginTop: 8 }]}>
                      Meet in a public place during daylight. Do not exchange phone numbers in the app. A prepaid delivery is brought by the cook with someone else along.
                    </Text>
                    <Text style={[styles.foodSafetyInfoText, { marginTop: 8 }]}>
                      {BUYER_AFTER_NOTE}
                    </Text>
                    <FoodHandlingLink />
                  </View>
                </View>
                <GlassPressable
                  style={styles.termsContainer}
                  onPress={() => setFormData({ ...formData, foodSafetyAcknowledged: !foodSafetyAcknowledged })}
                >
                  <View style={[styles.checkbox, foodSafetyAcknowledged && styles.checkboxActive]}>
                    {foodSafetyAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I understand these safety notes. I will check the ingredients, meet in a public place during daylight, and eat the food promptly.
                  </Text>
                </GlassPressable>
              </View>

              {/* Error message display */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color={AuthColors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                  {retryCount < 3 && (
                    <GlassPressable
                      onPress={() => handleSignup(true)}
                      style={styles.retryButton}
                      disabled={loading}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </GlassPressable>
                  )}
                </View>
              )}

              <AuthGoldButton
                title="Create Account"
                onPress={() => {
                  handleSignup(false);
                }}
                loading={loading}
                disabled={
                  !agreedToTerms || 
                  !foodSafetyAcknowledged || 
                  loading || 
                  passwordScore < 5 || 
                  isUsernameAvailable === false
                }
                style={styles.signupButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={AuthColors.maroon} />
            </View>
            <Text style={styles.modalTitle}>Successfully Signed Up!</Text>
            <Text style={styles.modalMessage}>
              Welcome to HOMECOOKEDPLATE! A confirmation email has been sent to {email} with instructions on how to get started.
            </Text>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: AuthColors.brand,
    textShadowColor: 'rgba(70, 16, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AuthColors.onDark,
    marginBottom: 32,
  },
  roleContainer: {
    marginBottom: 32,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AuthColors.onDark,
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    ...glassSurface,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(72, 16, 30, 0.35)',
    backgroundColor: AuthColors.card,
  },
  roleButtonActive: {
    borderColor: 'transparent',
  },
  roleButtonActivePlatetaker: {
    backgroundColor: AuthColors.button,
  },
  roleButtonActivePlatemaker: {
    backgroundColor: AuthColors.button,
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AuthColors.maroon,
  },
  roleButtonTextActive: {
    color: AuthColors.ink,
  },
  membershipContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AuthColors.maroon,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  membershipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  membershipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AuthColors.ink,
  },
  eligibilityLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  eligibilityLoadingText: {
    fontSize: 14,
    color: AuthColors.ink,
  },
  eligibilityMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E4D8C4',
  },
  eligibilityText: {
    flex: 1,
    fontSize: 14,
    color: AuthColors.ink,
    fontWeight: '500',
  },
  eligibilityTextNeutral: {
    flex: 1,
    fontSize: 14,
    color: AuthColors.ink,
  },
  eligibilityTextContainer: {
    flex: 1,
  },
  progressBarContainer: {
    marginTop: 8,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AuthColors.field,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: AuthColors.ink,
  },
  eyeIconButton: {
    position: 'absolute',
    right: 10,
    padding: 8,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: AuthColors.brand,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: AuthColors.button,
    borderColor: AuthColors.brand,
  },
  checkmark: {
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: AuthColors.white,
    lineHeight: 20,
  },
  termsLink: {
    color: AuthColors.white,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  foodSafetyContainer: {
    marginBottom: 16,
  },
  foodSafetyInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: AuthColors.card,
    borderWidth: 1,
    borderColor: 'rgba(72, 16, 30, 0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  foodSafetyInfoText: {
    flex: 1,
    fontSize: 13,
    color: AuthColors.ink,
    lineHeight: 18,
  },
  foodSafetyLink: {
    color: AuthColors.maroon,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  signupButton: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AuthColors.ink,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: AuthColors.ink,
    textAlign: 'center',
    lineHeight: 24,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AuthColors.brand,
    marginTop: 24,
    marginBottom: 8,
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  successText: {
    fontSize: 16,
    color: AuthColors.ink,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: AuthColors.button,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  loginButtonText: {
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AuthColors.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: AuthColors.error,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryButtonText: {
    color: AuthColors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
});
