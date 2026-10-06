import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthGreen } from '@/constants/auth-palette';

export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="arrow-back" size={22} color={AuthGreen.gold} />
    </TouchableOpacity>
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
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}
    >
      <LinearGradient
        colors={disabled ? ['#8C8374', '#8C8374'] : ['#F0D48A', '#C6A15A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fill}
      >
        {loading ? (
          <ActivityIndicator color={AuthGreen.ink} />
        ) : (
          <Text style={styles.label}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  button: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  fill: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    color: AuthGreen.ink,
    fontSize: 17,
    fontWeight: '700',
  },
});
