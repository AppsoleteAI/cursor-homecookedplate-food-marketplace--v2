import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { useCombinedBill } from '@/hooks/use-combined-bill';

export function CombinedCartLock() {
  const { payInMainCart } = useCombinedBill();
  if (!payInMainCart) return null;
  return (
    <View style={styles.box} testID="combined-cart-lock">
      <Text style={styles.note}>
        This order includes more than one section. The card is charged once in the main cart, and the service fee uses that combined food total. This section checkout is closed.
      </Text>
      <GlassPressable onPress={() => router.push('/(tabs)/cart' as Href)} testID="combined-cart-link">
        <Text style={styles.link}>Open the main cart</Text>
      </GlassPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12 },
  note: { color: '#9A3412', lineHeight: 20 },
  link: { marginTop: 8, color: Colors.gray[900], fontWeight: '700' },
});
