import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { useOrders } from '@/hooks/orders-context';
import BarChart, { BarDatum } from '@/components/BarChart';

function getWeekDays(): string[] {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days;
}

function monthShort(idx: number): string {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][idx] ?? '';
}

export default function PeriodsFinanceScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const [tab, setTab] = useState<'weekly' | 'monthly' | 'ytd'>('weekly');
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  const now = new Date();

  const weeklyData: BarDatum[] = useMemo(() => {
    const todayIdx = now.getDay();
    const base = new Date(now);
    base.setDate(now.getDate() - todayIdx);
    base.setHours(0,0,0,0);
    const buckets: number[] = new Array(7).fill(0);
    orders.filter(o => o.status === 'completed').forEach(o => {
      const diff = Math.floor((o.orderDate.getTime() - base.getTime()) / (24*60*60*1000));
      if (diff >= 0 && diff < 7) buckets[diff] += o.totalPrice ?? 0;
    });
    return buckets.map((v, i) => ({ label: getWeekDays()[i], value: Number(v.toFixed(2)) }));
  }, [orders, now]);

  const monthlyData: BarDatum[] = useMemo(() => {
    const year = now.getFullYear();
    const buckets: number[] = new Array(12).fill(0);
    orders.filter(o => o.status === 'completed' && o.orderDate.getFullYear() === year).forEach(o => {
      buckets[o.orderDate.getMonth()] += o.totalPrice ?? 0;
    });
    return buckets.map((v, i) => ({ label: monthShort(i), value: Number(v.toFixed(2)) }));
  }, [orders, now]);

  const ytdData: BarDatum[] = useMemo(() => {
    const year = now.getFullYear();
    const currentMonth = now.getMonth();
    const buckets: number[] = new Array(currentMonth + 1).fill(0);
    orders.filter(o => o.status === 'completed' && o.orderDate.getFullYear() === year).forEach(o => {
      const m = o.orderDate.getMonth();
      if (m <= currentMonth) buckets[m] += o.totalPrice ?? 0;
    });
    return buckets.map((v, i) => ({ label: monthShort(i), value: Number(v.toFixed(2)) }));
  }, [orders, now]);

  const totalWeekly = weeklyData.reduce((s,d)=>s+d.value,0);
  const totalMonthly = monthlyData.reduce((s,d)=>s+d.value,0);
  const totalYTD = ytdData.reduce((s,d)=>s+d.value,0);

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
            <Text style={styles.title}>This Week</Text>
            <Text style={styles.subtitle}>Weekly, Monthly, Year-to-Date</Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
      >
        <View style={styles.tabs}>
          {(['weekly','monthly','ytd'] as const).map(k => (
            <TouchableOpacity
              key={k}
              style={[styles.tab, tab === k && styles.tabActive]}
              onPress={() => setTab(k)}
              testID={`finance-tab-${k}`}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{k.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'weekly' && (
          <View style={styles.section}>
            <View style={styles.cardWide}>
              <Text style={styles.cardLabel}>Weekly Total</Text>
              <Text style={styles.cardValue}>${totalWeekly.toFixed(2)}</Text>
            </View>
            <Text style={styles.sectionTitle}>By Day</Text>
            <BarChart data={weeklyData} height={200} barColor={monoGradients.green[0]} />
          </View>
        )}

        {tab === 'monthly' && (
          <View style={styles.section}>
            <View style={styles.cardWide}>
              <Text style={styles.cardLabel}>Year Total</Text>
              <Text style={styles.cardValue}>${totalMonthly.toFixed(2)}</Text>
            </View>
            <Text style={styles.sectionTitle}>By Month</Text>
            <BarChart data={monthlyData} height={200} barColor={monoGradients.green[0]} />
          </View>
        )}

        {tab === 'ytd' && (
          <View style={styles.section}>
            <View style={styles.cardWide}>
              <Text style={styles.cardLabel}>YTD Total</Text>
              <Text style={styles.cardValue}>${totalYTD.toFixed(2)}</Text>
            </View>
            <Text style={styles.sectionTitle}>Year-to-Date</Text>
            <BarChart data={ytdData} height={200} barColor={monoGradients.green[0]} />
          </View>
        )}
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
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[200] },
  tabActive: { backgroundColor: Colors.gray[900] },
  tabText: { color: Colors.gray[700], fontWeight: '600' },
  tabTextActive: { color: Colors.white, fontWeight: '700' },
  section: { marginTop: 24, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.gray[900], marginBottom: 12 },
  cardWide: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, elevation: 1, marginBottom: 12 },
  cardLabel: { fontSize: 12, color: Colors.gray[600] },
  cardValue: { fontSize: 20, color: Colors.gray[900], fontWeight: '700', marginTop: 4 },
});
