import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHECKOUT_AREA_LABEL, quoteCard } from '@/backend/lib/combined-checkout';
import { calculateDeliveryLevy, promotionalBase } from '@/backend/lib/fees';
import { accountAccessCopy } from '@/backend/lib/sign-in-messages';
import { checkoutAreaShop, type ShopFulfillment } from '@/backend/lib/shop-fulfillment';
import { CombinedHandoffFields } from '@/components/CombinedHandoffFields';
import { DeliveryLevyLines, useDeliveryQuote } from '@/components/DeliveryFeeCard';
import { ScheduleTimePicker } from '@/components/ScheduleTimePicker';
import { GlassPressable } from '@/components/glass-surface';
import { useLeaveScreen, usePaidBack, useStayBack } from '@/hooks/use-leave-screen';
import { Colors } from '@/constants/colors';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem } from '@/constants/food-truck-popup';
import { getPrepItem } from '@/constants/meal-prep-go';
import { getPackage } from '@/constants/cater-event-deliver';
import { getSitItem } from '@/constants/sit-down-delicious';
import { useAuth } from '@/hooks/auth-context';
import { useCart } from '@/hooks/cart-context';
import { plateCheckoutBlock } from '@/lib/plate-checkout-block';
import type { CartItem } from '@/types';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { useSitDown } from '@/hooks/sit-down-store';
import { clearPaidLaneBaskets } from '@/lib/clear-paid-lane-baskets';
import { combinedChargeKey, gatherCombinedCheckouts, payableCheckouts } from '@/lib/gather-combined-checkouts';
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

function HomePlateSection({
  sellerId,
  items,
  onDelivery,
}: {
  sellerId: string;
  items: CartItem[];
  onDelivery: (report: { sellerId: string; deliver: boolean; address: string; deliveryFee: number; loading: boolean }) => void;
}) {
  const cart = useCart();
  const [deliver, setDeliver] = useState(false);
  const [address, setAddress] = useState('');
  const delivery = useDeliveryQuote(sellerId, deliver);
  useEffect(() => {
    onDelivery({
      sellerId,
      deliver,
      address,
      deliveryFee: deliver ? delivery.deliveryFee : 0,
      loading: delivery.loading,
    });
  }, [address, deliver, delivery.deliveryFee, delivery.loading, onDelivery, sellerId]);

  return (
    <View>
      {items.map((item) => (
        <View key={item.meal.id}>
          <ScheduleTimePicker
            value={item.pickupTime}
            onChange={(date) => cart.updatePickupTime(item.meal.id, date)}
            availabilityWindows={item.meal.availabilityWindows}
            label="Pickup Time"
          />
          <TextInput
            value={item.specialInstructions || ''}
            onChangeText={(text) => cart.updateSpecialInstructions(item.meal.id, text)}
            placeholder="Special instructions"
            placeholderTextColor={Colors.gray[400]}
            style={styles.noteInput}
          />
          <TextInput
            value={item.cookingTemperature || ''}
            onChangeText={(text) => cart.updateCookingTemperature(item.meal.id, text)}
            placeholder="Cooking temperature"
            placeholderTextColor={Colors.gray[400]}
            style={styles.noteInput}
          />
        </View>
      ))}
      <TextInput
        value={items[0]?.allergies?.join(', ') || ''}
        onChangeText={(text) => {
          const allergies = text.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
          items.forEach((item) => cart.updateAllergies(item.meal.id, allergies));
        }}
        placeholder="Allergies, separated by commas"
        placeholderTextColor={Colors.gray[400]}
        style={styles.noteInput}
      />
      <GlassPressable onPress={() => setDeliver(false)}>
        <Text style={styles.meta}>{deliver ? 'Pickup' : 'Pickup selected'}</Text>
      </GlassPressable>
      <GlassPressable onPress={() => setDeliver(true)}>
        <Text style={styles.meta}>{deliver ? 'Delivery selected' : 'Delivery'}</Text>
      </GlassPressable>
      <DeliveryLevyLines deliveryFee={delivery.deliveryFee} active={deliver} />
      {deliver ? (
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Delivery address"
          placeholderTextColor={Colors.gray[400]}
          style={styles.noteInput}
        />
      ) : null}
    </View>
  );
}

