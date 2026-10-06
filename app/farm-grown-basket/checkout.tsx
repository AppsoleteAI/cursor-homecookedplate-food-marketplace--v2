import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Redirect, router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { useAuth } from '@/hooks/auth-context';
import { useFarmBasket, type FarmOrderLine } from '@/hooks/farm-basket-store';
import {
  FARM_CHANNELS,
  buyerChannelBlock,
  channelLabel,
  channelWarning,
  type FarmChannel,
  type RegulatoryTrack,
} from '@/lib/cottage-food';
import { calculateOrderSplit } from '@/lib/fees';

export default function FarmCheckoutScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { items, listings, placeOrder } = useFarmBasket();
  const [channel, setChannel] = useState<FarmChannel>('farm_pickup');
  const [orderId, setOrderId] = useState<string | null>(null);

  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getCatalogProduct(item.productId);
      const listing = listings.find((entry) => entry.id === item.productId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      const track = catalog?.track ?? listing?.track;
      if (!name || price === undefined || !track) return [];
      const line: FarmOrderLine = {
        productId: item.productId,
        name,
        quantity: item.quantity,
        unitPrice: price,
        track,
      };
      return [line];
    });
  }, [items, listings]);

  const tracks = lines.map((line) => line.track);
  const baseAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);
  const block = tracks.map((track) => buyerChannelBlock(track, channel)).find(Boolean) ?? null;
  const warnings = [...new Set(
    tracks
      .map((track: RegulatoryTrack) => channelWarning(track, channel))
      .filter((warning): warning is string => Boolean(warning))
  )];

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const place = () => {
    if (block || lines.length === 0) return;
    const order = placeOrder({
      channel,
      lines,
      baseAmount,
      buyerPays: split.totalCaptured,
      sellerPayout: split.sellerPayout,
    });
    setOrderId(order.id);
  };

  if (orderId) {
    return (
      <FarmScreen title="Order placed" subtitle="Farm goods only" showBasket={false} testID="farm-checkout-done">
        <Text style={styles.lead}>Your farm order {orderId} is recorded. The producer is paid from the goods subtotal after the platform fee.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/farm-grown-basket/orders' as Href)}>
          <Text style={styles.buttonText}>View farm orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() => router.push(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard')}
        >
          <Text style={styles.secondaryText}>{user?.role === 'platemaker' ? 'Plate maker dashboard' : 'Buyer dashboard'}</Text>
        </TouchableOpacity>
      </FarmScreen>
    );
  }

  return (
    <FarmScreen title="Farm checkout" subtitle="Same fee split as the rest of the marketplace. A different basket." testID="farm-checkout">
      {lines.length === 0 ? (
        <TouchableOpacity onPress={() => router.push('/farm-grown-basket/market' as Href)}>
          <Text style={styles.link}>Add farm goods before checkout.</Text>
        </TouchableOpacity>
      ) : (
        lines.map((line) => (
          <Text key={line.productId} style={styles.line}>{line.quantity} × {line.name}</Text>
        ))
      )}
      <Text style={styles.section}>Handoff</Text>
      {FARM_CHANNELS.map((option) => (
        <TouchableOpacity key={option} style={[styles.option, channel === option && styles.optionOn]} onPress={() => setChannel(option)}>
          <Text style={[styles.optionText, channel === option && styles.optionTextOn]}>{channelLabel(option)}</Text>
        </TouchableOpacity>
      ))}
      {block ? <Text style={styles.block}>{block}</Text> : null}
      {warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>{warning}</Text>
      ))}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Goods ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <Text style={styles.note}>Mail shipping is not offered. The person who made the food hands it to you.</Text>
      <TouchableOpacity
        style={[styles.button, (Boolean(block) || lines.length === 0) && styles.buttonOff]}
        disabled={Boolean(block) || lines.length === 0}
        onPress={place}
        testID="place-farm-order"
      >
        <Text style={styles.buttonText}>Place farm order</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/checkout')}>
        <Text style={styles.link}>Cooked-plate checkout</Text>
      </TouchableOpacity>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 22, fontSize: 16 },
  line: { color: Colors.gray[800], marginBottom: 4 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  option: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { backgroundColor: '#166534' },
  optionText: { color: Colors.gray[800], fontWeight: '600' },
  optionTextOn: { color: Colors.white },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  warning: { color: '#92400E', marginTop: 8, lineHeight: 20 },
  totals: { marginTop: 14, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginVertical: 4 },
  note: { marginTop: 10, color: Colors.gray[600], lineHeight: 20 },
  button: { marginTop: 14, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.white },
  secondaryText: { color: '#166534', fontWeight: '700' },
  link: { marginTop: 12, color: '#166534', fontWeight: '700' },
});
