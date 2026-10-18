import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GlassPressable } from '@/components/glass-surface';
import { Colors, pagePastel } from '@/constants/colors';

export function TrialCountdownNotice({ daysLeft }: { daysLeft: number }) {
  const dayLabel = daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;

  return (
    <GlassPressable
      onPress={() => router.push('/membership')}
      style={styles.card}
      testID="trial-countdown-notice"
    >
      <View style={styles.row}>
        <Ionicons name="time-outline" size={22} color={Colors.gradient.darkGold} />
        <Text style={styles.days}>{dayLabel}</Text>
      </View>
      <Text style={styles.message}>
        Please sign up for a paid membership so there is no disruption in access to PlateTakers.
      </Text>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: pagePastel.gold,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.gradient.darkGold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  days: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.gray[800],
  },
});
