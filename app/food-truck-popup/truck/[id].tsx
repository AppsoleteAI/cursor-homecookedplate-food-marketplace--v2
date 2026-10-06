import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { getTruck, menuForTruck } from '@/constants/food-truck-popup';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { stateName } from '@/lib/cottage-food';
import { commissaryExpected } from '@/lib/food-truck-permit';

export default function TruckProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const truckId = Array.isArray(id) ? id[0] : id;
  const truck = truckId ? getTruck(truckId) : undefined;
  const { follows, toggleFollow } = useFoodTruck();

  if (!truck) {
    return (
      <FoodTruckScreen title="Truck" testID="truck-missing">
        <Text>That truck is not on the board.</Text>
      </FoodTruckScreen>
    );
  }

  return (
    <FoodTruckScreen title={truck.name} subtitle={`${truck.city}, ${stateName(truck.stateCode)}`} testID="truck-profile">
      <Image source={{ uri: truck.image }} style={styles.hero} />
      <Text style={[styles.status, truck.active ? styles.open : styles.closed]}>{truck.active ? 'Window open' : 'Window closed'}</Text>
      <Text style={styles.body}>{truck.summary}</Text>
      <Text style={styles.meta}>{truck.county} County · {truck.zip}</Text>
      <Text style={styles.body}>{truck.windowNote}</Text>
      <TouchableOpacity style={styles.follow} onPress={() => toggleFollow(truck.id)} testID="truck-follow">
        <Text style={styles.followText}>{follows.includes(truck.id) ? 'Following this truck' : 'Follow this truck'}</Text>
      </TouchableOpacity>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Today’s lot</Text>
        {truck.stops.map((stop) => (
          <Text key={`${stop.day}-${stop.place}`} style={styles.body}>{stop.day} · {stop.hours} · {stop.place} ({stop.lot})</Text>
        ))}
        <Text style={styles.body}>
          {commissaryExpected(truck.stateCode)
            ? 'Published summaries expect a commissary agreement in this state before a mobile food license.'
            : 'Confirm the commissary rule with the health department that covers this lot.'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/food-truck-popup/permit' as Href)}>
          <Text style={styles.link}>Mobile permit checklist</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.section}>Menu</Text>
      {menuForTruck(truck.id).map((item) => (
        <TouchableOpacity key={item.id} style={styles.row} onPress={() => router.push(`/food-truck-popup/item/${item.id}` as Href)}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>${item.price.toFixed(2)} · {truck.active ? 'Order ahead' : 'Window closed'}</Text>
        </TouchableOpacity>
      ))}
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 180, borderRadius: 16, backgroundColor: Colors.gray[200] },
  status: { marginTop: 10, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9A3412' },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 8 },
  meta: { color: Colors.gray[500], marginTop: 4 },
  follow: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#C2410C', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  followText: { color: Colors.white, fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  panelTitle: { fontWeight: '700', color: Colors.gray[900] },
  link: { color: '#C2410C', fontWeight: '700', marginTop: 8 },
  section: { marginTop: 18, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  row: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginTop: 8 },
  name: { fontWeight: '700', color: Colors.gray[900] },
});
