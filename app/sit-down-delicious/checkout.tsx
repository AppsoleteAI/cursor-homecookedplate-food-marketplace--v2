import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { getPlace, getSitItem } from '@/constants/sit-down-delicious';
import { useAuth } from '@/hooks/auth-context';
import { useSitDown, type SitOrderLine } from '@/hooks/sit-down-store';
import { SERVICE_LABEL, type DiningService } from '@/lib/sit-down-license';
import { calculateOrderSplit } from '@/lib/fees';
import { useShopCardPayment } from '@/hooks/use-shop-payment';

const PARTY = [1, 2, 3, 4, 5, 6, 8, 10, 12];

export default function SitCheckoutScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { items, listings, license, ownerOpen, placeOrder } = useSitDown();
  const { chargeShop, charging } = useShopCardPayment();
  const [service, setService] = useState<DiningService>('sit_down');
  const [partySize, setPartySize] = useState(2);
  const [orderId, setOrderId] = useState<string | null>(null);

  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getSitItem(item.itemId);
      const listing = listings.find((entry) => entry.id === item.itemId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      if (!name || price === undefined) return [];
      const line: SitOrderLine = { itemId: item.itemId, name, quantity: item.quantity, unitPrice: price };
      return [line];
    });
  }, [items, listings]);

  const placeId = items[0]?.placeId ?? '';
  const catalogPlace = getPlace(placeId);
  const placeName = placeId === 'owner-place' ? license?.placeName ?? 'Your restaurant' : catalogPlace?.name ?? 'Restaurant';
  const open = placeId === 'owner-place' ? ownerOpen : Boolean(catalogPlace?.openNow);
  const services: DiningService[] = placeId === 'owner-place'
    ? [
        ...(license?.offersSitDown ? (['sit_down'] as const) : []),
        ...(license?.offersTakeout ? (['takeout'] as const) : []),
      ]
    : catalogPlace?.services ?? [];
  const chosen = services.includes(service) ? service : services[0] ?? 'takeout';
  const baseAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const place = async () => {
    if (!open || lines.length === 0 || services.length === 0 || charging) return;
    try {
      const paid = await chargeShop('sit_down', lines.map((line) => ({ productId: line.itemId, quantity: line.quantity })));
      if (!paid) return;
      const order = placeOrder({
        id: paid.orderId,
        placeId,
        placeName,
        service: chosen,
        partySize: chosen === 'sit_down' ? partySize : 1,
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
      <SitDownScreen title="Order in" subtitle={chosen === 'sit_down' ? 'A table is held' : 'Pick up at the counter'} showBasket={false} testID="sit-checkout-done">
        <Text style={styles.lead}>
          {placeName} has order {orderId}.
          {chosen === 'sit_down' ? ` A table is held for ${partySize}.` : ' Pick it up at the counter.'}
          {' '}Nothing is sent to a courier.
        </Text>
        <GlassPressable style={styles.button} onPress={() => router.push('/sit-down-delicious/orders' as Href)}>
          <Text style={styles.buttonText}>Restaurant Orders</Text>
        </GlassPressable>
        <GlassPressable style={styles.secondary} onPress={() => router.push(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard')}>
          <Text style={styles.secondaryText}>{user?.role === 'platemaker' ? 'Plate Maker Dashboard' : 'Buyer Dashboard'}</Text>
        </GlassPressable>
      </SitDownScreen>
    );
  }

  return (
    <SitDownScreen title="Restaurant checkout" subtitle="Sit down or takeout. Same fee split as the rest of the app." testID="sit-checkout">
      {lines.length === 0 ? (
        <GlassPressable onPress={() => router.push('/sit-down-delicious/places' as Href)}>
          <Text style={styles.link}>Choose an open shop first.</Text>
        </GlassPressable>
      ) : (
        <View>
          <Text style={styles.place}>{placeName}</Text>
          {lines.map((line) => (
            <Text key={line.itemId} style={styles.line}>{line.quantity} × {titleCase(line.name)}</Text>
          ))}
        </View>
      )}
      {!open && lines.length > 0 ? <Text style={styles.block}>This shop is closed. Come back when the dining room is open.</Text> : null}
      <Text style={styles.section}>How you eat</Text>
      {services.map((option) => (
        <GlassPressable key={option} style={[styles.option, chosen === option && styles.optionOn]} onPress={() => setService(option)}>
          <Text style={[styles.optionText, chosen === option && styles.optionTextOn]}>{SERVICE_LABEL[option]}</Text>
        </GlassPressable>
      ))}
      {chosen === 'sit_down' ? (
        <View>
          <Text style={styles.section}>Party size</Text>
          <View style={styles.chips}>
            {PARTY.map((size) => (
              <GlassPressable key={size} style={[styles.chip, partySize === size && styles.optionOn]} onPress={() => setPartySize(size)}>
                <Text style={[styles.optionText, partySize === size && styles.optionTextOn]}>{size}</Text>
              </GlassPressable>
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Food ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <Text style={styles.note}>This order is served at the restaurant. A 15% to 30% courier commission is not added, and paying more does not move a shop up the list.</Text>
      <GlassPressable
        style={[styles.button, (!open || lines.length === 0 || charging) && styles.buttonOff]}
        disabled={!open || lines.length === 0 || charging}
        onPress={place}
        testID="place-sit-order"
      >
        <Text style={styles.buttonText}>{charging ? 'Charging card' : 'Pay with card'}</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/checkout')}>
        <Text style={styles.link}>Cooked-plate Checkout</Text>
      </GlassPressable>
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 22, fontSize: 16 },
  place: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  line: { color: Colors.gray[800], marginBottom: 4 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  option: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { backgroundColor: '#92400E' },
  optionText: { color: Colors.gray[800], fontWeight: '600' },
  optionTextOn: { color: Colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginVertical: 4 },
  note: { marginTop: 10, color: Colors.gray[600], lineHeight: 20 },
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.white  },
  secondaryText: { color: '#92400E', fontWeight: '700' },
  link: { marginTop: 12, color: '#92400E', fontWeight: '700' },
});
