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
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { MetroProgressBar } from '@/components/Registration/MetroProgressBar';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { useSignupForm } from '@/hooks/useSignupForm';
import { trpc } from '@/lib/trpc';

export default function SignupScreen() {
  // Local UI state (not part of form logic)
  const [showSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isWaitingForEmail, setIsWaitingForEmail] = useState(false);

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
    signupUserRole,
  } = useSignupForm({
    onSuccess: (result) => {
      // Central Listener Pattern: Check if email confirmation is needed
      // When needsEmailConfirmation is true, show "Waiting for Verification" UI
      // The central onAuthStateChange listener in hooks/auth-context.tsx will handle
      // session updates when the user verifies their email and logs in
      if (result.needsEmailConfirmation) {
        setIsWaitingForEmail(true);
        return; // Don't proceed with animation - show email confirmation UI
      }
      // Success handled by animation logic below
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

  // Auto-redirect to login after successful signup (no blocking animation)
  useEffect(() => {
    if (isSigningUp && signupUserRole) {
      // Show success message briefly, then auto-redirect
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 1500); // 1.5 second delay for user to see success

      return () => clearTimeout(timer);
    }
  }, [isSigningUp, signupUserRole]);

  // Resend email mutation - allows users to request a new verification email
  const resendEmail = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: (data) => {
      Alert.alert('Email Sent', data.message || 'A new verification link has been sent to your email.');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to resend email. Please try again.');
    },
  });

  /**
   * "Waiting for Verification" UI
   * 
   * This screen is shown immediately after signup when needsEmailConfirmation is true.
   * It provides:
   * 1. Clear instructions to check email
   * 2. Resend email functionality (if user didn't receive the email)
   * 3. Option to go back to signup form
   * 
   * Flow:
   * - User signs up → receives confirmation email via Resend (production email service)
   * - This UI is shown → user waits for email
   * - User clicks link in email → navigates to verify-email screen
   * - After verification → user can log in
   * 
   * The central onAuthStateChange listener in hooks/auth-context.tsx handles session
   * updates when the user verifies and logs in, ensuring the app "wakes up" correctly.
   */
  if (isWaitingForEmail) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.white, Colors.gray[50]]}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emailConfirmationContainer}>
            <Ionicons name="mail-outline" size={64} color={Colors.gradient.purple} style={styles.emailIcon} />
            <Text style={styles.emailConfirmationTitle}>Check your email!</Text>
            <Text style={styles.emailConfirmationText}>
              We sent a confirmation link to {email}. Please check your email and click the link to verify your account.
            </Text>
            <Text style={styles.emailConfirmationSubtext}>
              Once verified, you can log in to your account. The link will expire in 24 hours.
            </Text>
            <View style={styles.emailConfirmationActions}>
              <TouchableOpacity 
                style={[styles.resendButton, resendEmail.isLoading && styles.resendButtonDisabled]}
                onPress={() => resendEmail.mutate({ email })}
                disabled={resendEmail.isLoading}
              >
                {resendEmail.isLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Email</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setIsWaitingForEmail(false)}
              >
                <Text style={styles.backButtonText}>Back to Signup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show success message during signup (brief, then auto-redirect)
  if (isSigningUp) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.white, Colors.gray[50]]}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color={Colors.gradient.green} />
            <Text style={styles.successTitle}>Account Created!</Text>
            <Text style={styles.successText}>Redirecting to login...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }


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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community of food lovers</Text>

            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>I want to:</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
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
                    color={formData.role === 'platetaker' ? Colors.white : Colors.gray[600]}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      formData.role === 'platetaker' && styles.roleButtonTextActive,
                    ]}
                  >
                    Order Food
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
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
                    color={formData.role === 'platemaker' ? Colors.white : Colors.gray[600]}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      formData.role === 'platemaker' && styles.roleButtonTextActive,
                    ]}
                  >
                    Sell Food
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Premium Membership Toggle */}
            <View style={styles.membershipContainer}>
              <View style={styles.membershipHeader}>
                <View style={styles.membershipInfo}>
                  <Ionicons name="star" size={20} color={Colors.gradient.darkGold} />
                  <Text style={styles.membershipTitle}>Enroll in HomeCooked Premium</Text>
                </View>
                <Switch
                  value={isMembershipEnabled}
                  onValueChange={handleToggleMembership}
                  trackColor={{ false: Colors.gray[300], true: Colors.gradient.yellow[1] }}
                  thumbColor={isMembershipEnabled ? Colors.gradient.darkGold : Colors.gray[500]}
                  disabled={checkingEligibility}
                />
              </View>
              {checkingEligibility && (
                <View style={styles.eligibilityLoading}>
                  <ActivityIndicator size="small" color={Colors.gradient.darkGold} />
                  <Text style={styles.eligibilityLoadingText}>Checking eligibility...</Text>
                </View>
              )}
              {isEligibleForTrial && trialMeta && trialMeta.metro && !checkingEligibility && (
                <View style={styles.progressBarContainer}>
                  <View style={styles.eligibilityMessage}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.gradient.green} />
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
                  <Ionicons name="information-circle" size={20} color={Colors.gray[500]} />
                  <Text style={styles.eligibilityTextNeutral}>
                    Premium membership: $4.99/month after trial
                  </Text>
                </View>
              )}
              {isMembershipEnabled && !isEligibleForTrial && trialMeta && !checkingEligibility && (
                <View style={styles.eligibilityMessage}>
                  <Ionicons name="close-circle" size={20} color={Colors.gray[500]} />
                  <Text style={styles.eligibilityTextNeutral}>
                    {trialMeta.metro ? `All spots taken in ${trialMeta.metro}` : 'Not eligible for trial in your area'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  id="username"
                  name="username"
                  style={styles.input}
                  placeholder="Username"
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
                    <Text style={{ fontSize: 12, color: Colors.gray[400] }}>Checking...</Text>
                  ) : usernameError ? (
                    <Text style={{ fontSize: 12, color: '#ff4d4d' }}>
                      {usernameError}
                    </Text>
                  ) : isUsernameAvailable === true ? (
                    <Text style={{ fontSize: 12, color: '#2eb82e' }}>✓ Username available</Text>
                  ) : isUsernameAvailable === false ? (
                    <Text style={{ fontSize: 12, color: '#ff4d4d' }}>✗ Username taken</Text>
                  ) : null}
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  id="email"
                  name="email"
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  id="password"
                  name="password"
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIconButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Colors.gray[400]}
                  />
                </TouchableOpacity>
              </View>
              {/* Password Strength Meter */}
              {password.length > 0 && <PasswordStrengthMeter password={password} />}

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  id="confirmPassword"
                  name="confirmPassword"
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIconButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Colors.gray[400]}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
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
              </TouchableOpacity>

              {/* Cottage Laws Warning - ALWAYS SHOWN for ALL users */}
              <View style={styles.foodSafetyContainer}>
                <View style={styles.foodSafetyInfoBox}>
                  <Ionicons name="information-circle" size={20} color={Colors.gradient.yellow} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodSafetyInfoText}>
                      We recommend every user review{' '}
                      <Text
                        style={styles.foodSafetyLink}
                        onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
                      >
                        cottagefoodlaws.com
                      </Text>
                      {' '}and do your due diligence to meet all food safety requirements from your local, county, state and federal laws before using the HomeCookedPlate platform.
                    </Text>
                    <Text style={[styles.foodSafetyInfoText, { marginTop: 8, fontSize: 11, fontStyle: 'italic' }]}>
                      HomeCookedPlate is not affiliated or in partnership with cottagefoodlaws.com.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.termsContainer}
                  onPress={() => setFormData({ ...formData, foodSafetyAcknowledged: !foodSafetyAcknowledged })}
                >
                  <View style={[styles.checkbox, foodSafetyAcknowledged && styles.checkboxActive]}>
                    {foodSafetyAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I acknowledge that I have reviewed cottagefoodlaws.com and understand that I must comply with all local, county, state and federal food laws. I understand that HomeCookedPlate does not allow anyone to violate their local, county, state and/or federal food laws on the HomeCookedPlate App.
                  </Text>
                </TouchableOpacity>
              </View>

              <GradientButton
                title="Create Account"
                onPress={() => {
                  handleSignup();
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
                baseColor="gold"
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
              <Ionicons name="checkmark-circle" size={64} color={Colors.gradient.green} />
            </View>
            <Text style={styles.modalTitle}>Successfully Signed Up!</Text>
            <Text style={styles.modalMessage}>
              Welcome to HOMECOOKEDPLATE! A confirmation email has been sent to {email} with instructions on how to get started.
            </Text>
          </View>
        </View>
      </Modal>
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
    paddingTop: 120,
    paddingBottom: 32,
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
    marginBottom: 32,
  },
  roleContainer: {
    marginBottom: 32,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gradient.yellow,
    backgroundColor: Colors.white,
  },
  roleButtonActive: {
    borderColor: 'transparent',
  },
  roleButtonActivePlatetaker: {
    backgroundColor: Colors.gradient.yellow,
  },
  roleButtonActivePlatemaker: {
    backgroundColor: Colors.gradient.yellow,
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  roleButtonTextActive: {
    color: Colors.white,
  },
  membershipContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
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
    color: Colors.gray[900],
  },
  eligibilityLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  eligibilityLoadingText: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  eligibilityMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
  },
  eligibilityText: {
    flex: 1,
    fontSize: 14,
    color: Colors.gradient.green,
    fontWeight: '500',
  },
  eligibilityTextNeutral: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray[600],
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
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gradient.yellow,
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
    borderColor: Colors.gray[300],
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.gradient.green,
    borderColor: Colors.gradient.green,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray[600],
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.gradient.green,
    textDecorationLine: 'underline',
  },
  foodSafetyContainer: {
    marginBottom: 16,
  },
  foodSafetyInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gradient.yellow,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  foodSafetyInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.gray[700],
    lineHeight: 18,
  },
  foodSafetyLink: {
    color: Colors.gradient.green,
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
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.gray[600],
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
    color: Colors.gray[900],
    marginTop: 24,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginTop: 16,
  },
  tagline: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 8,
  },
  emailConfirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emailIcon: {
    marginBottom: 24,
  },
  emailConfirmationTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 16,
    textAlign: 'center',
  },
  emailConfirmationText: {
    fontSize: 16,
    color: Colors.gray[700],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  emailConfirmationSubtext: {
    fontSize: 14,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  emailConfirmationActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  resendButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: Colors.gradient.purple,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.gradient.purple,
    alignItems: 'center',
  },
  backButtonText: {
    color: Colors.gradient.purple,
    fontSize: 16,
    fontWeight: '600',
  },
});