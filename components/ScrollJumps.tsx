import React, { type RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors } from '@/constants/auth-palette';
import { GlassIconButton } from '@/components/glass-surface';

/** Up and down chips from the Food Handling page. */
export function ScrollJumps({
  scrollRef,
  testID = 'scroll-jumps',
}: {
  scrollRef: RefObject<ScrollView | null>;
  testID?: string;
}) {
  return (
    <View style={styles.jumps} pointerEvents="box-none">
      <GlassIconButton
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        testID={`${testID}-top`}
        accessibilityLabel="Scroll to top"
        tint="rgba(232, 176, 22, 0.72)"
      >
        <Ionicons name="chevron-up" size={22} color={AuthColors.ink} />
      </GlassIconButton>
      <GlassIconButton
        onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
        testID={`${testID}-bottom`}
        accessibilityLabel="Scroll to bottom"
        tint="rgba(232, 176, 22, 0.72)"
      >
        <Ionicons name="chevron-down" size={22} color={AuthColors.ink} />
      </GlassIconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  jumps: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    gap: 10,
  },
});
