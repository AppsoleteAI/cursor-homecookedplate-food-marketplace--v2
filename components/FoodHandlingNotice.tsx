import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router, type Href } from 'expo-router';
import { Colors } from '@/constants/colors';

export function FoodHandlingNotice({
  inset = false,
  testID = 'food-handling-notice',
}: {
  inset?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      style={[styles.card, inset ? styles.inset : styles.page]}
      onPress={() => router.push('/food-handling' as Href)}
      testID={testID}
    >
      <Text style={styles.kicker}>Food handling</Text>
      <Text style={styles.title}>Temperatures for pickup and leftovers</Text>
      <Text style={styles.body}>Cold food at or below 41°F. Hot food at or above 135°F. Refrigerate perishable food within 2 hours.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.blue[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.blue[200],
  },
  page: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
  },
  inset: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  kicker: {
    color: Colors.blue[700],
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.blue[700],
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  body: {
    color: Colors.blue[600],
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
});
