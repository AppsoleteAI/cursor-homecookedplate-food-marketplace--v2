import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Redirect, router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { evaluateTruckPermit } from '@/lib/food-truck-permit';
import { stateName } from '@/lib/cottage-food';
import { calculateOrderSplit } from '@/lib/fees';

export default function TruckSellerScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { orders, listings, permit, ownerActive, setOwnerActive } = useFoodTruck();
  const baseAmount = orders.reduce((sum, order) => sum + order.baseAmount, 0);
  const split = calculateOrderSplit(baseAmount);
  const permitCheck = evaluateTruckPermit(permit);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  return (
    <FoodTruckScreen title="Truck owner" subtitle="Window payouts stay separate from plate earnings." testID="truck-seller">
      <View style={styles.card}>
        <Text style={styles.label}>Truck food sold</Text>
        <Text style={styles.value}>${baseAmount.toFixed(2)}</Text>
        <Text style={styles.meta}>Truck payout ${split.sellerPayout.toFixed(2)} after the platform fee</Text>
        <Text style={styles.meta}>{orders.length} window order{orders.length === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.activeRow}>
          <Text style={styles.label}>Window is {ownerActive ? 'open' : 'closed'}</Text>
          <Switch value={ownerActive} onValueChange={setOwnerActive} trackColor={{ true: '#C2410C', false: Colors.gray[300] }} />
        </View>
        <Text style={styles.meta}>Active puts your menu on the live board. Closed trucks can still show a schedule, and they cannot take an order-ahead.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Mobile permit</Text>
        {permit ? (
          <Text style={styles.meta}>{permit.truckName} · {permit.city}, {stateName(permit.stateCode)}</Text>
        ) : (
          <Text style={styles.meta}>No permit record yet. The menu stays closed until you save one.</Text>
        )}
        {!permitCheck.ok ? <Text style={styles.block}>{permitCheck.blocks[0]}</Text> : <Text style={styles.ok}>Permit record is complete enough to list.</Text>}
      </View>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/food-truck-popup/permit' as Href)} testID="seller-permit">
        <Text style={styles.buttonText}>Permit, commissary, and fee</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => router.push('/food-truck-popup/list' as Href)} testID="seller-list">
        <Text style={styles.secondaryText}>Add a menu item</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => router.push('/kitchen-rules' as Href)}>
        <Text style={styles.secondaryText}>Kitchen rules and commissary notes</Text>
      </TouchableOpacity>
      {user?.role === 'platemaker' ? (
        <TouchableOpacity style={styles.secondary} onPress={() => router.push('/(tabs)/dashboard')}>
          <Text style={styles.secondaryText}>Plate maker dashboard</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.section}>Your menu</Text>
      {listings.length === 0 ? <Text style={styles.meta}>Nothing listed yet.</Text> : null}
      {listings.map((item) => (
        <TouchableOpacity key={item.id} style={styles.card} onPress={() => router.push(`/food-truck-popup/item/${item.id}` as Href)}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.meta}>${item.price.toFixed(2)} · {ownerActive ? 'On the board' : 'Hidden while the window is closed'}</Text>
        </TouchableOpacity>
      ))}
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  label: { color: Colors.gray[500], fontSize: 13 },
  value: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  itemName: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  secondaryText: { color: '#C2410C', fontWeight: '700' },
  section: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
});
