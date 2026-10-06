import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { FOOD_TRUCKS } from '@/constants/food-truck-popup';
import { stateName } from '@/lib/cottage-food';

export default function TruckScheduleScreen() {
  return (
    <FoodTruckScreen title="Schedules" subtitle="Lot calendars. The window still has to be marked active before an order." testID="truck-schedule">
      <Text style={styles.lead}>
        A schedule tells you where the truck plans to park. It does not open the window. Order-ahead starts when the truck marks Active on the live board.
      </Text>
      {FOOD_TRUCKS.map((truck) => (
        <View key={truck.id} style={styles.card}>
          <Text style={styles.name}>{truck.name}</Text>
          <Text style={styles.meta}>{truck.city}, {stateName(truck.stateCode)} · {truck.active ? 'Window open' : 'Window closed'}</Text>
          {truck.stops.map((stop) => (
            <Text key={`${truck.id}-${stop.day}`} style={styles.stop}>{stop.day} · {stop.hours} · {stop.place}</Text>
          ))}
          <Text style={styles.stop}>{stopLot(truck.stops[0]?.lot)}</Text>
          <TouchableOpacity onPress={() => router.push(`/food-truck-popup/truck/${truck.id}` as Href)}>
            <Text style={styles.link}>Open the truck</Text>
          </TouchableOpacity>
        </View>
      ))}
    </FoodTruckScreen>
  );
}

function stopLot(lot: string | undefined) {
  return lot ? `Lot: ${lot}` : '';
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[700], lineHeight: 20 },
  card: { marginTop: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4 },
  stop: { color: Colors.gray[700], marginTop: 6 },
  link: { color: '#C2410C', fontWeight: '700', marginTop: 8 },
});
