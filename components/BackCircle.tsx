import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassIconButton } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { AuthColors } from '@/constants/auth-palette';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import type { Href } from 'expo-router';

export type BackTone = 'light' | 'honey';

/** Same gap the lane headers leave beside a title. Used under the chip when the title sits on the next line. */
const CHIP_GAP = 12;

/** FoodTruckPopup circle: glass shadow, press bounce, chevron. Honey uses an ink glyph. */
export function BackCircle({
  onPress,
  tone = 'light',
  testID,
  gapBelow = true,
}: {
  onPress: () => void;
  tone?: BackTone;
  testID?: string;
  /** Leave 12px under the chip so a left-aligned title or logo on the next line stays clear. */
  gapBelow?: boolean;
}) {
  const honey = tone === 'honey';
  const chip = (
    <GlassIconButton
      onPress={onPress}
      testID={testID}
      accessibilityLabel="Back"
      tint={honey ? 'rgba(232, 176, 22, 0.72)' : 'rgba(255,255,255,0.18)'}
    >
      <Ionicons name="chevron-back" size={22} color={honey ? AuthColors.ink : Colors.white} />
    </GlassIconButton>
  );
  if (!gapBelow) return chip;
  return <View style={styles.gap}>{chip}</View>;
}

/** Circle plus the shared leave action, for screens that only need a way back. */
export function ScreenBack({
  fallback,
  tone = 'honey',
  testID,
}: {
  fallback: Href;
  tone?: BackTone;
  testID?: string;
}) {
  const leave = useLeaveScreen(fallback);
  return <BackCircle onPress={leave} tone={tone} testID={testID} />;
}

const styles = StyleSheet.create({
  gap: {
    alignSelf: 'flex-start',
    marginBottom: CHIP_GAP,
  },
});
