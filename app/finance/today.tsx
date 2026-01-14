import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { useOrders } from '@/hooks/orders-context';
import BarChart, { BarDatum } from '@/components/BarChart';

export default function TodayFinanceScreen() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const { orders } = useOrders();

  const today = new Date();

  const todaysOrders = useMemo(() => orders.filter(o => o.status === 'completed' &&
    o.orderDate.getFullYear() === today.getFullYear() &&
    o.orderDate.getMonth() === today.getMonth() &&
    o.orderDate.getDate() === today.getDate()
  ), [orders, today.getFullYear(), today.getMonth(), today.getDate()]);

  const total = useMemo(() => todaysOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0), [todaysOrders]);
  const count = todaysOrders.length;
  const avg = count > 0 ? Number((total / count).toFixed(2)) : 0;

  const byHour: BarDatum[] = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let h = 8; h <= 22; h++) buckets[String(h)] = 0;
    todaysOrders.forEach(o => {
      const h = o.orderDate.getHours();
      const key = String(h);
      if (buckets[key] === undefined) buckets[key] = 0;
      buckets[key] += o.totalPrice ?? 0;
    });
    return Object.keys(buckets)
      .sort((a,b) => Number(a)-Number(b))
      .map(k => ({ label: `${k}:00`, value: Number(buckets[k].toFixed(2)) }));
  }, [todaysOrders]);

  return (
    <View style={styles.container}>
      <View style={styles.staticHeader}>
        <LinearGradient
          colors={monoGradients.green}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height ?? 0;
            if (h !== headerHeight) {
              setHeaderHeight(h);
            }
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{'Today\u2019s Earnings'}</Text>
            <Text style={styles.subtitle}>{today.toLocaleDateString()}</Text>
          </View>
        </LinearGradient>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}>

        <View style={styles.column}>
          <View style={styles.ordersRow}>
            <View style={[styles.card, styles.orderCard]} testID="today-orders">
              <Text style={styles.cardLabel}>Orders</Text>
              <Text style={styles.cardValue}>{count}</Text>
            </View>
          </View>

          <View style={styles.cardsRow}>
            <View style={[styles.card, styles.wideCard]} testID="today-total">
              <Text style={styles.cardLabel}>Total</Text>
              <Text style={styles.cardValue}>${total.toFixed(2)}</Text>
            </View>
            <View style={[styles.card, styles.wideCard]} testID="today-average">
              <Text style={styles.cardLabel}>Avg Order</Text>
              <Text style={styles.cardValue}>${avg.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hourly Earnings</Text>
          <BarChart data={byHour} height={180} barColor={monoGradients.green[0]} />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  staticHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: { paddingHorizontal: 24, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  scrollContent: { paddingBottom: 100 },
  header: { paddingTop: 16, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.white, opacity: 0.9 },
  column: { flexDirection: 'column', gap: 12, paddingHorizontal: 24, marginTop: 12 },
  cardsRow: { flexDirection: 'row', gap: 12 },
  ordersRow: { flexDirection: 'row' },
  card: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  orderCard: { paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'stretch' },
  wideCard: { paddingHorizontal: 20 },
  cardLabel: { fontSize: 12, color: Colors.gray[600] },
  cardValue: { fontSize: 20, color: Colors.gray[900], fontWeight: '700', marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.gray[900], marginBottom: 12 },
});
