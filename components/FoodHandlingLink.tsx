import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { Colors } from '@/constants/colors';

export function openFoodHandling(returnTo?: string) {
  const previous = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && returnTo !== '/food-handling'
    ? returnTo
    : null;
  const href: Href = previous
    ? { pathname: '/food-handling', params: { returnTo: previous } }
    : '/food-handling';
  router.push(href);
}

export function FoodHandlingLink({
  label = 'Food handling temperatures',
  testID = 'open-food-handling',
  color = Colors.blue[600],
  returnTo,
}: {
  label?: string;
  testID?: string;
  color?: string;
  returnTo?: string;
}) {
  const pathname = usePathname();
  return (
    <Pressable
      onPress={() => openFoodHandling(returnTo ?? pathname)}
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
