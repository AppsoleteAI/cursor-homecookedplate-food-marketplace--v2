import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
  Image,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { Colors } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { trpc } from '@/lib/trpc';
import { supabase } from '@/lib/supabase';
import { MetroProgressBar } from '@/components/Registration/MetroProgressBar';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'platemaker' | 'platetaker'>('platetaker');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [foodSafetyAcknowledged, setFoodSafetyAcknowledged] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupUserRole, setSignupUserRole] = useState<'platetaker' | 'platemaker' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isMembershipEnabled, setIsMembershipEnabled] = useState(false);
  const [isEligibleForTrial, setIsEligibleForTrial] = useState(false);
  const [trialMeta, setTrialMeta] = useState<{ metro: string; spotsRemaining: number } | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { signup } = useAuth();
  const checkEligibilityMutation = trpc.trials.checkEligibility.useMutation();
  // Checkout is handled via Supabase Edge Function `create-checkout-session` (replaces tRPC route)
  
  // Simple eligibility check query (no quotas, just metro check)
  const eligibilityQuery = trpc.auth.checkEligibility.useQuery(
    { lat: userLocation?.lat ?? 0, lng: userLocation?.lng ?? 0 },
    { enabled: !!userLocation && isMembershipEnabled }
  );
  
  // Animation value for rotation
  const rotationValue = useRef(new Animated.Value(0)).current;

  // Complete any pending auth session for native redirects
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // Animation effect - triggers when isSigningUp becomes true
  useEffect(() => {
    if (!isSigningUp || !signupUserRole) return;

    const isPlatetaker = signupUserRole === 'platetaker';
    const finalRotation = isPlatetaker ? 1440 : -1440; // 4 full rotations

    // Reset rotation value
    rotationValue.setValue(0);

    // Two-phase animation: slow then fast
    const animation = Animated.sequence([
      // Slow phase: 0 to 720 degrees over 2000ms
      Animated.timing(rotationValue, {
        toValue: isPlatetaker ? 720 : -720,
        duration: 2000,
        easing: Easing.out(Easing.quad), // Slow start
        useNativeDriver: true,
      }),
      // Fast phase: 720 to 1440 degrees over 2000ms
      Animated.timing(rotationValue, {
        toValue: finalRotation,
        duration: 2000,
        easing: Easing.in(Easing.quad), // Fast end
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        // Navigate to login after animation - user needs to login after signup
        // (Backend uses admin.createUser which doesn't return a session)
        Alert.alert(
          'Account Created!',
          'Your account has been created successfully. Please sign in to continue.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    });

    return () => {
      animation.stop();
    };
  }, [isSigningUp, signupUserRole, rotationValue]);

  // Create interpolated rotation string (handles both positive and negative rotations)
  const spin = rotationValue.interpolate({
    inputRange: [-1440, 1440],
    outputRange: ['-1440deg', '1440deg'],
    extrapolate: 'clamp',
  });

  // If showing animation, render the spinning logo
  if (isSigningUp) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.white, Colors.gray[50]]}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.animationContainer}>
            <Animated.View
              style={[
                styles.animatedLogoContainer,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.animatedLogo}
                resizeMode="contain"
              />
            </Animated.View>
            <Text style={styles.appName}>HomeCookedPlate</Text>
            <Text style={styles.tagline}>Authentic PlateMaker Meals</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleToggleMembership = async (value: boolean) => {
    setIsMembershipEnabled(value);
    
    if (!value) {
      // Reset eligibility state when toggled off
      setIsEligibleForTrial(false);
      setTrialMeta(null);
      return;
    }

    // Request location permission and check eligibility
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available',
        'Location detection is only available on mobile devices. Premium membership will be available after signup.'
      );
      setIsMembershipEnabled(false);
      return;
    }

    setCheckingEligibility(true);
    setIsEligibleForTrial(false);
    setTrialMeta(null);

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'We need your location to check if you qualify for the free trial. You can still sign up for premium after creating your account.'
        );
        setIsMembershipEnabled(false);
        setCheckingEligibility(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Store location for eligibility query
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      // Check eligibility via backend (with quota check)
      const result = await checkEligibilityMutation.mutateAsync({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        role: role,
      });

      if (result.eligible && result.metro) {
        setIsEligibleForTrial(true);
        setTrialMeta({
          metro: result.metro,
          spotsRemaining: result.spotsRemaining,
        });
      } else {
        setIsEligibleForTrial(false);
        setTrialMeta({
          metro: result.metro || null,
          spotsRemaining: result.spotsRemaining,
        });
      }
    } catch (error) {
      console.error('[Signup] Eligibility check error:', error);
      Alert.alert(
        'Location Error',
        'Could not check trial eligibility. You can still sign up for premium after creating your account.'
      );
      setIsEligibleForTrial(false);
      setTrialMeta(null);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleSignup = async () => {
    console.log('Sign-up triggered');
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Error', 'Please agree to the terms and conditions');
      return;
    }

    if (role === 'platemaker' && !foodSafetyAcknowledged) {
      Alert.alert('Error', 'Please acknowledge the food safety requirements before signing up as a Platemaker');
      return;
    }

    // Sanitize email input
    const cleanEmail = email.trim().toLowerCase();
    
    // Pre-flight validation with regex
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Invalid Email', 'Please check for hidden spaces or typos in: ' + cleanEmail);
      return;
    }

    setLoading(true);
    // #region agent log - HYPOTHESIS 1, 2, 4: Frontend signup attempt
    fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(auth)/signup.tsx:SIGNUP_ATTEMPT',message:'Frontend signup attempt started',data:{username,cleanEmail,hasPassword:!!password,role},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'1,2,4'})}).catch(()=>{});
    // #endregion
    try {
      const result = await signup(username, cleanEmail, password, role, userLocation || undefined, role === 'platemaker' ? foodSafetyAcknowledged : false);
      // #region agent log - HYPOTHESIS 1, 2, 4: Frontend signup success
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(auth)/signup.tsx:SIGNUP_SUCCESS',message:'Frontend signup succeeded',data:{username,cleanEmail,role,requiresLogin:result.requiresLogin,requiresCheckout:result.requiresCheckout},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'1,2,4'})}).catch(()=>{});
      // #endregion
      
      // If Remote/Over-cap user requires checkout, redirect to Stripe checkout
      if (result.requiresCheckout) {
        try {
          const { data: checkoutResult, error: checkoutError } = await supabase.functions.invoke(
            'create-checkout-session',
            {
              body: { returnUrl: 'homecookedplate://payment-success' },
            }
          );

          if (checkoutError) {
            throw checkoutError;
          }

          if (checkoutResult.checkoutUrl) {
            // Open Stripe Hosted Checkout in browser
            await WebBrowser.openBrowserAsync(checkoutResult.checkoutUrl);
            // User will be redirected back to app after payment
            // The webhook will upgrade their membership_tier to premium
            Alert.alert(
              'Complete Payment',
              'Please complete your payment to activate your premium membership. You\'ll be redirected back to the app after payment.',
              [{ text: 'OK' }]
            );
            setLoading(false);
            return;
          }
        } catch (checkoutError: unknown) {
          const checkoutErrorMessage = checkoutError instanceof Error 
            ? checkoutError.message 
            : 'Failed to create checkout session. Please try again or contact support.';
          console.error('[Signup] Checkout session error:', checkoutError);
          Alert.alert('Payment Setup Error', checkoutErrorMessage);
          setLoading(false);
          return;
        }
      }
      
      // Set animation state - this will trigger the animation effect
      // The animation will redirect based on requiresLogin flag
      setSignupUserRole(role);
      setIsSigningUp(true);
    } catch (error: unknown) {
      // #region agent log - HYPOTHESIS 1, 2, 4: Frontend signup error
      const errorDetails = error instanceof Error ? {message:error.message,name:error.name,stack:error.stack?.substring(0,200)} : {message:'Unknown error',rawError:String(error)};
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(auth)/signup.tsx:SIGNUP_ERROR',message:'Frontend signup error caught',data:{...errorDetails,username,cleanEmail,role},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'1,2,4'})}).catch(()=>{});
      // #endregion
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      Alert.alert('Error', errorMessage);
      setIsSigningUp(false);
      setSignupUserRole(null);
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community of food lovers</Text>

            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>I want to:</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'platetaker' && styles.roleButtonActive,
                    role === 'platetaker' && styles.roleButtonActivePlatetaker,
                  ]}
                  onPress={() => setRole('platetaker')}
                >
                  <Ionicons
                    name="bag-outline"
                    size={20}
                    color={role === 'platetaker' ? Colors.white : Colors.gray[600]}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      role === 'platetaker' && styles.roleButtonTextActive,
                    ]}
                  >
                    Order Food
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'platemaker' && styles.roleButtonActive,
                    role === 'platemaker' && styles.roleButtonActivePlatemaker,
                  ]}
                  onPress={() => setRole('platemaker')}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={20}
                    color={role === 'platemaker' ? Colors.white : Colors.gray[600]}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      role === 'platemaker' && styles.roleButtonTextActive,
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
                    role={role}
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
                  style={styles.input}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
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
                onPress={() => setAgreedToTerms(!agreedToTerms)}
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

              {role === 'platemaker' && (
                <View style={styles.foodSafetyContainer}>
                  <View style={styles.foodSafetyInfoBox}>
                    <Ionicons name="information-circle" size={20} color={Colors.gradient.yellow} />
                    <Text style={styles.foodSafetyInfoText}>
                      We recommend every Platemaker review{' '}
                      <Text
                        style={styles.foodSafetyLink}
                        onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
                      >
                        cottagefoodlaws.com
                      </Text>
                      {' '}and do your due diligence to meet all food safety requirements from your local, county, state and federal laws before selling food items.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.termsContainer}
                    onPress={() => setFoodSafetyAcknowledged(!foodSafetyAcknowledged)}
                  >
                    <View style={[styles.checkbox, foodSafetyAcknowledged && styles.checkboxActive]}>
                      {foodSafetyAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.termsText}>
                      I acknowledge that I have reviewed cottagefoodlaws.com and understand that I must comply with all local, county, state and federal food laws. I understand that HomeCookedPlate does not allow anyone to violate their local, county, state and/or federal food laws on the HomeCookedPlate App.
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <GradientButton
                title="Create Account"
                onPress={handleSignup}
                loading={loading}
                disabled={!agreedToTerms || (role === 'platemaker' && !foodSafetyAcknowledged)}
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
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  animatedLogoContainer: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  animatedLogo: {
    width: 150,
    height: 150,
    borderRadius: 24,
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
});