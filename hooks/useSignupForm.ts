import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';
import { Alert, Platform } from 'react-native';
import { useDebounce } from './useDebounce';
import { getPasswordStrengthScore, passwordMeetsRules } from '@/components/PasswordStrengthMeter';
import { useAuth } from './auth-context';
import { readDeviceCoordinates } from '@/lib/device-coordinates';

type SignupFormData = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'platemaker' | 'platetaker';
  agreedToTerms: boolean;
  foodSafetyAcknowledged: boolean;
};

type SignupDraft = {
  username: string;
  email: string;
  role: 'platemaker' | 'platetaker';
};

const emptySignupForm = (): SignupFormData => ({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'platetaker',
  agreedToTerms: false,
  foodSafetyAcknowledged: false,
});

function draftFromForm(form: SignupFormData): SignupDraft {
  return {
    username: form.username,
    email: form.email,
    role: form.role,
  };
}

let signupDraft: SignupDraft | null = null;

export function clearSignupDraft() {
  signupDraft = null;
}

export interface UseSignupFormOptions {
  initialRole?: 'platemaker' | 'platetaker';
  onSuccess?: (result: { requiresLogin: boolean; requiresCheckout?: boolean; chooseMembership?: boolean; needsEmailConfirmation?: boolean; confirmationEmailSent?: boolean; metro?: string }) => void;
  onError?: (error: Error) => void;
}

