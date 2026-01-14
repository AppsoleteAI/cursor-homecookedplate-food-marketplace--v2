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
  const { login } = useAuth();
  const modeParam = typeof params.mode === 'string' ? params.mode : undefined;
  const lockedMode = modeParam === 'buyer' || modeParam === 'seller';
  useInitLoginMode(setUserType, modeParam);

  // Complete any pending auth session for native redirects
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const handleLogin = async () => {
    console.log('Sign-in triggered');
    
    if (!userType) {
      Alert.alert('Error', 'Please select a user type (PlateTaker or PlateMaker)');
      return;
    }
    
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    // Sanitize email input
    const cleanEmail = username.trim().toLowerCase();
    
    // Pre-flight validation with regex
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Invalid Email', 'Please check for hidden spaces or typos in: ' + cleanEmail);
      return;
    }

    // Debug log to see what backend receives
    console.log('Final Sanitize Check:', cleanEmail);

    setLoading(true);
    try {
      await login(cleanEmail, password);
      
      if (userType === 'seller') {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(tabs)/(home)/home');
      }
    } catch (error) {
      console.error('[Login] Error:', error);
      // Parse tRPC error structure
      const errorMessage = (error as any)?.shape?.message || 
        (error instanceof Error ? error.message : 'Check your credentials and try again');
      Alert.alert('Login Failed', errorMessage);
    } finally {
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
                <Ionicons name="lock-closed-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <GradientButton
                title="Sign In"
                onPress={handleLogin}
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
});

// initialize userType from route param
export function useInitLoginMode(setter: (v: 'buyer' | 'seller' | null) => void, mode?: string) {
  useEffect(() => {
    if (mode === 'buyer' || mode === 'seller') {
      setter(mode);
    }
  }, [mode, setter]);
}