export default function CombinedCheckoutScreen() {
  const { user } = useAuth();
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
  const [handoffs, setHandoffs] = useState<Record<string, { handoff: ShopFulfillment | null; block: string | null; deliveryFee: number; deliveryLoading: boolean }>>({});
  const [homeDelivery, setHomeDelivery] = useState<Record<string, { deliver: boolean; address: string; deliveryFee: number; loading: boolean }>>({});
  const params = useLocalSearchParams<{ webpay?: string; session_id?: string }>();
  const sessionId = typeof params.session_id === 'string' ? params.session_id : '';
  const webReturn = trpc.payments.confirmWebCheckout.useQuery(
    { sessionId },
    { enabled: Platform.OS === 'web' && params.webpay === 'success' && sessionId.length > 0, retry: false }
  );
  const finishedWeb = useRef(false);
  const leave = useLeaveScreen('/(tabs)/cart', receiptId == null && !charging);
  useStayBack(charging && receiptId == null);
  const paidLeave = usePaidBack('/(tabs)/buyer-dashboard', receiptId != null);

  const gathered = useMemo(() => gatherCombinedCheckouts({
    home: cart.items,
    farm: farm.items,
    prep: prep.items,
    truck: truck.items,
    cater: cater.items,
    sit: sit.items,
  }), [cart.items, farm.items, prep.items, truck.items, cater.items, sit.items]);

  const preview = useMemo(() => quoteCard(gathered.checkouts.map((checkout) => ({
    area: checkout.area,
    sellerId: checkout.sellerId,
    sellerName: checkout.sellerName,
    buyerRole: user?.role,
    buyerMembershipTier: user?.membershipTier,
    lines: checkout.area === 'home'
      ? cart.items
        .filter((item) => item.meal.plateMakerId === checkout.sellerId)
        .map((item) => {
          const quantity = Math.max(1, Math.round(item.quantity));
          const charged = promotionalBase(item.meal.price, quantity, item.meal.promotionalOffer);
          return { name: item.meal.name, quantity, unitPrice: charged / quantity, lineTotal: charged };
        })
      : checkout.lines.flatMap((line) => {
        const priced = previewLine(checkout.area, line.productId, line.quantity);
        return priced ? [priced] : [];
      }),
  }))), [gathered.checkouts, cart.items, user?.membershipTier, user?.role]);

  const onHandoff = useCallback((report: { key: string; handoff: ShopFulfillment | null; block: string | null; deliveryFee: number; deliveryLoading: boolean }) => {
    setHandoffs((current) => {
      const prev = current[report.key];
      if (
        prev
        && prev.block === report.block
        && prev.deliveryFee === report.deliveryFee
        && prev.deliveryLoading === report.deliveryLoading
        && JSON.stringify(prev.handoff) === JSON.stringify(report.handoff)
      ) return current;
      return { ...current, [report.key]: report };
    });
  }, []);

  const handoffByKey = useMemo(() => {
    const next: Record<string, ShopFulfillment | null> = {};
    for (const [key, report] of Object.entries(handoffs)) next[key] = report.handoff;
    return next;
  }, [handoffs]);

  const onHomeDelivery = useCallback((report: { sellerId: string; deliver: boolean; address: string; deliveryFee: number; loading: boolean }) => {
    setHomeDelivery((current) => {
      const prev = current[report.sellerId];
      if (
        prev
        && prev.deliver === report.deliver
        && prev.address === report.address
        && prev.deliveryFee === report.deliveryFee
        && prev.loading === report.loading
      ) return current;
      return { ...current, [report.sellerId]: report };
    });
  }, []);

  const deliveryExtra = useMemo(() => {
    let buyer = 0;
    let platform = 0;
    const fees = [
      ...Object.values(handoffs).map((report) => report.deliveryFee),
      ...Object.values(homeDelivery).map((report) => report.deliveryFee),
    ];
    for (const fee of fees) {
      if (fee <= 0) continue;
      const levy = calculateDeliveryLevy(fee);
      buyer += levy.buyerPays;
      platform += levy.platformFee;
    }
    return { buyer, platform };
  }, [handoffs, homeDelivery]);

  const deliveryLoading = Object.values(handoffs).some((report) => report.deliveryLoading)
    || Object.values(homeDelivery).some((report) => report.loading);

  const pay = async () => {
    if (gathered.checkouts.length < 1) {
      Alert.alert('Nothing to combine', 'Add a plate or an open in-app store before paying together.');
      return;
    }
    const waiting = gathered.checkouts.find((checkout) => {
      if (!checkoutAreaShop(checkout.area)) return false;
      const report = handoffs[combinedChargeKey(checkout.area, checkout.sellerId)];
      return !report?.handoff;
    });
    if (waiting) {
      const report = handoffs[combinedChargeKey(waiting.area, waiting.sellerId)];
      Alert.alert('Choose the handoff', report?.block || 'Choose a pickup, drop-off, or table before paying.');
      return;
    }
    if (user?.role === 'platemaker' && gathered.checkouts.some((checkout) => checkout.area === 'home')) {
      Alert.alert('Plate checkout', 'Turn on ordering before a home plate is paid with these baskets.');
      return;
    }
    const plateBlock = cart.items
      .filter((item) => gathered.checkouts.some((checkout) => checkout.area === 'home' && checkout.sellerId === item.meal.plateMakerId))
      .map((item) => plateCheckoutBlock({
        mealId: item.meal.id,
        isSample: item.meal.isSample,
        tags: item.meal.tags,
        quantity: item.quantity,
        pickupTime: item.pickupTime,
      }))
      .find((block) => block != null);
    if (plateBlock) {
      Alert.alert(plateBlock.title, plateBlock.message);
      return;
    }
    for (const checkout of gathered.checkouts) {
      if (checkout.area !== 'home') continue;
      const report = homeDelivery[checkout.sellerId];
      if (!report?.deliver) continue;
      if (report.loading) {
        Alert.alert('Delivery', 'The delivery fee is still loading.');
        return;
      }
      if (report.deliveryFee <= 0) {
        Alert.alert('Delivery', 'This cook has not set a delivery fee, so delivery cannot be selected.');
        return;
      }
      if (report.address.trim().length < 8) {
        Alert.alert('Delivery', 'Enter the delivery address.');
        return;
      }
    }
    if (deliveryLoading) {
      Alert.alert('Delivery fee', 'The delivery fee is still loading.');
      return;
    }
    setCharging(true);
    try {
      const homeAddresses: Record<string, string> = {};
      for (const [sellerId, report] of Object.entries(homeDelivery)) {
        if (report.deliver) homeAddresses[sellerId] = report.address.trim();
      }
      const checkouts = payableCheckouts(gathered.checkouts, handoffByKey, homeAddresses);
      const created = await createCheckout.mutateAsync({
        checkouts,
        ...(Platform.OS === 'web' && typeof window !== 'undefined'
          ? { webOrigin: window.location.origin, returnPath: '/combined-checkout' }
          : {}),
      });
      if (Platform.OS === 'web' && created.checkoutUrl && typeof window !== 'undefined') {
        window.sessionStorage.setItem('hcp-combined-return', JSON.stringify({ checkouts, paymentIntentId: created.paymentIntentId }));
        window.location.assign(created.checkoutUrl);
        return;
      }
      const initPaymentSheet = stripe?.initPaymentSheet;
      const presentPaymentSheet = stripe?.presentPaymentSheet;
      if (!initPaymentSheet || !presentPaymentSheet || !created.clientSecret) {
        throw new Error('Payment system not available');
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: created.clientSecret,
        merchantDisplayName: 'HomeCookedPlate',
        applePay: { merchantCountryCode: 'US' },
        returnURL: 'homecookedplate://combined-checkout',
      });
      if (initError) throw new Error(initError.message);
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return;
        throw new Error(presentError.message);
      }
      const paid = await confirmCheckout.mutateAsync({
        paymentIntentId: created.paymentIntentId,
        checkouts,
      });
      const refunded = new Set(paid.refundedSellerIds ?? []);
      if (refunded.size > 0) {
        Alert.alert('Portions', 'Those portions were already taken. That plate charge was refunded.');
      }
      cart.items
        .filter((item) => gathered.checkouts.some((checkout) => checkout.area === 'home' && checkout.sellerId === item.meal.plateMakerId && !refunded.has(checkout.sellerId)))
        .forEach((item) => cart.removeFromCart(item.meal.id));
      await clearPaidLaneBaskets(gathered.checkouts.map((checkout) => checkout.area));
      const platesPaid = gathered.checkouts.some((checkout) => checkout.area === 'home' && !refunded.has(checkout.sellerId));
      const shopsPaid = gathered.checkouts.some((checkout) => checkout.area !== 'home');
      if (platesPaid || shopsPaid) setReceiptId(created.paymentIntentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Payment failed', accountAccessCopy(message) ?? (message || 'The card was not charged.'));
    } finally {
      setCharging(false);
    }
  };

  useEffect(() => {
    if (finishedWeb.current || Platform.OS !== 'web' || webReturn.data?.status !== 'succeeded') return;
    const raw = window.sessionStorage.getItem('hcp-combined-return');
    if (!raw) return;
    const saved = JSON.parse(raw) as { checkouts?: ReturnType<typeof payableCheckouts>; paymentIntentId?: string };
    if (!saved.checkouts || saved.paymentIntentId !== webReturn.data.paymentIntentId) return;
    finishedWeb.current = true;
    confirmCheckout.mutateAsync({
      paymentIntentId: webReturn.data.paymentIntentId,
      checkouts: saved.checkouts,
    }).then(async (paid) => {
      const refunded = new Set(paid.refundedSellerIds ?? []);
      if (refunded.size > 0) {
        Alert.alert('Portions', 'Those portions were already taken. That plate charge was refunded.');
      }
      cart.items
        .filter((item) => (saved.checkouts ?? []).some((checkout) => checkout.area === 'home' && checkout.sellerId === item.meal.plateMakerId && !refunded.has(checkout.sellerId)))
        .forEach((item) => cart.removeFromCart(item.meal.id));
      await clearPaidLaneBaskets((saved.checkouts ?? []).map((checkout) => checkout.area));
      window.sessionStorage.removeItem('hcp-combined-return');
      const platesPaid = (saved.checkouts ?? []).some((checkout) => checkout.area === 'home' && checkout.sellerId && !refunded.has(checkout.sellerId));
      const shopsPaid = (saved.checkouts ?? []).some((checkout) => checkout.area !== 'home');
      if (platesPaid || shopsPaid) setReceiptId(webReturn.data?.paymentIntentId ?? saved.paymentIntentId ?? null);
    }).catch(() => {
      finishedWeb.current = false;
    });
  }, [cart, confirmCheckout, webReturn.data]);

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
              <Text key={`${checkout.id}-${line.name}`} style={styles.line}>
                {line.quantity} × {line.name} · ${(line.lineTotal ?? line.unitPrice * line.quantity).toFixed(2)}
              </Text>
            ))}
            {checkout.area === 'home' ? (
              <HomePlateSection
                sellerId={checkout.sellerId}
                items={cart.items.filter((item) => item.meal.plateMakerId === checkout.sellerId)}
                onDelivery={onHomeDelivery}
              />
            ) : null}
            <Text style={styles.meta}>Base ${checkout.baseAmount.toFixed(2)}</Text>
            <Text style={styles.meta}>Buyer fee ${checkout.buyerFee.toFixed(2)} · Seller fee ${checkout.sellerFee.toFixed(2)}</Text>
            <Text style={styles.meta}>You pay ${checkout.buyerPays.toFixed(2)} · Seller receives ${checkout.sellerPayout.toFixed(2)} after 7 days</Text>
            {gathered.checkouts.filter((item) => combinedChargeKey(item.area, item.sellerId) === combinedChargeKey(checkout.area, checkout.sellerId) && checkoutAreaShop(item.area)).map((draft) => (
              <CombinedHandoffFields key={checkout.id} draft={draft} onChange={onHandoff} />
            ))}
          </View>
        ))}
        {user?.role === 'platemaker' && gathered.checkouts.some((checkout) => checkout.area === 'home') ? (
          <Text style={styles.blocked}>Turn on ordering before a home plate is paid with these baskets.</Text>
        ) : null}
        {gathered.blocked.map((reason) => (
          <Text key={reason} style={styles.blocked}>{reason}</Text>
        ))}
        <View style={styles.totalCard}>
          <Text style={styles.total}>Combined total ${(preview.combinedBuyerPays + deliveryExtra.buyer).toFixed(2)}</Text>
          <Text style={styles.meta}>{preview.checkouts.length} checkout{preview.checkouts.length === 1 ? '' : 's'} · Platform keeps ${(preview.combinedPlatform + deliveryExtra.platform).toFixed(2)}</Text>
        </View>
        {receiptId ? <Text style={styles.ok}>Paid on one charge. Each seller is on the 7-day payout.</Text> : null}
        <GlassPressable style={styles.button} onPress={pay}>
          <Text style={styles.buttonText}>{charging ? 'Charging…' : 'Pay together'}</Text>
        </GlassPressable>
        <GlassPressable onPress={() => (receiptId ? paidLeave() : charging ? undefined : leave())}>
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
  noteInput: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.gray[900],
    marginTop: 8,
  },
  meta: { color: Colors.gray[600], marginTop: 4 },
  blocked: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  totalCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginVertical: 8 },
  total: { fontSize: 22, fontWeight: '700', color: Colors.gray[900] },
  ok: { color: '#166534', fontWeight: '600', marginBottom: 8 },
  button: { backgroundColor: Colors.gray[900], borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { textAlign: 'center', marginTop: 14, color: Colors.gray[700], fontWeight: '600' },
});
