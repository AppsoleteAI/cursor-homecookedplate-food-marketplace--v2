import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { getMenuItem, getTruck } from '@/constants/food-truck-popup';
import { useAuth } from '@/hooks/auth-context';
import { useFoodTruck, type TruckOrderLine } from '@/hooks/food-truck-store';
import { PICKUP_SLOTS, type PickupSlot } from '@/lib/food-truck-permit';
import { calculateOrderSplit } from '@/lib/fees';
import { useShopCardPayment } from '@/hooks/use-shop-payment';

export default function TruckCheckoutScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { items, listings, permit, ownerActive, placeOrder } = useFoodTruck();
  const { chargeShop, charging } = useShopCardPayment();
  const [slot, setSlot] = useState<PickupSlot>('Next 15 minutes');
  const [orderId, setOrderId] = useState<string | null>(null);

  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getMenuItem(item.itemId);
      const listing = listings.find((entry) => entry.id === item.itemId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      if (!name || price === undefined) return [];
      const line: TruckOrderLine = { itemId: item.itemId, name, quantity: item.quantity, unitPrice: price };
      return [line];
    });
  }, [items, listings]);

  const truckId = items[0]?.truckId ?? '';
  const catalogTruck = getTruck(truckId);
  const truckName = truckId === 'owner-truck' ? permit?.truckName ?? 'Your truck' : catalogTruck?.name ?? 'Truck';
  const windowOpen = truckId === 'owner-truck' ? ownerActive : Boolean(catalogTruck?.active);
  const baseAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const place = async () => {
    if (!windowOpen || lines.length === 0 || charging) return;
    try {
      const paid = await chargeShop('food_truck', lines.map((line) => ({ productId: line.itemId, quantity: line.quantity })));
      if (!paid) return;
      const order = placeOrder({
        id: paid.orderId,
        truckId,
        truckName,
        pickupSlot: slot,
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
      <FoodTruckScreen title="Ticket in" subtitle="Pick it up at the window" showBasket={false} testID="truck-checkout-done">
        <Text style={styles.lead}>{truckName} has ticket {orderId}. Show it at the service window. Nothing is sent to a courier.</Text>
        <GlassPressable style={styles.button} onPress={() => router.push('/food-truck-popup/orders' as Href)}>
          <Text style={styles.buttonText}>Truck Orders</Text>
        </GlassPressable>
        <GlassPressable style={styles.secondary} onPress={() => router.push(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard')}>
          <Text style={styles.secondaryText}>{user?.role === 'platemaker' ? 'Plate Maker Dashboard' : 'Buyer Dashboard'}</Text>
        </GlassPressable>
      </FoodTruckScreen>
    );
  }

  return (
    <FoodTruckScreen title="Truck checkout" subtitle="Window pickup. Same fee split as the rest of the app." testID="truck-checkout">
      {lines.length === 0 ? (
        <GlassPressable onPress={() => router.push('/food-truck-popup/board' as Href)}>
          <Text style={styles.link}>Choose an open truck first.</Text>
        </GlassPressable>
      ) : (
        <View>
          <Text style={styles.truck}>{truckName}</Text>
          {lines.map((line) => (
            <Text key={line.itemId} style={styles.line}>{line.quantity} × {titleCase(line.name)}</Text>
          ))}
        </View>
      )}
      {!windowOpen && lines.length > 0 ? <Text style={styles.block}>This window is closed. Check the schedule and come back when the truck is active.</Text> : null}
      <Text style={styles.section}>Order-ahead</Text>
      {PICKUP_SLOTS.map((option) => (
        <GlassPressable key={option} style={[styles.option, slot === option && styles.optionOn]} onPress={() => setSlot(option)}>
          <Text style={[styles.optionText, slot === option && styles.optionTextOn]}>{option}</Text>
        </GlassPressable>
      ))}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Food ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <Text style={styles.note}>Dedicated truck ordering here is pickup only. A 15% to 30% courier commission is not added.</Text>
      <GlassPressable
        style={[styles.button, (!windowOpen || lines.length === 0 || charging) && styles.buttonOff]}
        disabled={!windowOpen || lines.length === 0 || charging}
        onPress={place}
        testID="place-truck-order"
      >
        <Text style={styles.buttonText}>{charging ? 'Charging card' : 'Pay with card'}</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/checkout')}>
        <Text style={styles.link}>Cooked-plate Checkout</Text>
      </GlassPressable>
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 22, fontSize: 16 },
  truck: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  line: { color: Colors.gray[800], marginBottom: 4 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  option: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { backgroundColor: '#C2410C' },
  optionText: { color: Colors.gray[800], fontWeight: '600' },
  optionTextOn: { color: Colors.white },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginVertical: 4 },
  note: { marginTop: 10, color: Colors.gray[600], lineHeight: 20 },
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.white  },
  secondaryText: { color: '#C2410C', fontWeight: '700' },
  link: { marginTop: 12, color: '#C2410C', fontWeight: '700' },
});