export const useSignupForm = (options?: UseSignupFormOptions) => {
  const { signup } = useAuth();
  
  const [formData, setFormData] = useState<SignupFormData>(() => {
    const form = emptySignupForm();
    if (signupDraft) {
      form.username = signupDraft.username;
      form.email = signupDraft.email;
      form.role = signupDraft.role;
    }
    if (options?.initialRole === 'platemaker' || options?.initialRole === 'platetaker') {
      form.role = options.initialRole;
    }
    return form;
  });

  useEffect(() => {
    signupDraft = draftFromForm(formData);
  }, [formData]);

  const [loading, setLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [signupUserRole, setSignupUserRole] = useState<'platetaker' | 'platemaker' | null>(null);
  const [signupMetro, setSignupMetro] = useState<string | null>(null);
  const [chooseMembership, setChooseMembership] = useState(false);
  const [isMembershipEnabled, setIsMembershipEnabled] = useState(false);
  const [isEligibleForTrial, setIsEligibleForTrial] = useState(false);
  const [trialMeta, setTrialMeta] = useState<{ metro: string; spotsRemaining: number } | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // 1. Username Availability Logic
  const debouncedUsername = useDebounce(formData.username, 500);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const checkUsernameQuery = trpc.auth.checkUsername.useQuery(
    { username: debouncedUsername },
    { 
      enabled: debouncedUsername.length >= 3,
      retry: false, // Stop infinite "checking..." on CORS/network errors
    }
  );

  useEffect(() => {
    if (!checkUsernameQuery.data) return;
    setIsUsernameAvailable(checkUsernameQuery.data.available);
    setUsernameError(null);
  }, [checkUsernameQuery.data]);

  useEffect(() => {
    const queryError = checkUsernameQuery.error;
    if (!queryError) return;
    setIsUsernameAvailable(null);
    const isNetworkError = queryError.message?.includes('fetch') ||
                           queryError.message?.includes('CORS') ||
                           queryError.message?.includes('Network') ||
                           queryError.message?.includes('Failed to fetch');
    setUsernameError(isNetworkError ? 'Server unreachable. Check connection.' : 'Unable to check username.');
  }, [checkUsernameQuery.error]);

  // Reset availability status and errors while typing
  useEffect(() => {
    if (formData.username !== debouncedUsername) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
    }
  }, [formData.username, debouncedUsername]);

  // 2. Trial Eligibility Check
  const checkEligibilityMutation = trpc.trials.checkEligibility.useMutation();

  const handleToggleMembership = useCallback(async (value: boolean) => {
    console.log('[Signup] Toggle membership:', value, 'Platform:', Platform.OS);
    
    setIsMembershipEnabled(value);
    
    if (!value) {
      setIsEligibleForTrial(false);
      setTrialMeta(null);
      setCheckingEligibility(false);
      return;
    }

    setCheckingEligibility(true);
    setIsEligibleForTrial(false);
    setTrialMeta(null);

    try {
      const read = await readDeviceCoordinates(true);
      if (read.status !== 'ready') {
        const message = read.status === 'denied'
          ? 'Location is off. Allow it, then try again. You can still sign up and check the metro later.'
          : read.status === 'imprecise'
            ? 'This reading is not precise enough. Allow precise location, then try again.'
            : 'This device could not read a location. You can still sign up and check the metro later.';
        Alert.alert('Location', message);
        setIsMembershipEnabled(false);
        setCheckingEligibility(false);
        return;
      }

      setUserLocation(read.point);

      const result = await checkEligibilityMutation.mutateAsync({
        lat: read.point.lat,
        lng: read.point.lng,
        role: formData.role,
      });

      if (result.eligible && result.metro) {
        setIsEligibleForTrial(true);
        setTrialMeta({
          metro: result.metro,
          spotsRemaining: result.spotsRemaining,
        });
      } else if (result.metro) {
        setIsEligibleForTrial(false);
        setTrialMeta({
          metro: result.metro,
          spotsRemaining: result.spotsRemaining,
        });
      } else {
        setIsEligibleForTrial(false);
        setTrialMeta(null);
      }
    } catch (error) {
      console.error('[Signup] Eligibility check error:', error);
      const message = 'Could not check trial eligibility. You can still sign up for premium after creating your account.';
      Alert.alert('Location Error', message);
      setIsEligibleForTrial(false);
      setTrialMeta(null);
      setIsMembershipEnabled(false);
    } finally {
      setCheckingEligibility(false);
    }
  }, [formData.role, checkEligibilityMutation]);

  const errorFieldsRef = useRef<string | null>(null);
  const fieldKey = `${formData.username}\n${formData.email}\n${formData.password}`;
  useEffect(() => {
    if (!error) {
      errorFieldsRef.current = null;
      return;
    }
    if (errorFieldsRef.current === null) {
      errorFieldsRef.current = fieldKey;
      return;
    }
    if (errorFieldsRef.current !== fieldKey) {
      setError(null);
    }
  }, [error, fieldKey]);

  // Clear error and retry count on unmount
  useEffect(() => {
    return () => {
      setError(null);
      setRetryCount(0);
    };
  }, []);

  const signupInFlight = useRef(false);
  const usernameNotReady =
    formData.username.trim().length < 3 ||
    formData.username !== debouncedUsername ||
    checkUsernameQuery.isFetching ||
    isUsernameAvailable === false;

  const confirmUsername = useCallback(async (): Promise<string | null> => {
    if (formData.username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (formData.username !== debouncedUsername || checkUsernameQuery.isFetching) {
      return 'Wait until the username check finishes.';
    }
    if (isUsernameAvailable === true) return null;
    if (isUsernameAvailable === false) return 'Please choose a different username.';
    const again = await checkUsernameQuery.refetch();
    if (again.data?.available === true) return null;
    if (again.data?.available === false) return 'Please choose a different username.';
    return 'Username could not be checked. Try again before creating the account.';
  }, [formData.username, debouncedUsername, checkUsernameQuery, isUsernameAvailable]);

  // 3. Signup Handler
  const handleSignup = useCallback(async (isRetry = false) => {
    if (signupInFlight.current || loading) {
      console.log('[Signup] Sign-up blocked: Already in progress');
      return;
    }
    signupInFlight.current = true;
    let retryAfter = false;
    try {
    // Prevent excessive retries (max 3 attempts)
    if (retryCount >= 3 && !isRetry) {
      const message = 'Too many signup attempts. Please wait a moment before trying again.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Too Many Attempts', message);
      }
      return;
    }

    console.log('[Signup] Sign-up triggered', { 
      username: formData.username, 
      email: formData.email, 
      hasPassword: !!formData.password, 
      role: formData.role, 
      agreedToTerms: formData.agreedToTerms, 
      isMembershipEnabled 
    });
    
    // Validation checks
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      const message = 'Please fill in all fields';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      const message = 'Passwords do not match';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    if (!formData.agreedToTerms) {
      const message = 'Please agree to the terms and conditions';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    // Food safety acknowledgment is REQUIRED for ALL users
    if (!formData.foodSafetyAcknowledged) {
      const message = 'Please acknowledge the food safety requirements before creating your account';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    // Sanitize email input
    const cleanEmail = formData.email.trim().toLowerCase();
    
    // Pre-flight validation with regex
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      const message = 'Please check for hidden spaces or typos in: ' + cleanEmail;
      if (Platform.OS === 'web') {
        window.alert('Invalid Email: ' + message);
      } else {
        Alert.alert('Invalid Email', message);
      }
      return;
    }

    if (!passwordMeetsRules(formData.password)) {
      const message = 'Please ensure your password meets all requirements';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    const usernameMessage = await confirmUsername();
    if (usernameMessage) {
      if (Platform.OS === 'web') {
        window.alert(usernameMessage);
      } else {
        Alert.alert('Error', usernameMessage);
      }
      return;
    }

    setLoading(true);
    setError(null);
    console.log("[Signup] Mutating...", { isRetry, retryCount });

    try {
      let location = userLocation;
      if (!location) {
        const read = await readDeviceCoordinates(true);
        if (read.status === 'ready') {
          location = read.point;
          setUserLocation(read.point);
        }
      }

      const result = await signup(
        formData.username,
        cleanEmail,
        formData.password,
        formData.role,
        location || undefined,
        formData.foodSafetyAcknowledged
      );

      console.log("[Signup] Success!", result);

      // Success - reset retry count and error
      setRetryCount(0);
      setError(null);
      
      // Set animation state - this will trigger the success UI
      setSignupUserRole(formData.role);
      setSignupMetro(typeof result.metro === 'string' ? result.metro : null);
      setChooseMembership(formData.role === 'platemaker' || result.chooseMembership === true);
      setConfirmationEmailSent(result.confirmationEmailSent === true);
      clearSignupDraft();
      AsyncStorage.setItem('hcp_has_account', '1').catch(() => undefined);
      setIsSigningUp(true);

      // Call success callback if provided. Login stays closed until the email link is confirmed.
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
    } catch (err: any) {
      if (!isRetry) {
        setRetryCount(prev => prev + 1);
      }
      
      const errorMessage = err.message || 'Failed to create account. Please try again.';
      
      console.error('[Signup] Signup error:', err);
      console.error('[Signup] Error message:', errorMessage);
      
      // Detect network errors
      const isNetworkError = errorMessage.includes('fetch') || 
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Failed to fetch');
      
      // Set error state
      setError(errorMessage);
      
      // Show alert with retry option if not max retries
      if (retryCount < 2) {
        const alertMessage = isNetworkError 
          ? 'Network error. Please check your connection and try again.'
          : errorMessage;
        
        if (Platform.OS === 'web') {
          retryAfter = window.confirm(alertMessage + '\n\nWould you like to retry?');
        } else {
          Alert.alert('Signup Issue', alertMessage, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => handleSignup(true) },
          ]);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert('Signup Issue: ' + errorMessage);
        } else {
          Alert.alert('Signup Issue', errorMessage);
        }
      }
      
      setIsSigningUp(false);
      setSignupUserRole(null);
      setSignupMetro(null);
      
      // Call error callback if provided
      if (options?.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setLoading(false);
    }
    } finally {
      signupInFlight.current = false;
      if (retryAfter) void handleSignup(true);
    }
  }, [
    formData,
    loading,
    userLocation,
    signup,
    options,
    retryCount,
    isMembershipEnabled,
    confirmUsername,
  ]);

  return {
    // Form data
    formData,
    setFormData,
    
    // Username checking
    isUsernameAvailable,
    isCheckingUsername: checkUsernameQuery.isFetching,
    usernameError,
    usernameNotReady,
    confirmUsername,
    
    // Password strength
    passwordScore: getPasswordStrengthScore(formData.password),
    
    // Membership & trial
    isMembershipEnabled,
    setIsMembershipEnabled,
    handleToggleMembership,
    isEligibleForTrial,
    trialMeta,
    checkingEligibility,
    
    // Signup
    handleSignup,
    isLoading: loading,
    isSigningUp,
    confirmationEmailSent,
    signupUserRole,
    signupMetro,
    chooseMembership,
    
    // Error recovery
    error,
    retryCount,
    
    // Location
    userLocation,
    setUserLocation,
  };
};
