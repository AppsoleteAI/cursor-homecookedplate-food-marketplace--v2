import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';
import { Colors } from '@/constants/colors';

export function FoodHandlingLink({
  label = 'Food handling temperatures',
  testID = 'open-food-handling',
  color = Colors.blue[600],
}: {
  label?: string;
  testID?: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={() => router.push('/food-handling' as Href)}
      accessibilityRole="link"
      testID={testID}
    >
      <Text style={[styles.link, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.blue[600], fontWeight: '700', marginTop: 8, lineHeight: 20 },
});
