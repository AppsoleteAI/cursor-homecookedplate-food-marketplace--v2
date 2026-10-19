import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, preAppFont } from '@/constants/auth-palette';
import { GlassPressable } from '@/components/glass-surface';
import { trpc } from '@/lib/trpc';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResendConfirmationProps = {
  email?: string;
  showEmailField?: boolean;
};

export function ResendConfirmation({ email = '', showEmailField = false }: ResendConfirmationProps) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const resend = trpc.auth.resendVerificationEmail.useMutation();
  const value = showEmailField ? draft : email.trim().toLowerCase();

  const send = async () => {
    const cleanEmail = value.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setNotice('Check the email address.');
      return;
    }
    setNotice(null);
    try {
      const result = await resend.mutateAsync({ email: cleanEmail });
      setNotice(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setNotice(
        message.includes('kitchen is a bit busy')
          ? 'The confirmation email was not sent. Try again in a moment.'
          : message || 'The confirmation email was not sent. Try again in a moment.',
      );
    }
  };

  return (
    <View style={styles.wrap}>
      {showEmailField ? (
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={18} color={AuthColors.maroon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={AuthColors.placeholder}
            value={draft}
            onChangeText={(next) => {
              setDraft(next);
              if (notice) setNotice(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            testID="resend-confirmation-email"
          />
        </View>
      ) : null}
      <GlassPressable
        onPress={send}
        disabled={resend.isPending}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Email me a new confirmation link"
        testID="resend-confirmation"
      >
        <Text style={styles.buttonText}>
          {resend.isPending ? 'Sending a new link' : 'Email me a new link'}
        </Text>
      </GlassPressable>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AuthColors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    ...preAppFont,
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: AuthColors.ink,
    paddingVertical: 0,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  buttonText: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 15,
    fontWeight: '700',
  },
  notice: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
