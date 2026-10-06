import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useFoodTruck } from '@/hooks/food-truck-store';

export default function TruckOrdersScreen() {
  const { user } = useAuth();
  const { orders } = useFoodTruck();
  const dashboardHref = user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard';

  return (
    <FoodTruckScreen title="Truck orders" subtitle="Window tickets. Not plate orders." testID="truck-orders">
      {orders.length === 0 ? <Text style={styles.empty}>No truck orders yet.</Text> : null}
      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <Text style={styles.name}>{order.truckName}</Text>
          <Text style={styles.meta}>{order.pickupSlot} · {new Date(order.createdAt).toLocaleString()}</Text>
          {order.lines.map((line) => (
            <Text key={line.itemId} style={styles.line}>{line.quantity} × {line.name}</Text>
          ))}
          <Text style={styles.pay}>Paid ${order.buyerPays.toFixed(2)} · pick up at the window</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.button} onPress={() => router.push(dashboardHref)} testID="truck-orders-dashboard">
        <Text style={styles.buttonText}>{user?.role === 'platemaker' ? 'Plate maker dashboard' : 'Buyer dashboard'}</Text>
      </TouchableOpacity>
      {user?.role === 'platemaker' || user?.isAdmin ? (
        <TouchableOpacity onPress={() => router.push('/food-truck-popup/seller' as Href)}>
          <Text style={styles.link}>Truck owner</Text>
        </TouchableOpacity>
      ) : null}
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700] },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4, marginBottom: 6 },
  line: { color: Colors.gray[700] },
  pay: { marginTop: 8, fontWeight: '700', color: '#C2410C' },
  button: { marginTop: 8, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#C2410C', fontWeight: '700' },
});
