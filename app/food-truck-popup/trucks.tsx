import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { FOOD_TRUCKS, trucksNearZip } from '@/constants/food-truck-popup';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { stateName } from '@/lib/cottage-food';

export default function TrucksScreen() {
  const [zip, setZip] = useState('');
  const { follows } = useFoodTruck();
  const trucks = trucksNearZip(zip);
  const searching = zip.replace(/\D/g, '').length >= 3;
  const list = searching ? trucks : FOOD_TRUCKS;

  return (
    <FoodTruckScreen title="Trucks" subtitle="Menus live on the truck, not on the plate feed." testID="truck-directory">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="Search by ZIP"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="trucks-zip"
      />
      {searching && list.length === 0 ? <Text style={styles.empty}>No truck matches that ZIP.</Text> : null}
      {list.map((truck) => (
        <GlassPressable key={truck.id} style={styles.card} onPress={() => router.push(`/food-truck-popup/truck/${truck.id}` as Href)} testID={`truck-card-${truck.id}`}>
          <Image source={{ uri: truck.image }} style={styles.image} />
          <View style={styles.copy}>
            <Text style={styles.name}>{titleCase(truck.name)}</Text>
            <Text style={styles.meta}>{truck.city}, {stateName(truck.stateCode)} {truck.zip}</Text>
            <Text style={styles.meta}>{truck.active ? 'Window open' : 'Window closed'} · {truck.cuisine}</Text>
            {follows.includes(truck.id) ? <Text style={styles.follow}>Following</Text> : null}
          </View>
        </GlassPressable>
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
    marginBottom: 12,
  },
  card: { ...glassSurface, flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 10, marginBottom: 10  },
  image: { ...glassSurface, width: 88, height: 88, borderRadius: 12, backgroundColor: Colors.gray[200]  },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  follow: { marginTop: 6, color: '#C2410C', fontWeight: '700', fontSize: 12 },
  empty: { color: Colors.gray[600], marginBottom: 12 },
});
