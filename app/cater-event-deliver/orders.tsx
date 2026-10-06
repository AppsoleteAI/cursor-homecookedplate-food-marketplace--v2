import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useCaterEvent } from '@/hooks/cater-event-store';

export default function CaterOrdersScreen() {
  const { user } = useAuth();
  const { orders } = useCaterEvent();
  const dashboardHref = user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard';
  const spend = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    orders.forEach((order) => {
      const current = totals.get(order.organization) ?? { total: 0, count: 0 };
      totals.set(order.organization, { total: current.total + order.buyerPays, count: current.count + 1 });
    });
    return [...totals.entries()].map(([organization, value]) => ({ organization, ...value }));
  }, [orders]);

  return (
    <CaterEventScreen title="Catering orders" subtitle="Group drop-offs. Not plate orders." testID="cater-orders">
      {orders.length === 0 ? <Text style={styles.empty}>No catering orders yet.</Text> : null}
      {spend.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.name}>Spend by organization</Text>
          {spend.map((row) => (
            <Text key={row.organization} style={styles.line}>{row.organization} · ${row.total.toFixed(2)} · {row.count} order{row.count === 1 ? '' : 's'}</Text>
          ))}
        </View>
      ) : null}
      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <Text style={styles.name}>{order.companyName}</Text>
          <Text style={styles.meta}>{order.organization} · {order.dropoffWindow}</Text>
          <Text style={styles.meta}>{order.address}</Text>
          <Text style={styles.meta}>{new Date(order.createdAt).toLocaleString()}</Text>
          {order.lines.map((line) => (
            <Text key={line.packageId} style={styles.line}>{line.headcount} people × {line.name}</Text>
          ))}
          <Text style={styles.pay}>Paid ${order.buyerPays.toFixed(2)} · company drops off and sets up</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.button} onPress={() => router.push(dashboardHref)} testID="cater-orders-dashboard">
        <Text style={styles.buttonText}>{user?.role === 'platemaker' ? 'Plate maker dashboard' : 'Buyer dashboard'}</Text>
      </TouchableOpacity>
      {user?.role === 'platemaker' || user?.isAdmin ? (
        <TouchableOpacity onPress={() => router.push('/cater-event-deliver/seller' as Href)}>
          <Text style={styles.link}>Catering company</Text>
        </TouchableOpacity>
      ) : null}
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700] },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4 },
  line: { color: Colors.gray[700], marginTop: 4 },
  pay: { marginTop: 8, fontWeight: '700', color: '#6D28D9' },
  button: { marginTop: 8, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#6D28D9', fontWeight: '700' },
});
