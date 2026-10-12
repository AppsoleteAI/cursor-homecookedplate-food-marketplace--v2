import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { CHECKOUT_AREA_LABEL, quoteCheckout, quoteCombined } from '@/backend/lib/combined-checkout';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem } from '@/constants/food-truck-popup';
import { getPrepItem } from '@/constants/meal-prep-go';
import { getPackage } from '@/constants/cater-event-deliver';
import { getSitItem } from '@/constants/sit-down-delicious';
import { useCart } from '@/hooks/cart-context';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { useSitDown } from '@/hooks/sit-down-store';
import { gatherCombinedCheckouts } from '@/lib/gather-combined-checkouts';
import { useStripe } from '@/lib/stripe';
import { trpc } from '@/lib/trpc';

function previewLine(area: string, productId: string, quantity: number) {
  if (area === 'home') return null;
  if (area === 'farm') {
    const product = getCatalogProduct(productId);
    return product ? { name: product.name, quantity, unitPrice: product.price } : null;
  }
  if (area === 'meal_prep') {
    const item = getPrepItem(productId);
    return item ? { name: item.name, quantity, unitPrice: item.price } : null;
  }
  if (area === 'food_truck' || area === 'food_cart') {
    const item = getMenuItem(productId);
    return item ? { name: item.name, quantity, unitPrice: item.price } : null;
  }
  if (area === 'catering') {
    const item = getPackage(productId);
    return item ? { name: item.name, quantity, unitPrice: item.pricePerPerson } : null;
  }
  const item = getSitItem(productId);
  return item ? { name: item.name, quantity, unitPrice: item.price } : null;
}

export default function CombinedCheckoutScreen() {
  const cart = useCart();
  const farm = useFarmBasket();
  const prep = useMealPrep();
  const truck = useFoodTruck();
  const cater = useCaterEvent();
  const sit = useSitDown();
  const stripe = useStripe();
  const createCheckout = trpc.payments.createCombinedCheckout.useMutation();
  const confirmCheckout = trpc.payments.confirmCombinedCheckout.useMutation();
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);

  const gathered = useMemo(() => gatherCombinedCheckouts({
    home: cart.items,
    farm: farm.items,
    prep: prep.items,
    truck: truck.items,
    cater: cater.items,
    sit: sit.items,
  }), [cart.items, farm.items, prep.items, truck.items, cater.items, sit.items]);

  const preview = useMemo(() => quoteCombined(gathered.checkouts.map((checkout) => quoteCheckout({
    area: checkout.area,
    sellerId: checkout.sellerId,
    sellerName: checkout.sellerName,
    lines: checkout.area === 'home'
      ? cart.items
        .filter((item) => item.meal.plateMakerId === checkout.sellerId)
        .map((item) => ({ name: item.meal.name, quantity: item.quantity, unitPrice: item.meal.price }))
      : checkout.lines.flatMap((line) => {
        const priced = previewLine(checkout.area, line.productId, line.quantity);
        return priced ? [priced] : [];
      }),
  }))), [gathered.checkouts, cart.items]);

  const pay = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Phone checkout', 'The combined card charge is available on the mobile app.');
      return;
    }
    if (gathered.checkouts.length < 1) {
      Alert.alert('Nothing to combine', 'Add a plate or an open in-app store before paying together.');
      return;
    }
    setCharging(true);
    try {
      const created = await createCheckout.mutateAsync({ checkouts: gathered.checkouts });
      const initPaymentSheet = stripe?.initPaymentSheet;
      const presentPaymentSheet = stripe?.presentPaymentSheet;
      if (!initPaymentSheet || !presentPaymentSheet || !created.clientSecret) {
        throw new Error('Payment system not available');
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: created.clientSecret,
        merchantDisplayName: 'HomeCookedPlate',
        returnURL: 'homecookedplate://combined-checkout',
      });
      if (initError) throw new Error(initError.message);
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return;
        throw new Error(presentError.message);
      }
      await confirmCheckout.mutateAsync({
        paymentIntentId: created.paymentIntentId,
        checkouts: gathered.checkouts,
      });
      if (gathered.checkouts.some((checkout) => checkout.area === 'home')) cart.clearCart();
      if (gathered.checkouts.some((checkout) => checkout.area === 'farm')) farm.clearItems();
      if (gathered.checkouts.some((checkout) => checkout.area === 'meal_prep')) prep.clearWeek();
      if (gathered.checkouts.some((checkout) => checkout.area === 'food_truck' || checkout.area === 'food_cart')) truck.clearItems();
      if (gathered.checkouts.some((checkout) => checkout.area === 'catering')) cater.clearItems();
      if (gathered.checkouts.some((checkout) => checkout.area === 'sit_down' || checkout.area === 'ghost_kitchen')) sit.clearItems();
      setReceiptId(created.paymentIntentId);
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'The card was not charged.');
    } finally {
      setCharging(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>One charge</Text>
        <Text style={styles.lead}>
          Each section stays its own checkout. One card pays all of them. A later refund can return one checkout and leave the others paid.
        </Text>
        {preview.checkouts.map((checkout) => (
          <View key={checkout.id} style={styles.card}>
            <Text style={styles.seller}>{CHECKOUT_AREA_LABEL[checkout.area]} · {checkout.sellerName}</Text>
            {checkout.lines.map((line) => (
              <Text key={`${checkout.id}-${line.name}`} style={styles.line}>{line.quantity} × {line.name} · ${line.unitPrice.toFixed(2)}</Text>
            ))}
            <Text style={styles.meta}>Base ${checkout.baseAmount.toFixed(2)}</Text>
            <Text style={styles.meta}>Buyer fee ${checkout.buyerFee.toFixed(2)} · Seller fee ${checkout.sellerFee.toFixed(2)}</Text>
            <Text style={styles.meta}>You pay ${checkout.buyerPays.toFixed(2)} · Seller receives ${checkout.sellerPayout.toFixed(2)} after 7 days</Text>
          </View>
        ))}
        {gathered.blocked.map((reason) => (
          <Text key={reason} style={styles.blocked}>{reason}</Text>
        ))}
        <View style={styles.totalCard}>
          <Text style={styles.total}>Combined total ${preview.combinedBuyerPays.toFixed(2)}</Text>
          <Text style={styles.meta}>{preview.checkouts.length} checkout{preview.checkouts.length === 1 ? '' : 's'} · Platform keeps ${preview.combinedPlatform.toFixed(2)}</Text>
        </View>
        {receiptId ? <Text style={styles.ok}>Paid on one charge. Each seller is on the 7-day payout.</Text> : null}
        <GlassPressable style={styles.button} onPress={pay}>
          <Text style={styles.buttonText}>{charging ? 'Charging…' : 'Pay together'}</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/(tabs)/cart' as Href)}>
          <Text style={styles.link}>Back to carts</Text>
        </GlassPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gray[50] },
  body: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray[900] },
  lead: { color: Colors.gray[600], marginTop: 8, marginBottom: 16, lineHeight: 22 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  seller: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  line: { color: Colors.gray[800], marginBottom: 2 },
  meta: { color: Colors.gray[600], marginTop: 4 },
  blocked: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  totalCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginVertical: 8 },
  total: { fontSize: 22, fontWeight: '700', color: Colors.gray[900] },
  ok: { color: '#166534', fontWeight: '600', marginBottom: 8 },
  button: { backgroundColor: Colors.gray[900], borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { textAlign: 'center', marginTop: 14, color: Colors.gray[700], fontWeight: '600' },
});
