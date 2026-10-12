import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

export const ORDER_HOURS_SLOGAN = 'Order Any Time, Any Day';

export function OrderHoursSlogan({ style }: { style?: TextStyle }) {
  return <Text style={[styles.line, style]}>{ORDER_HOURS_SLOGAN}</Text>;
}

const styles = StyleSheet.create({
  line: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
