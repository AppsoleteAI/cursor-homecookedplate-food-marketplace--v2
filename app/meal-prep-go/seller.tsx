import React from 'react';
import { Text, StyleSheet, Switch, View } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { evaluatePrepKitchen, laneLabel } from '@/lib/meal-prep-go';

export default function MealPrepSellerScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { kitchen, listings, accepting, setAccepting, orders } = useMealPrep();
  const check = evaluatePrepKitchen(kitchen);
  const payout = orders.reduce((sum, order) => sum + order.sellerPayout, 0);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/meal-prep-go" />;
  }

  return (
    <MealPrepScreen title="Your kitchen" subtitle="A weekly menu, separate from single plates." testID="prep-seller">
      <Text style={styles.meta}>{kitchen ? kitchen.cookName : 'Kitchen record not saved yet.'}</Text>
      {check.ok ? (
        <View style={styles.row}>
          <Text style={styles.name}>Accepting this week</Text>
          <Switch value={accepting} onValueChange={setAccepting} testID="prep-accepting" />
        </View>
      ) : (
        <Text style={styles.block}>{check.blocks[0]}</Text>
      )}
      <GlassPressable style={styles.button} onPress={() => router.push('/meal-prep-go/list' as Href)} testID="prep-seller-list">
        <Text style={styles.buttonText}>Add a Weekly Item</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/meal-prep-go/kitchen' as Href)}>
        <Text style={styles.link}>Edit the Kitchen Record</Text>
      </GlassPressable>
      <Text style={styles.section}>On your menu</Text>
      {listings.length === 0 ? <Text style={styles.meta}>No weekly item yet.</Text> : null}
      {listings.map((item) => (
        <GlassPressable key={item.id} style={styles.card} onPress={() => router.push(`/meal-prep-go/item/${item.id}` as Href)}>
          <Text style={styles.lane}>{laneLabel(item.lane)}</Text>
          <Text style={styles.name}>{titleCase(item.name)}</Text>
          <Text style={styles.meta}>${item.price.toFixed(2)}</Text>
        </GlassPressable>
      ))}
      <Text style={styles.section}>Payout from recorded weeks</Text>
      <Text style={styles.meta}>${payout.toFixed(2)} after the 10% seller fee. This is the same split as the rest of HomeCookedPlate.</Text>
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  meta: { color: Colors.gray[700], lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  block: { color: '#9F1239', marginTop: 8, lineHeight: 20 },
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#0E7490', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#0E7490', fontWeight: '700' },
  section: { marginTop: 18, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10  },
  lane: { color: '#0E7490', fontSize: 12, fontWeight: '700' },
});
