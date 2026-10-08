import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
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
import { useShopCardPayment } from '@/hooks/use-shop-payment';

export default function FarmCheckoutScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { items, listings, placeOrder } = useFarmBasket();
  const { chargeShop, charging } = useShopCardPayment();
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

  const place = async () => {
    if (block || lines.length === 0 || charging) return;
    try {
      const paid = await chargeShop('farm', lines.map((line) => ({ productId: line.productId, quantity: line.quantity })));
      if (!paid) return;
      const order = placeOrder({
        id: paid.orderId,
        channel,
        lines,
        baseAmount,
        buyerPays: split.totalCaptured,
        sellerPayout: split.sellerPayout,
      });
      setOrderId(order.id);
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'The card was not charged.');
    }
  };

  if (orderId) {
    return (
      <FarmScreen title="Order placed" subtitle="Farm goods only" showBasket={false} testID="farm-checkout-done">
        <Text style={styles.lead}>Your card was charged for farm order {orderId}.</Text>
        <GlassPressable style={styles.button} onPress={() => router.push('/farm-grown-basket/orders' as Href)}>
          <Text style={styles.buttonText}>View Farm Orders</Text>
        </GlassPressable>
        <GlassPressable
          style={styles.secondary}
          onPress={() => router.push(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard')}
        >
          <Text style={styles.secondaryText}>{user?.role === 'platemaker' ? 'Plate Maker Dashboard' : 'Buyer Dashboard'}</Text>
        </GlassPressable>
      </FarmScreen>
    );
  }

  return (
    <FarmScreen title="Farm checkout" subtitle="Same fee split as the rest of the marketplace. A different basket." testID="farm-checkout">
      {lines.length === 0 ? (
        <GlassPressable onPress={() => router.push('/farm-grown-basket/market' as Href)}>
          <Text style={styles.link}>Add farm goods before checkout.</Text>
        </GlassPressable>
      ) : (
        lines.map((line) => (
          <Text key={line.productId} style={styles.line}>{line.quantity} × {titleCase(line.name)}</Text>
        ))
      )}
      <Text style={styles.section}>Handoff</Text>
      {FARM_CHANNELS.map((option) => (
        <GlassPressable key={option} style={[styles.option, channel === option && styles.optionOn]} onPress={() => setChannel(option)}>
          <Text style={[styles.optionText, channel === option && styles.optionTextOn]}>{channelLabel(option)}</Text>
        </GlassPressable>
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
      <GlassPressable
        style={[styles.button, (Boolean(block) || lines.length === 0 || charging) && styles.buttonOff]}
        disabled={Boolean(block) || lines.length === 0 || charging}
        onPress={place}
        testID="place-farm-order"
      >
        <Text style={styles.buttonText}>{charging ? 'Charging card' : 'Pay with card'}</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/checkout')}>
        <Text style={styles.link}>Cooked-plate Checkout</Text>
      </GlassPressable>
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
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.white  },
  secondaryText: { color: '#166534', fontWeight: '700' },
  link: { marginTop: 12, color: '#166534', fontWeight: '700' },
});
