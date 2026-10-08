import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { channelLabel } from '@/lib/cottage-food';

export default function FarmOrdersScreen() {
  const { user } = useAuth();
  const { orders } = useFarmBasket();
  const dashboardHref = user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard';

  return (
    <FarmScreen title="Farm orders" subtitle="These are not cooked-plate orders." testID="farm-orders">
      {orders.length === 0 ? <Text style={styles.empty}>No farm orders yet.</Text> : null}
      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <Text style={styles.name}>{order.id}</Text>
          <Text style={styles.meta}>{new Date(order.createdAt).toLocaleString()} · {channelLabel(order.channel)}</Text>
          {order.lines.map((line) => (
            <Text key={line.productId} style={styles.line}>{line.quantity} × {titleCase(line.name)}</Text>
          ))}
          <Text style={styles.pay}>Paid ${order.buyerPays.toFixed(2)}</Text>
        </View>
      ))}
      <GlassPressable style={styles.button} onPress={() => router.push(dashboardHref)} testID="farm-orders-dashboard">
        <Text style={styles.buttonText}>{user?.role === 'platemaker' ? 'Plate Maker Dashboard' : 'Buyer Dashboard'}</Text>
      </GlassPressable>
      {user?.role === 'platemaker' || user?.isAdmin ? (
        <GlassPressable onPress={() => router.push('/farm-grown-basket/seller' as Href)}>
          <Text style={styles.link}>Seller Stand and Payouts</Text>
        </GlassPressable>
      ) : null}
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700] },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10  },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4, marginBottom: 6 },
  line: { color: Colors.gray[700] },
  pay: { marginTop: 8, fontWeight: '700', color: '#166534' },
  button: { ...glassSurface, marginTop: 8, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#166534', fontWeight: '700' },
});
