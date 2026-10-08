import React from 'react';
import {
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { monoGradients, BaseColor } from '@/constants/colors';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { titleCase } from '@/lib/title-case';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  baseColor?: BaseColor;
  testID?: string;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  loading = false,
  baseColor = 'green',
  testID,
}) => {
  const colors = disabled ? (['#9CA3AF', '#6B7280'] as const) : monoGradients[baseColor];

  return (
    <GlassPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.container, style]}
      testID={testID ?? 'gradient-button'}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={[styles.text, textStyle]}>{titleCase(title)}</Text>
        )}
      </LinearGradient>
    </GlassPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    ...glassSurface,
  },
  gradient: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});