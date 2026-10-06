import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { getMenuItem, getTruck } from '@/constants/food-truck-popup';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { calculateOrderSplit } from '@/lib/fees';

export default function TruckBasketScreen() {
  const { items, listings, permit, setQuantity, clearItems } = useFoodTruck();
  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getMenuItem(item.itemId);
      const listing = listings.find((entry) => entry.id === item.itemId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      if (!name || price === undefined) return [];
      return [{ id: item.itemId, truckId: item.truckId, name, price, quantity: item.quantity }];
    });
  }, [items, listings]);

  const truckId = lines[0]?.truckId;
  const truckName = truckId === 'owner-truck' ? permit?.truckName ?? 'Your truck' : getTruck(truckId ?? '')?.name ?? 'Truck';
  const baseAmount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);

  return (
    <FoodTruckScreen title="Window order" subtitle="One truck. Pickup at the window." showBasket={false} testID="truck-basket">
      {lines.length === 0 ? (
        <View>
          <Text style={styles.empty}>No truck order yet.</Text>
          <TouchableOpacity onPress={() => router.push('/food-truck-popup/board' as Href)}>
            <Text style={styles.link}>See which windows are open</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.truck}>{truckName}</Text>
          {lines.map((line) => (
            <View key={line.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{line.name}</Text>
                <Text style={styles.meta}>${line.price.toFixed(2)}</Text>
              </View>
              <View style={styles.qty}>
                <TouchableOpacity onPress={() => setQuantity(line.id, line.quantity - 1)}>
                  <Text style={styles.qtyText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <TouchableOpacity onPress={() => setQuantity(line.id, line.quantity + 1)}>
                  <Text style={styles.qtyText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={clearItems}>
            <Text style={styles.link}>Clear this truck</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Food ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, lines.length === 0 && styles.buttonOff]}
        disabled={lines.length === 0}
        onPress={() => router.push('/food-truck-popup/checkout' as Href)}
        testID="truck-basket-checkout"
      >
        <Text style={styles.buttonText}>Truck checkout</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(tabs)/cart')}>
        <Text style={styles.link}>Cooked-plate cart</Text>
      </TouchableOpacity>
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700], fontSize: 16 },
  truck: { fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  copy: { flex: 1 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 22, paddingHorizontal: 4 },
  qtyValue: { fontWeight: '700', minWidth: 16, textAlign: 'center' },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { marginTop: 4, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  button: { marginTop: 14, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#C2410C', fontWeight: '700' },
});
