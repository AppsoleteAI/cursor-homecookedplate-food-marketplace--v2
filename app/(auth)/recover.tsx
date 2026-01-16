import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { Colors } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';

type RecoveryMode = 'password' | 'reactivate';

export default function RecoverScreen() {
  const [mode, setMode] = useState<RecoveryMode>('password');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword, reactivateAccount } = useAuth();

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
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
    try {
      if (mode === 'password') {
        await resetPassword(cleanEmail);
        Alert.alert(
          'Password Reset',
          'If an account exists with this email, a password reset link has been sent. Please check your email.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        await reactivateAccount(cleanEmail);
        // The backend returns a message, but we'll show a generic success
        Alert.alert(
          'Account Reactivation',
          'If your account was paused, it has been reactivated. You can now log in normally.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
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
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <Text style={styles.title}>Account Recovery</Text>
              <Text style={styles.subtitle}>Choose how you'd like to recover your account</Text>
            </View>

            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'password' && styles.modeButtonActive,
                ]}
                onPress={() => setMode('password')}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={24}
                  color={mode === 'password' ? Colors.white : Colors.gray[600]}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'password' && styles.modeButtonTextActive,
                  ]}
                >
                  Reset Password
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'reactivate' && styles.modeButtonActive,
                ]}
                onPress={() => setMode('reactivate')}
              >
                <Ionicons
                  name="refresh-outline"
                  size={24}
                  color={mode === 'reactivate' ? Colors.white : Colors.gray[600]}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'reactivate' && styles.modeButtonTextActive,
                  ]}
                >
                  Reactivate Account
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.gray[400]} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <GradientButton
                title={mode === 'password' ? 'Send Reset Link' : 'Reactivate Account'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
                baseColor="gold"
              />

              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backToLoginButton}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
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
    paddingTop: 20,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerContainer: {
    marginBottom: 32,
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
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  modeButton: {
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
  modeButtonActive: {
    backgroundColor: Colors.gradient.yellow,
    borderColor: 'transparent',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  modeButtonTextActive: {
    color: Colors.white,
  },
  formContainer: {
    marginBottom: 32,
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
  submitButton: {
    marginTop: 8,
  },
  backToLoginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 14,
    color: Colors.gray[600],
    textDecorationLine: 'underline',
  },
});
