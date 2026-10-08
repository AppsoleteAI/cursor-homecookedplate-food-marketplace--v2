import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { useMealPrep } from '@/hooks/meal-prep-store';

export default function MealPrepOrdersScreen() {
  const { orders } = useMealPrep();

  return (
    <MealPrepScreen title="Prep orders" subtitle="Weekly plans stay out of plate orders." testID="prep-orders">
      {orders.length === 0 ? (
        <GlassPressable onPress={() => router.push('/meal-prep-go/board' as Href)}>
          <Text style={styles.link}>No weekly order yet. Find a cook who is open.</Text>
        </GlassPressable>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <Text style={styles.name}>{order.cookName}</Text>
            <Text style={styles.meta}>{order.mix} · {order.lines.length} item{order.lines.length === 1 ? '' : 's'} · {order.handoff === 'pickup' ? 'Pickup' : 'Household drop-off'}</Text>
            <Text style={styles.meta}>{order.windowLabel}</Text>
            <Text style={styles.meta}>You paid ${order.buyerPays.toFixed(2)} · {order.id}</Text>
          </View>
        ))
      )}
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  link: { color: '#0E7490', fontWeight: '700' },
  card: {
    ...glassSurface,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4 },
});
