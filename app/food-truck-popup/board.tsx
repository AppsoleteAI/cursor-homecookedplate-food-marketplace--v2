import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { FOOD_TRUCKS, trucksNearZip } from '@/constants/food-truck-popup';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { useAuth } from '@/hooks/auth-context';
import { stateName } from '@/lib/cottage-food';

export default function TruckBoardScreen() {
  const params = useLocalSearchParams<{ zip?: string }>();
  const initialZip = typeof params.zip === 'string' ? params.zip : '';
  const [zip, setZip] = useState(initialZip);
  const { permit, ownerActive, listings } = useFoodTruck();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const trucks = trucksNearZip(zip);
  const searching = zip.replace(/\D/g, '').length >= 3;

  return (
    <FoodTruckScreen title="Live board" subtitle="Active means the service window is open." testID="truck-board">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="ZIP code"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="board-zip"
      />
      <Text style={styles.note}>This board is the truck’s own Active switch and posted lot. It is not a live GPS feed from the vehicle.</Text>
      {isMaker && permit ? (
        <TouchableOpacity style={styles.card} onPress={() => router.push('/food-truck-popup/seller' as Href)}>
          <Text style={styles.name}>{permit.truckName}</Text>
          <Text style={[styles.status, ownerActive ? styles.open : styles.closed]}>{ownerActive ? 'Active' : 'Window closed'}</Text>
          <Text style={styles.meta}>{permit.city}, {stateName(permit.stateCode)} · {listings.length} menu item{listings.length === 1 ? '' : 's'}</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.section}>{searching ? 'Trucks in this ZIP area' : 'On the board'}</Text>
      {(searching ? trucks : FOOD_TRUCKS).length === 0 ? <Text style={styles.note}>No truck shares the first three digits of that ZIP.</Text> : null}
      {(searching ? trucks : FOOD_TRUCKS).map((truck) => (
        <TouchableOpacity key={truck.id} style={styles.card} onPress={() => router.push(`/food-truck-popup/truck/${truck.id}` as Href)} testID={`board-truck-${truck.id}`}>
          <Text style={styles.name}>{truck.name}</Text>
          <Text style={[styles.status, truck.active ? styles.open : styles.closed]}>{truck.active ? 'Active' : 'Window closed'}</Text>
          <Text style={styles.meta}>{truck.city}, {stateName(truck.stateCode)} · {truck.cuisine}</Text>
          <Text style={styles.meta}>{truck.stops[0]?.place} · {truck.stops[0]?.hours}</Text>
        </TouchableOpacity>
      ))}
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  note: { color: Colors.gray[600], marginTop: 10, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10 },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  status: { marginTop: 6, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9A3412' },
  meta: { color: Colors.gray[600], marginTop: 4 },
});
