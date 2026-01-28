import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useOrders } from '@/hooks/orders-context';

export default function ActiveOrdersModal() {
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();
  const active = useMemo(() => orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled'), [orders]);

  const grouped = useMemo(() => {
    const map: Record<string, { label: string; items: typeof active }> = {} as Record<string, { label: string; items: typeof active }>;
    active.forEach((o) => {
      const key = o.plateTakerId;
      if (!map[key]) {
        map[key] = { label: o.plateTakerName ?? o.plateTakerId, items: [] as typeof active } as { label: string; items: typeof active };
      }
      map[key].items.push(o);
    });
    return Object.entries(map);
  }, [active]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={monoGradients.green} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.header, { paddingTop: insets.top }] }>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Active Orders</Text>
          <TouchableOpacity onPress={() => router.back()} testID="close-active-orders">
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Live count and payouts</Text>
      </LinearGradient>

      {active.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No active orders</Text>
          <Text style={styles.emptySub}>You’re all caught up!</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {grouped.map(([accountId, group]) => (
            <View key={accountId} style={styles.group}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              {group.items.map((o) => (
                <TouchableOpacity key={o.id} style={styles.card} onPress={() => router.push({ pathname: '/order/[id]' as const, params: { id: o.id } })} testID={`order-card-${o.id}`}>
                  <Image source={{ uri: o.mealImage }} style={styles.image} />
                  <View style={styles.content}>
                    <Text style={styles.name}>{o.mealName}</Text>
                    <Text style={styles.meta}>Qty {o.quantity} • Status: {o.status}</Text>
                    <Text style={styles.meta}>Expected ready: {o.pickupTime ? new Date(o.pickupTime).toLocaleTimeString() : '—'}</Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.price}>${o.totalPrice.toFixed(2)}</Text>
                    <Text style={[styles.paidBadge, { color: o.paid ? Colors.success : Colors.error }]}>{o.paid ? 'Paid' : 'Unpaid'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.white },
  headerSubtitle: { marginTop: 6, color: Colors.white, opacity: 0.9 },
  closeText: { color: Colors.white, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray[800] },
  emptySub: { fontSize: 14, color: Colors.gray[500], marginTop: 6 },
  list: { padding: 16 },
  group: { marginBottom: 12 },
  groupTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.gray[500], marginBottom: 8, paddingHorizontal: 4, textTransform: 'uppercase' as const },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  image: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  content: { flex: 1 },
  right: { alignItems: 'flex-end' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { marginTop: 2, fontSize: 12, color: Colors.gray[600] },
  price: { fontSize: 16, fontWeight: '700', color: Colors.gradient.green },
  paidBadge: { marginTop: 6, fontSize: 12, fontWeight: '600' as const },
});
