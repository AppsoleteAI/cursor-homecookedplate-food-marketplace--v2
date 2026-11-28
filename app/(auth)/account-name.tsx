import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { isAccountRole, PROVIDER_ROLE_STORAGE_KEY, type AccountRole } from '@/backend/lib/provider-profile';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { BackCircle } from '@/components/BackCircle';
import { GlassPressable, GlassTop } from '@/components/glass-surface';
import { AuthColors } from '@/constants/auth-palette';
import { useAuth } from '@/hooks/auth-context';
import { useReplaceBack } from '@/hooks/use-leave-screen';
import { accountEntryDestination, readGuestLocationPassed } from '@/lib/guest-role';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AccountNameScreen() {
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const { saveProviderIdentity } = useAuth();
  const leave = useReplaceBack('/(auth)/login');
  const [role, setRole] = useState<AccountRole | null>(isAccountRole(firstParam(params.role)) ? firstParam(params.role) as AccountRole : null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role) return;
    AsyncStorage.getItem(PROVIDER_ROLE_STORAGE_KEY).then((stored) => {
      if (isAccountRole(stored)) setRole(stored);
    }).catch(() => undefined);
  }, [role]);

  const save = async () => {
    const cleanName = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!role) {
      setError('Choose Order a Plate or Start Cooking.');
      return;
    }
    if (cleanName.length < 3) {
      setError('Use at least 3 letters or numbers in the username.');
      return;
    }
    if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Enter an email you can open.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProviderIdentity(role, cleanName, cleanEmail);
      const passed = await readGuestLocationPassed();
      if (accountEntryDestination(false, passed) === '/') {
        router.replace('/');
        return;
      }
      router.replace({
        pathname: '/(auth)/onboarding',
        params: { entry: 'enter', step: '0', back: 'account-name', role },
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The username and email could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <BackCircle tone="honey" onPress={leave} testID="account-name-back" />
            <AuthBrand />
            <View style={styles.panel}>
              <GlassTop />
              <Text style={styles.title}>Username and email</Text>
              <Text style={styles.help}>
                Apple or Google is the password. The username is the one you type here. The email is one you can open. Confirmation is sent after the first order or the first plate.
              </Text>
              {role ? (
                <Text style={styles.roleLine}>{role === 'platemaker' ? 'PlateMaker' : 'PlateTaker'}</Text>
              ) : (
                <View style={styles.roleRow}>
                  <GlassPressable style={styles.roleChoice} onPress={() => setRole('platetaker')} accessibilityRole="button" accessibilityLabel="Order a plate, PlateTaker">
                    <Text style={styles.roleChoiceText}>Order a Plate</Text>
                    <Text style={styles.roleHint}>PlateTaker</Text>
                  </GlassPressable>
                  <GlassPressable style={styles.roleChoice} onPress={() => setRole('platemaker')} accessibilityRole="button" accessibilityLabel="Start cooking, PlateMaker">
                    <Text style={styles.roleChoiceText}>Start Cooking</Text>
                    <Text style={styles.roleHint}>PlateMaker</Text>
                  </GlassPressable>
                </View>
              )}
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                placeholderTextColor={AuthColors.muted}
                style={styles.input}
                testID="account-name-username"
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email you can open"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                placeholderTextColor={AuthColors.muted}
                style={styles.input}
                testID="account-name-email"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AuthGoldButton title="Continue" onPress={save} loading={saving} testID="account-name-continue" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  panel: { marginTop: 12, borderRadius: 28, padding: 22, backgroundColor: 'rgba(255,255,255,0.92)' },
  title: { fontSize: 28, color: AuthColors.ink, marginBottom: 8 },
  help: { fontSize: 15, lineHeight: 22, color: AuthColors.ink, marginBottom: 16 },
  roleLine: { fontSize: 16, color: AuthColors.maroon, marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  roleChoice: { flex: 1, borderRadius: 16, padding: 12, backgroundColor: 'rgba(255,248,230,0.9)' },
  roleChoiceText: { fontSize: 15, color: AuthColors.ink },
  roleHint: { fontSize: 13, color: AuthColors.maroon, marginTop: 4 },
  input: {
    fontSize: 16,
    color: AuthColors.ink,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  error: { color: AuthColors.maroon, marginBottom: 12 },
});
