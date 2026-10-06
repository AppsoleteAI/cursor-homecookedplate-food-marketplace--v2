import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, authGradient } from '@/constants/auth-palette';

type PressState = { pressed: boolean; hovered?: boolean };

function lift(state: PressState) {
  const hovered = Boolean(state.hovered);
  return {
    transform: [
      { translateY: state.pressed ? 1 : hovered ? -2.5 : 0 },
      { scale: state.pressed ? 0.985 : 1 },
    ] as const,
  };
}

export function AuthBackground({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <LinearGradient
      colors={[...authGradient]}
      locations={[0, 0.48, 1]}
      style={styles.bg}
      testID={testID}
    >
      {children}
    </LinearGradient>
  );
}

export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={(state) => [styles.back, lift(state)]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="arrow-back" size={22} color={AuthColors.brand} />
    </Pressable>
  );
}

export function AuthGoldButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      style={(state) => [styles.button, disabled && styles.buttonDisabled, lift(state), style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={AuthColors.ink} />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  button: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: AuthColors.button,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.36)',
    shadowColor: '#461C06',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  label: {
    color: AuthColors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
});
