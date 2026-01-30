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
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { Colors } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<'buyer' | 'seller' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { login } = useAuth();
  const modeParam = typeof params.mode === 'string' ? params.mode : undefined;
  const lockedMode = modeParam === 'buyer' || modeParam === 'seller';
  useInitLoginMode(setUserType, modeParam);

  // Complete any pending auth session for native redirects
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // Clear error state on unmount or when inputs change
  useEffect(() => {
    return () => {
      setError(null);
      setRetryCount(0);
    };
  }, []);

  useEffect(() => {
    // Clear error when user starts typing
    if (error && (username || password)) {
      setError(null);
    }
  }, [username, password, error]);

  const handleLogin = async (isRetry = false) => {
    console.log('Sign-in triggered', { isRetry, retryCount });
    
    if (!userType) {
      Alert.alert('Error', 'Please select a user type (PlateTaker or PlateMaker)');
      return;
    }
    
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    // Sanitize email input
    const cleanEmail = username.trim().toLowerCase();
    
    // Pre-flight validation with regex
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Invalid Email', 'Please check for hidden spaces or typos in: ' + cleanEmail);
      return;
    }

    // Prevent excessive retries (max 3 attempts)
    if (retryCount >= 3 && !isRetry) {
      Alert.alert('Too Many Attempts', 'Please wait a moment before trying again.');
      return;
    }

    // Debug log to see what backend receives
    console.log('Final Sanitize Check:', cleanEmail);

    setLoading(true);
    setError(null);
    
    // Add timeout for stuck network requests (10 seconds)
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Request timed out. Please check your connection and try again.');
        Alert.alert('Connection Timeout', 'The request took too long. Please check your internet connection and try again.');
      }
    }, 10000);

    try {
      await login(cleanEmail, password);
      
      // Success - reset retry count
      setRetryCount(0);
      setError(null);
      
      // Don't navigate here - let auth context listener handle navigation
      // The auth listener in hooks/auth-context.tsx will call router.replace('/')
      // and app/index.tsx will handle role-based routing
      // This prevents race conditions where navigation happens before auth state updates
    } catch (error: any) {
      console.error('[Login Error]', error);
      
      // Increment retry count
      if (!isRetry) {
        setRetryCount(prev => prev + 1);
      }
      
      // Detect validation errors (email format issues)
      const isValidationError = error.message?.includes('invalid_format') || 
        error.shape?.message?.includes('email') ||
        error.data?.zodError?.issues?.some((issue: any) => issue.path?.includes('email'));
      
      // Detect network errors
      const isNetworkError = error.message?.includes('fetch') || 
        error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('Failed to fetch');
      
      // Show appropriate message based on error type
      let displayMessage: string;
      if (isValidationError) {
        displayMessage = 'Please check your email format (e.g., name@example.com)';
      } else if (isNetworkError) {
        displayMessage = 'Network error. Please check your connection and try again.';
      } else {
        displayMessage = 'Invalid login. Please check your password.';
      }
      
      setError(displayMessage);
      
      // Show alert with retry option if not max retries
      if (retryCount < 2) {
        Alert.alert('Login Failed', displayMessage, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleLogin(true) },
        ]);
      } else {
        Alert.alert('Login Failed', displayMessage);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
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
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/584bkft3qap6m0f8x2w9s' }}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.appName}>HomeCookedPlate</Text>
              <Text style={styles.tagline}>Authentic PlateMaker Meals</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>I am a...</Text>
              <View style={styles.userTypeContainer}>
                <TouchableOpacity
                  disabled={lockedMode}
                  style={[
                    styles.userTypeBox,
                    userType === 'buyer' && styles.userTypeBoxSelected,
                    lockedMode && styles.userTypeBoxLocked,
                  ]}
                  onPress={() => setUserType('buyer')}
                >
                  <View style={[
                    styles.iconCircle,
                    userType === 'buyer' && styles.iconCircleSelected,
                  ]}
                  pointerEvents="none">
                    <Ionicons
                      name="bag-outline"
                      size={32}
                      color={userType === 'buyer' ? Colors.gradient.darkGold : Colors.gray[400]}
                    />
                  </View>
                  <Text style={[
                    styles.userTypeTitle,
                    userType === 'buyer' && styles.userTypeTitleSelected,
                  ]}>PlateTaker</Text>
                  <Text style={styles.userTypeDescription}>Order Your Favorite Plates</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={lockedMode}
                  style={[
                    styles.userTypeBox,
                    styles.userTypeBoxSeller,
                    userType === 'seller' && styles.userTypeBoxSelected,
                    userType === 'seller' && styles.userTypeBoxSelectedSeller,
                    lockedMode && styles.userTypeBoxLocked,
                  ]}
                  onPress={() => setUserType('seller')}
                >
                  <View style={[
                    styles.iconCircle,
                    userType === 'seller' && styles.iconCircleSelected,
                  ]}
                  pointerEvents="none">
                    <Ionicons
                      name="restaurant-outline"
                      size={32}
                      color={userType === 'seller' ? Colors.gradient.darkGold : Colors.gray[400]}
                    />
                  </View>
                  <Text style={[
                    styles.userTypeTitle,
                    userType === 'seller' && styles.userTypeTitleSelected,
                  ]}>PlateMaker</Text>
                  <Text style={styles.userTypeDescription}>Made With Love and Flavor</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  id="username"
                  name="username"
                  style={styles.input}
                  placeholder="name@example.com"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
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
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
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

              {/* Error message display */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#ff4444" />
                  <Text style={styles.errorText}>{error}</Text>
                  {retryCount < 3 && (
                    <TouchableOpacity
                      onPress={() => handleLogin(true)}
                      style={styles.retryButton}
                      disabled={loading}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <TouchableOpacity
                onPress={() => router.push('/(auth)/recover')}
                style={styles.forgotPasswordButton}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <GradientButton
                title="Sign In"
                onPress={() => handleLogin(false)}
                loading={loading}
                style={styles.loginButton}
                baseColor="gold"
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                onPress={() => router.push('/(auth)/signup')}
                style={styles.signupButton}
              >
                <Text style={styles.signupButtonText}>Create New Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/legal')}
                style={styles.legalButton}
              >
                <Text style={styles.legalText}>Legal & Safety Information</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.securityNote}>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.gray[500]} />
              <Text style={styles.securityText}>
                Your password is encrypted and secure. We never store or have access to your actual password.
              </Text>
            </View>

            <View style={styles.footerContainer}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/n2l9gvcoxhwzaxhkd71vj' }}
                style={styles.footerLogo}
                resizeMode="contain"
              />
              <Text style={styles.footerText}>Built By AppsoleteAI</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingTop: 80,
    paddingBottom: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 150,
    height: 150,
    marginBottom: 16,
    borderRadius: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  formContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  userTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  userTypeBox: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray[200],
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  userTypeBoxSelected: {
    borderColor: Colors.gradient.yellow,
    backgroundColor: Colors.gray[50],
  },
  userTypeBoxSelectedSeller: {
    borderColor: Colors.gradient.yellow,
  },
  userTypeBoxSeller: {
    borderColor: Colors.gray[200],
  },
  userTypeBoxLocked: {
    opacity: 0.7,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconCircleSelected: {
    backgroundColor: Colors.white,
  },
  userTypeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[700],
    marginBottom: 4,
  },
  userTypeTitleSelected: {
    color: Colors.gray[900],
  },
  userTypeDescription: {
    fontSize: 12,
    color: Colors.gray[500],
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gradient.darkGold,
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.gray[600],
    textDecorationLine: 'underline',
  },
  loginButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.gray[200],
  },
  dividerText: {
    marginHorizontal: 16,
    color: Colors.gray[500],
    fontSize: 14,
  },
  signupButton: {
    borderWidth: 2,
    borderColor: Colors.gradient.darkGold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gradient.darkGold,
  },
  legalButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 14,
    color: Colors.gray[600],
    textDecorationLine: 'underline',
  },
  securityNote: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[50],
    padding: 16,
    borderRadius: 12,
    marginTop: 'auto',
  },
  securityText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 12,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  footerLogo: {
    width: 40,
    height: 40,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray[700],
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ff4444',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4444',
    borderRadius: 6,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

// initialize userType from route param
export function useInitLoginMode(setter: (v: 'buyer' | 'seller' | null) => void, mode?: string) {
  useEffect(() => {
    if (mode === 'buyer' || mode === 'seller') {
      setter(mode);
    }
  }, [mode, setter]);
}
