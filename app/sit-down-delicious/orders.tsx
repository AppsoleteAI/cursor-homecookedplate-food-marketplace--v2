import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useSitDown } from '@/hooks/sit-down-store';
import { SERVICE_LABEL } from '@/lib/sit-down-license';

export default function SitOrdersScreen() {
  const { user } = useAuth();
  const { orders } = useSitDown();
  const dashboardHref = user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard';

  return (
    <SitDownScreen title="Restaurant orders" subtitle="Tables and takeout. Not plate orders." testID="sit-orders">
      {orders.length === 0 ? <Text style={styles.empty}>No restaurant orders yet.</Text> : null}
      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <Text style={styles.name}>{order.placeName}</Text>
          <Text style={styles.meta}>
            {SERVICE_LABEL[order.service]}
            {order.service === 'sit_down' ? ` · party of ${order.partySize}` : ''}
            {' · '}
            {new Date(order.createdAt).toLocaleString()}
          </Text>
          {order.lines.map((line) => (
            <Text key={line.itemId} style={styles.line}>{line.quantity} × {titleCase(line.name)}</Text>
          ))}
          <Text style={styles.pay}>Paid ${order.buyerPays.toFixed(2)} · served at the restaurant</Text>
        </View>
      ))}
      <GlassPressable style={styles.button} onPress={() => router.push(dashboardHref)} testID="sit-orders-dashboard">
        <Text style={styles.buttonText}>{user?.role === 'platemaker' ? 'Plate Maker Dashboard' : 'Buyer Dashboard'}</Text>
      </GlassPressable>
      {user?.role === 'platemaker' || user?.isAdmin ? (
        <GlassPressable onPress={() => router.push('/sit-down-delicious/seller' as Href)}>
          <Text style={styles.link}>Shop Owner</Text>
        </GlassPressable>
      ) : null}
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700] },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10  },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4, marginBottom: 6 },
  line: { color: Colors.gray[700] },
  pay: { marginTop: 8, fontWeight: '700', color: '#92400E' },
  button: { ...glassSurface, marginTop: 8, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#92400E', fontWeight: '700' },
});
