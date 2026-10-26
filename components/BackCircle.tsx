import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassIconButton } from '@/components/glass-surface';
import { IdleChrome } from '@/components/IdleChrome';
import { CHROME_CHIP_SIZE, CHROME_FROST_TINT, CHROME_ICON_SIZE } from '@/lib/chrome-activity';
import { Colors } from '@/constants/colors';
import { AuthColors } from '@/constants/auth-palette';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import type { Href } from 'expo-router';

export type BackTone = 'light' | 'honey' | 'solid' | 'frost';

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
  const solid = tone === 'solid';
  const frost = tone === 'frost';
  const chip = (
    <IdleChrome>
      <GlassIconButton
        onPress={onPress}
        testID={testID}
        accessibilityLabel="Back"
        size={CHROME_CHIP_SIZE}
        tint={solid ? Colors.white : frost ? CHROME_FROST_TINT : honey ? undefined : 'rgba(255,255,255,0.18)'}
        honey={honey}
      >
        <Ionicons name="chevron-back" size={CHROME_ICON_SIZE} color={honey || solid ? AuthColors.ink : Colors.white} />
      </GlassIconButton>
    </IdleChrome>
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

/** Back chip for a screen opened from the kitchen dashboard. */
export function DashboardSectionBack() {
  const leave = useLeaveScreen('/(tabs)/dashboard');
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BackCircle tone="light" onPress={leave} gapBelow={false} testID="back-to-dashboard" />
    </>
  );
}

const styles = StyleSheet.create({
  gap: {
    alignSelf: 'flex-start',
    marginBottom: CHIP_GAP,
  },
});
