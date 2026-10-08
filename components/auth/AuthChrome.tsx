import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthColors, authGradient, authGradientLocations, goldButtonColors } from '@/constants/auth-palette';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { titleCase } from '@/lib/title-case';

const HOUSE_MARK = require('../../assets/house-mark.png');

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
      locations={[...authGradientLocations]}
      style={styles.bg}
      testID={testID}
    >
      {children}
    </LinearGradient>
  );
}

export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <GlassPressable
      onPress={onPress}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="arrow-back" size={22} color={AuthColors.brand} />
    </GlassPressable>
  );
}

export function AuthBrand({ toSignIn = true }: { toSignIn?: boolean }) {
  const mark = (
    <View style={styles.brandRow}>
      <Image
        source={HOUSE_MARK}
        style={styles.brandMark}
        resizeMode="contain"
        tintColor={AuthColors.gold}
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.brandWord}>HomeCookedPlate</Text>
    </View>
  );
  if (!toSignIn) return mark;
  return (
    <Pressable
      onPress={() => router.push('/(auth)/login')}
      accessibilityRole="link"
      accessibilityLabel="HomeCookedPlate, back to sign in"
    >
      {mark}
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
  tone = 'maroon',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  tone?: 'gold' | 'maroon';
}) {
  const gold = tone === 'gold';
  return (
    <GlassPressable
      style={[styles.button, gold && styles.buttonGold, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}
    >
      {gold ? (
        <LinearGradient
          colors={[...goldButtonColors]}
          locations={[0, 0.42, 1]}
          style={styles.goldFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={gold ? AuthColors.ink : AuthColors.white} />
      ) : (
        <Text style={[styles.label, gold && styles.labelGold]}>{titleCase(title)}</Text>
      )}
    </GlassPressable>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brandMark: {
    width: 46,
    height: 38,
  },
  brandWord: {
    color: AuthColors.gold,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  button: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: AuthColors.maroonDeep,
    ...glassSurface,
  },
  buttonGold: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  goldFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  label: {
    color: AuthColors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  labelGold: {
    color: AuthColors.ink,
  },
});
