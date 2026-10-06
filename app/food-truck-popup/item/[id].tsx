import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { getMenuItem, getTruck } from '@/constants/food-truck-popup';
import { useFoodTruck } from '@/hooks/food-truck-store';

export default function TruckItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const { listings, ownerActive, permit, addItem } = useFoodTruck();
  const catalog = itemId ? getMenuItem(itemId) : undefined;
  const listing = listings.find((item) => item.id === itemId);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  if (!catalog && !listing) {
    return (
      <FoodTruckScreen title="Menu item" testID="truck-item-missing">
        <Text>That item is not on a truck menu.</Text>
      </FoodTruckScreen>
    );
  }

  const truck = catalog ? getTruck(catalog.truckId) : undefined;
  const open = catalog ? Boolean(truck?.active) : ownerActive;
  const name = catalog?.name ?? listing!.name;
  const price = catalog?.price ?? listing!.price;
  const summary = catalog?.summary ?? listing!.summary;
  const ingredients = catalog?.ingredients ?? listing!.ingredients;
  const allergens = catalog?.allergens ?? listing!.allergens;
  const truckId = catalog?.truckId ?? 'owner-truck';
  const truckName = truck?.name ?? permit?.truckName ?? 'Your truck';

  return (
    <FoodTruckScreen title={name} subtitle={truckName} testID="truck-item">
      {catalog ? <Image source={{ uri: catalog.image }} style={styles.hero} /> : null}
      <Text style={styles.price}>${price.toFixed(2)}</Text>
      <Text style={[styles.status, open ? styles.open : styles.closed]}>{open ? 'Window open for order-ahead' : 'Window closed'}</Text>
      <Text style={styles.body}>{summary}</Text>
      {truck ? (
        <TouchableOpacity onPress={() => router.push(`/food-truck-popup/truck/${truck.id}` as Href)}>
          <Text style={styles.link}>Back to {truck.name}</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.label}>Ingredients</Text>
        <Text style={styles.body}>{ingredients}</Text>
        <Text style={styles.label}>Allergens</Text>
        <Text style={styles.body}>{allergens}</Text>
        <Text style={styles.body}>Pickup is at the service window. This item is not a cooked plate and not a farm good.</Text>
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qty} onPress={() => setQuantity((value) => Math.max(1, value - 1))}>
          <Text style={styles.qtyText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <TouchableOpacity style={styles.qty} onPress={() => setQuantity((value) => Math.min(99, value + 1))}>
          <Text style={styles.qtyText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.add, !open && styles.addOff]}
        disabled={!open}
        testID="add-truck-item"
        onPress={() => {
          if (!itemId) return;
          const result = addItem(itemId, truckId, quantity);
          setNotice(result.ok ? 'Added for window pickup.' : result.reason);
        }}
      >
        <Text style={styles.addText}>{open ? 'Add for window pickup' : 'Window is closed'}</Text>
      </TouchableOpacity>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {notice === 'Added for window pickup.' ? (
        <TouchableOpacity onPress={() => router.push('/food-truck-popup/basket' as Href)}>
          <Text style={styles.link}>Go to the truck order</Text>
        </TouchableOpacity>
      ) : null}
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.gray[200] },
  price: { marginTop: 12, fontSize: 22, fontWeight: '700', color: '#C2410C' },
  status: { marginTop: 4, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9A3412' },
  body: { marginTop: 8, color: Colors.gray[700], lineHeight: 20 },
  link: { marginTop: 10, color: '#C2410C', fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  label: { marginTop: 8, fontWeight: '700', color: Colors.gray[800] },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  qty: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 22, color: Colors.gray[900] },
  qtyValue: { fontSize: 18, fontWeight: '700' },
  add: { marginTop: 16, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addOff: { backgroundColor: Colors.gray[400] },
  addText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  notice: { marginTop: 10, color: Colors.gray[800], lineHeight: 20 },
});
