import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthColors, preAppFont } from '@/constants/auth-palette';
import { AuthBackground, AuthBrand, AuthGoldButton, MaroonButtonFill } from '@/components/auth/AuthChrome';
import { BackCircle } from '@/components/BackCircle';
import { useWizardBack } from '@/hooks/use-leave-screen';
import { OrderHoursSlogan } from '@/components/OrderHoursSlogan';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { useSignupForm } from '@/hooks/useSignupForm';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { BUYER_AFTER_NOTE } from '@/lib/buyer-safety';
import { SUBSCRIPTION_PRICES } from '@/backend/lib/fees';
import { PLATEMAKER_LOST_DISPUTE_SIGNUP, PLATETAKER_LOST_DISPUTE_SIGNUP } from '@/backend/lib/payout-policy';
import { trpc } from '@/lib/trpc';
import { GlassPressable, GlassTop } from '@/components/glass-surface';

type Role = 'platetaker' | 'platemaker';
type MetroStatus = 'idle' | 'finding' | 'found' | 'outside' | 'denied' | 'failed';

const STEPS = ['Location', 'Account', 'Legal'];

function isRole(value: string | undefined): value is Role {
  return value === 'platetaker' || value === 'platemaker';
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ role?: string | string[]; step?: string | string[] }>();
  const roleParam = typeof params.role === 'string' ? params.role : undefined;
  const requestedStep = params.step === '1' || params.step === '2' ? Number(params.step) : 0;
  const [step, setStep] = useState(requestedStep);
  const [askRole, setAskRole] = useState(!isRole(roleParam));
  const [metroStatus, setMetroStatus] = useState<MetroStatus>('idle');
  const [metroName, setMetroName] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    formData,
    setFormData,
    setUserLocation,
    isUsernameAvailable,
    isCheckingUsername,
    usernameError,
    passwordScore,
    handleSignup,
    isLoading,
    isSigningUp,
    error,
    retryCount,
  } = useSignupForm();
  const stepBack = useWizardBack(step, setStep, isSigningUp || isLoading);

  const checkEligibility = trpc.trials.checkEligibility.useMutation();
  const { username, email, password, confirmPassword, role, agreedToTerms, foodSafetyAcknowledged } = formData;

  useEffect(() => {
    if (isRole(roleParam)) {
      setFormData((current) => ({ ...current, role: roleParam }));
      setAskRole(false);
    }
  }, [roleParam, setFormData]);

  const chooseRole = (next: Role) => {
    setFormData((current) => ({ ...current, role: next }));
    setAskRole(false);
    setPageError(null);
  };

  const findMetro = async () => {
    setPageError(null);
    setMetroStatus('finding');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setUserLocation(null);
        setMetroName(null);
        setMetroStatus('denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);

      const result = await checkEligibility.mutateAsync({
        lat: coords.lat,
        lng: coords.lng,
        role,
      });

      if (result.metro) {
        setMetroName(result.metro);
        setMetroStatus('found');
      } else {
        setMetroName(null);
        setMetroStatus('outside');
      }
    } catch (err) {
      console.error('[Onboarding] Metro lookup failed', err);
      setMetroStatus('failed');
    }
  };

  const continueFromMetro = () => {
    if (askRole) {
      setPageError('Choose how you will use HomeCookedPlate.');
      return;
    }
    setPageError(null);
    setStep(1);
  };

  const continueFromAccount = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!username || !email || !password || !confirmPassword) {
      setPageError('Fill in your username, email, and password.');
      return;
    }
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setPageError('Check the email for spaces or typos.');
      return;
    }
    if (password !== confirmPassword) {
      setPageError('Passwords do not match.');
      return;
    }
    if (passwordScore < 5) {
      setPageError('Password still needs every requirement below.');
      return;
    }
    if (isUsernameAvailable === false) {
      setPageError('Choose a different username.');
      return;
    }
    setPageError(null);
    setStep(2);
  };

  if (isSigningUp) {
    const maker = role === 'platemaker';
    const takerMonthly = SUBSCRIPTION_PRICES.PLATETAKER_MONTHLY.toFixed(2);
    const takerYearly = SUBSCRIPTION_PRICES.PLATETAKER_ANNUAL.toFixed(2);
    return (
      <AuthBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={72} color={AuthColors.maroon} />
            <Text style={styles.successTitle}>Account created</Text>
            <Text style={styles.successText}>
              {maker
                ? 'Choose Early Bird or a membership before the kitchen opens. Early Bird does not charge a card.'
                : `The app is free. Premium is optional: $${takerMonthly} a month or $${takerYearly} a year. It cuts the service fee from 10% to 5% on orders of $20 or more.`}
            </Text>
            <Pressable
              onPress={() => router.push('/membership')}
              testID={maker ? 'signup-choose-membership' : 'signup-see-membership'}
              accessibilityRole="button"
              style={styles.successButton}
            >
              <MaroonButtonFill />
              <Text style={styles.successButtonText}>{maker ? 'Choose Membership' : 'See Membership'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </AuthBackground>
    );
  }

  const metroQuestion = 'Where do you enjoy plates?';
  const roleLine = role === 'platemaker' ? 'Cooking' : 'Ordering plates';

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step > 0 && !isSigningUp && !isLoading ? (
              <BackCircle
                tone="honey"
                onPress={() => {
                  setPageError(null);
                  stepBack();
                }}
                testID="onboarding-back"
              />
            ) : null}

            <AuthBrand />
            <View style={styles.steps}>
              {STEPS.map((label, index) => (
                <View key={label} style={styles.stepItem}>
                  <View style={[styles.stepDot, index <= step && styles.stepDotOn]} />
                  <Text style={[styles.stepLabel, index === step && styles.stepLabelOn]}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sheet}>
              <View style={styles.panel}>
                <GlassTop />
                {step === 0 ? (
                  <>
                    <Text style={styles.panelTitle}>Your Location</Text>
                    {askRole ? (
                      <>
                        <OrderHoursSlogan style={{ color: AuthColors.ink, marginBottom: 8 }} />
                        <Text style={styles.question}>How will you use HomeCookedPlate?</Text>
                        <View style={styles.roleRow}>
                          <GlassPressable
                            style={styles.roleChoice}
                            onPress={() => chooseRole('platetaker')}
                            accessibilityRole="button"
                            accessibilityLabel="Order a plate"
                          >
                            <Text style={styles.roleChoiceText}>Order a Plate</Text>
                          </GlassPressable>
                          <GlassPressable
                            style={styles.roleChoice}
                            onPress={() => chooseRole('platemaker')}
                            accessibilityRole="button"
                            accessibilityLabel="Start cooking"
                          >
                            <Text style={styles.roleChoiceText}>Start Cooking</Text>
                          </GlassPressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <GlassPressable
                          onPress={() => setAskRole(true)}
                          style={styles.roleLine}
                          accessibilityRole="button"
                          accessibilityLabel="Change role"
                        >
                          <Text style={styles.roleLineText}>{roleLine}</Text>
                          <Text style={styles.roleChange}>Change</Text>
                        </GlassPressable>
                        <Text style={styles.question}>{metroQuestion}</Text>
                        <Text style={styles.help}>
                          Your location determines your options. Sign up today.
                          {role === 'platemaker' ? ' Early Bird eligibility is limited.' : ''}
                        </Text>
                        {metroStatus === 'found' && metroName ? (
                          <Text style={styles.metroResult}>You are in {metroName}.</Text>
                        ) : null}
                        {metroStatus === 'outside' ? (
                          <Text style={styles.metroResult}>
                            {role === 'platemaker'
                              ? 'You are outside an active location. The account will be Remote, and Early Bird is not available here.'
                              : 'You are outside an active location. The account will be Remote.'}
                          </Text>
                        ) : null}
                        {metroStatus === 'denied' ? (
                          <Text style={styles.metroResult}>
                            Location is off. You can still create an account. Your location is saved when it is available.
                          </Text>
                        ) : null}
                        {metroStatus === 'failed' ? (
                          <Text style={styles.errorText}>
                            Could not look up your location. A Mac or Windows computer has no GPS, so Location Services must be on and this browser allowed. On iPhone or Android, allow location for the app. An editor preview usually has no position. You can continue and try again later.
                          </Text>
                        ) : null}
                        <AuthGoldButton
                          title={
                            metroStatus === 'finding'
                              ? 'Finding your location'
                              : metroStatus === 'idle'
                                ? 'Find my location'
                                : 'Continue'
                          }
                          onPress={metroStatus === 'idle' || metroStatus === 'finding' ? findMetro : continueFromMetro}
                          loading={metroStatus === 'finding'}
                          testID="onboarding-find-metro"
                          style={styles.action}
                        />
                        {metroStatus !== 'idle' ? (
                          <GlassPressable onPress={findMetro} disabled={metroStatus === 'finding'}>
                            <Text style={styles.continueText}>Check Again</Text>
                          </GlassPressable>
                        ) : (
                          <GlassPressable onPress={continueFromMetro} testID="onboarding-metro-continue">
                            <Text style={styles.continueText}>Continue Without a Location</Text>
                          </GlassPressable>
                        )}
                      </>
                    )}
                  </>
                ) : null}

                {step === 1 ? (
                  <>
                    <Text style={styles.panelTitle}>Your Account</Text>
                    <Field
                      icon="person-outline"
                      placeholder="Username"
                      value={username}
                      onChangeText={(text) => setFormData((current) => ({ ...current, username: text }))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                      testID="onboarding-username"
                    />
                    {username.length >= 3 ? (
                      <Text style={styles.hint}>
                        {isCheckingUsername
                          ? 'Checking username...'
                          : usernameError
                            ? usernameError
                            : isUsernameAvailable === true
                              ? 'Username available'
                              : isUsernameAvailable === false
                                ? 'Username taken'
                                : ''}
                      </Text>
                    ) : null}
                    <Field
                      icon="mail-outline"
                      placeholder="Email"
                      value={email}
                      onChangeText={(text) => setFormData((current) => ({ ...current, email: text }))}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      testID="onboarding-email"
                    />
                    <Field
                      icon="lock-closed-outline"
                      placeholder="Password"
                      value={password}
                      onChangeText={(text) => setFormData((current) => ({ ...current, password: text }))}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      testID="onboarding-password"
                      onToggleSecure={() => setShowPassword((current) => !current)}
                      secureVisible={showPassword}
                    />
                    {password.length > 0 ? <PasswordStrengthMeter password={password} /> : null}
                    <Field
                      icon="lock-closed-outline"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChangeText={(text) => setFormData((current) => ({ ...current, confirmPassword: text }))}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      testID="onboarding-confirm-password"
                      onToggleSecure={() => setShowConfirmPassword((current) => !current)}
                      secureVisible={showConfirmPassword}
                    />
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <Text style={styles.panelTitle}>Legal & Safety</Text>
                    <Text style={styles.help}>
                      Both acknowledgements are required before the account is created. The full text is on Legal & Safety.
                    </Text>
                    <Text style={styles.help}>
                      {role === 'platemaker' ? PLATEMAKER_LOST_DISPUTE_SIGNUP : PLATETAKER_LOST_DISPUTE_SIGNUP}
                    </Text>
                    <CheckRow
                      checked={agreedToTerms}
                      onPress={() => setFormData((current) => ({ ...current, agreedToTerms: !current.agreedToTerms }))}
                      testID="onboarding-terms"
                    >
                      <Text style={styles.agreeText}>
                        I agree to the{' '}
                        <Text style={styles.agreeLink} onPress={() => router.push('/legal')}>
                          Terms & Conditions
                        </Text>
                        {' '}and understand the legal disclaimers.
                      </Text>
                    </CheckRow>
                    <View style={styles.notice}>
                      <Text style={styles.checkText}>
                        Ingredients and allergens are listed by the cook. Tell them about your allergies before you order. If something looks or smells wrong at pickup, do not eat it.
                      </Text>
                      <Text style={[styles.checkText, { marginTop: 8 }]}>
                        Meet in a public place during daylight. Do not exchange phone numbers in the app. If a prepaid delivery is agreed upon, we suggest the cook brings someone else along, for safety.
                      </Text>
                      <Text style={[styles.checkText, { marginTop: 8 }]}>
                        {BUYER_AFTER_NOTE}
                      </Text>
                      <FoodHandlingLink returnTo={`/onboarding?step=2${role ? `&role=${role}` : ''}`} />
                    </View>
                    <CheckRow
                      checked={foodSafetyAcknowledged}
                      onPress={() =>
                        setFormData((current) => ({
                          ...current,
                          foodSafetyAcknowledged: !current.foodSafetyAcknowledged,
                        }))
                      }
                      testID="onboarding-food-safety"
                    >
                      <Text style={styles.agreeText}>
                        I understand these safety notes. I will check the ingredients, meet in a public place during daylight, and eat the food promptly.
                      </Text>
                    </CheckRow>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    {error && retryCount < 3 ? (
                      <GlassPressable onPress={() => handleSignup(true)} disabled={isLoading}>
                        <Text style={styles.link}>Try Again</Text>
                      </GlassPressable>
                    ) : null}
                  </>
                ) : null}

                {pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}

                {step === 1 ? (
                  <AuthGoldButton
                    title="Continue"
                    onPress={continueFromAccount}
                    testID="onboarding-account-continue"
                    style={styles.action}
                  />
                ) : null}

                {step === 2 ? (
                  <AuthGoldButton
                    title="Create account"
                    onPress={() => handleSignup(false)}
                    loading={isLoading}
                    disabled={!agreedToTerms || !foodSafetyAcknowledged || passwordScore < 5 || isUsernameAvailable === false}
                    testID="onboarding-create"
                    style={styles.action}
                  />
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

function Field({
  icon,
  onToggleSecure,
  secureVisible,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  icon: keyof typeof Ionicons.glyphMap;
  onToggleSecure?: () => void;
  secureVisible?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={AuthColors.maroon} />
      <TextInput
        {...inputProps}
        placeholderTextColor={AuthColors.placeholder}
        style={styles.input}
      />
      {onToggleSecure ? (
        <GlassPressable onPress={onToggleSecure} accessibilityRole="button">
          <Ionicons
            name={secureVisible ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={AuthColors.maroon}
          />
        </GlassPressable>
      ) : null}
    </View>
  );
}

function CheckRow({
  checked,
  onPress,
  children,
  testID,
}: {
  checked: boolean;
  onPress: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      style={styles.checkRow}
      onPress={onPress}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Ionicons name="checkmark" size={14} color={AuthColors.ink} /> : null}
      </View>
      {children}
    </Pressable>
  );
}

const cardShadow = {
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.36)',
  shadowColor: '#461C06',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.22,
  shadowRadius: 14,
  elevation: 5,
} as const;

const styles = StyleSheet.create({
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
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginBottom: 16,
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(20, 16, 12, 0.28)',
  },
  stepDotOn: {
    backgroundColor: AuthColors.gold,
  },
  stepLabel: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  stepLabelOn: {
    color: AuthColors.ink,
  },
  sheet: {
    backgroundColor: 'transparent',
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
    ...cardShadow,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  panelTitle: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 14,
  },
  question: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  help: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 14,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChoice: {
    flex: 1,
    backgroundColor: AuthColors.white,
    borderWidth: 1,
    borderColor: '#C9A24A',
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  roleChoiceText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  roleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  roleLineText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 15,
    fontWeight: '400',
  },
  roleChange: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '600',
  },
  metroResult: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 12,
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
    ...preAppFont,
    flex: 1,
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 0,
  },
  hint: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 12,
    fontWeight: '400',
    marginTop: -6,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AuthColors.white,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: AuthColors.brand,
  },
  checkText: {
    ...preAppFont,
    flex: 1,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  agreeText: {
    ...preAppFont,
    flex: 1,
    color: AuthColors.white,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  agreeLink: {
    ...preAppFont,
    color: AuthColors.white,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  link: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontWeight: '600',
  },
  notice: {
    borderWidth: 1,
    borderColor: 'rgba(72, 16, 30, 0.35)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  noticeNote: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  errorText: {
    ...preAppFont,
    color: AuthColors.error,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 10,
  },
  action: {
    marginTop: 8,
  },
  continueText: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
  },
  success: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  successTitle: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 8,
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  successButton: {
    minWidth: 220,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  successButtonText: {
    ...preAppFont,
    color: AuthColors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  successText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
});
