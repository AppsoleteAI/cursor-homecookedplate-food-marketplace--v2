import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Alert, Platform } from 'react-native';
import { useDebounce } from './useDebounce';
import { getPasswordStrengthScore } from '@/components/PasswordStrengthMeter';
import { useAuth } from './auth-context';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';

export interface UseSignupFormOptions {
  onSuccess?: (result: { requiresLogin: boolean; requiresCheckout?: boolean; needsEmailConfirmation?: boolean }) => void;
  onError?: (error: Error) => void;
}

export const useSignupForm = (options?: UseSignupFormOptions) => {
  const { signup } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'platetaker' as 'platemaker' | 'platetaker',
    agreedToTerms: false,
    foodSafetyAcknowledged: false,
  });

  const [loading, setLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupUserRole, setSignupUserRole] = useState<'platetaker' | 'platemaker' | null>(null);
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
      onSuccess: (data) => {
        setIsUsernameAvailable(data.available);
        setUsernameError(null);
      },
      onError: (error) => {
        setIsUsernameAvailable(null);
        // Check if it's a network/CORS error
        const isNetworkError = error.message?.includes('fetch') || 
                               error.message?.includes('CORS') ||
                               error.message?.includes('Network') ||
                               error.message?.includes('Failed to fetch');
        setUsernameError(isNetworkError ? 'Server unreachable. Check connection.' : 'Unable to check username.');
      },
    }
  );

  // Reset availability status and errors while typing
  useEffect(() => {
    if (formData.username !== debouncedUsername) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
    }
  }, [formData.username, debouncedUsername]);

  // 2. Trial Eligibility Check
  const checkEligibilityMutation = trpc.trials.checkEligibility.useMutation();
  const eligibilityQuery = trpc.auth.checkEligibility.useQuery(
    { lat: userLocation?.lat ?? 0, lng: userLocation?.lng ?? 0 },
    { enabled: !!userLocation && isMembershipEnabled }
  );

  const handleToggleMembership = useCallback(async (value: boolean) => {
    console.log('[Signup] Toggle membership:', value, 'Platform:', Platform.OS);
    
    setIsMembershipEnabled(value);
    
    if (!value) {
      setIsEligibleForTrial(false);
      setTrialMeta(null);
      setCheckingEligibility(false);
      return;
    }

    // On web, allow toggle but skip location check
    if (Platform.OS === 'web') {
      console.log('[Signup] Web platform - skipping location check');
      setIsEligibleForTrial(false);
      setTrialMeta(null);
      setCheckingEligibility(false);
      return;
    }

    setCheckingEligibility(true);
    setIsEligibleForTrial(false);
    setTrialMeta(null);

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        const message = 'We need your location to check if you qualify for the free trial. You can still sign up for premium after creating your account.';
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Location Permission Required', message);
        }
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
        role: formData.role,
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
      const message = 'Could not check trial eligibility. You can still sign up for premium after creating your account.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Location Error', message);
      }
      setIsEligibleForTrial(false);
      setTrialMeta(null);
      setIsMembershipEnabled(false);
    } finally {
      setCheckingEligibility(false);
    }
  }, [formData.role, checkEligibilityMutation]);

  // Clear error state when form data changes
  useEffect(() => {
    if (error && (formData.username || formData.email || formData.password)) {
      setError(null);
    }
  }, [formData.username, formData.email, formData.password, error]);

  // Clear error and retry count on unmount
  useEffect(() => {
    return () => {
      setError(null);
      setRetryCount(0);
    };
  }, []);

  // 3. Signup Handler
  const handleSignup = useCallback(async (isRetry = false) => {
    // Prevent double-taps
    if (loading) {
      console.log('[Signup] Sign-up blocked: Already in progress');
      return;
    }

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

    // Password strength check
    const passwordScore = getPasswordStrengthScore(formData.password);
    if (passwordScore < 5) {
      const message = 'Please ensure your password meets all requirements';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    // Username availability check
    if (isUsernameAvailable === false) {
      const message = 'Please choose a different username';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
      return;
    }

    setLoading(true);
    setError(null);
    console.log("[Signup] Mutating...", { isRetry, retryCount });
    
    // Add timeout for stuck network requests (15 seconds for signup)
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Request timed out. Please check your connection and try again.'));
      }, 15000);
    });

    try {
      const signupPromise = signup(
        formData.username, 
        cleanEmail, 
        formData.password, 
        formData.role, 
        userLocation || undefined, 
        formData.foodSafetyAcknowledged
      );

      const result = await Promise.race([signupPromise, timeoutPromise]);
      
      // Clear timeout if signup succeeds
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      console.log("[Signup] Success!", result);
      
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
            const paymentMessage = 'Please complete your payment to activate your premium membership. You\'ll be redirected back to the app after payment.';
            if (Platform.OS === 'web') {
              window.alert('Complete Payment: ' + paymentMessage);
            } else {
              Alert.alert('Complete Payment', paymentMessage, [{ text: 'OK' }]);
            }
            setLoading(false);
            return;
          }
        } catch (checkoutError: unknown) {
          const checkoutErrorMessage = checkoutError instanceof Error 
            ? checkoutError.message 
            : 'Failed to create checkout session. Please try again or contact support.';
          console.error('[Signup] Checkout session error:', checkoutError);
          if (Platform.OS === 'web') {
            window.alert('Payment Setup Error: ' + checkoutErrorMessage);
          } else {
            Alert.alert('Payment Setup Error', checkoutErrorMessage);
          }
          setLoading(false);
          return;
        }
      }
      
      // Success - reset retry count and error
      setRetryCount(0);
      setError(null);
      
      // Set animation state - this will trigger the success UI
      // Email confirmation is no longer blocking - users can sign in immediately
      setSignupUserRole(formData.role);
      setIsSigningUp(true);
      
      // Call success callback if provided
      // Note: needsEmailConfirmation is ignored - users can sign in immediately
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
    } catch (err: any) {
      // Clear timeout if error occurs
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Increment retry count
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
          const shouldRetry = window.confirm(alertMessage + '\n\nWould you like to retry?');
          if (shouldRetry) {
            handleSignup(true);
            return;
          }
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
      
      // Call error callback if provided
      if (options?.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setLoading(false);
    }
  }, [
    formData, 
    loading, 
    isUsernameAvailable, 
    userLocation, 
    signup, 
    options,
    retryCount,
    error
  ]);

  return {
    // Form data
    formData,
    setFormData,
    
    // Username checking
    isUsernameAvailable,
    isCheckingUsername: checkUsernameQuery.isFetching,
    usernameError,
    
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
    signupUserRole,
    
    // Error recovery
    error,
    retryCount,
    
    // Location
    userLocation,
  };
};
