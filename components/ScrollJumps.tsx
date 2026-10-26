import React, { type RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors } from '@/constants/auth-palette';
import { GlassIconButton } from '@/components/glass-surface';
import { IdleChrome } from '@/components/IdleChrome';
import { CHROME_CHIP_SIZE, CHROME_ICON_SIZE } from '@/lib/chrome-activity';

/** Up and down chips from the Food Handling page. */
export function ScrollJumps({
  scrollRef,
  testID = 'scroll-jumps',
}: {
  scrollRef: RefObject<ScrollView | null>;
  testID?: string;
}) {
  return (
    <IdleChrome overlay>
      <View style={styles.jumps} pointerEvents="box-none">
        <GlassIconButton
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          testID={`${testID}-top`}
          accessibilityLabel="Scroll to top"
          size={CHROME_CHIP_SIZE}
          maroon
        >
          <Ionicons name="chevron-up" size={CHROME_ICON_SIZE} color={AuthColors.gold} />
        </GlassIconButton>
        <GlassIconButton
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          testID={`${testID}-bottom`}
          accessibilityLabel="Scroll to bottom"
          size={CHROME_CHIP_SIZE}
          maroon
        >
          <Ionicons name="chevron-down" size={CHROME_ICON_SIZE} color={AuthColors.gold} />
        </GlassIconButton>
      </View>
    </IdleChrome>
  );
}

const styles = StyleSheet.create({
  jumps: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    gap: 10,
    zIndex: 20,
  },
});
