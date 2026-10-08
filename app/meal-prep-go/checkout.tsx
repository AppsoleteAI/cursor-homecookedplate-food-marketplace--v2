import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { getPrepCook, getPrepItem } from '@/constants/meal-prep-go';
import { useAuth } from '@/hooks/auth-context';
import { useMealPrep, type PrepOrderLine } from '@/hooks/meal-prep-store';
import { weekMix } from '@/lib/meal-prep-go';
import { calculateOrderSplit } from '@/lib/fees';
import { useShopCardPayment } from '@/hooks/use-shop-payment';

export default function MealPrepCheckoutScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { items, listings, kitchen, accepting, placeOrder } = useMealPrep();
  const { chargeShop, charging } = useShopCardPayment();
  const [handoff, setHandoff] = useState<'pickup' | 'dropoff'>('pickup');
  const [windowLabel, setWindowLabel] = useState('');
  const [address, setAddress] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [block, setBlock] = useState<string | null>(null);

  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getPrepItem(item.itemId);
      const listing = listings.find((entry) => entry.id === item.itemId);
      const name = catalog?.name ?? listing?.name;
      const unitPrice = catalog?.price ?? listing?.price;
      const lane = catalog?.lane ?? listing?.lane;
      const minutes = catalog?.minutes ?? listing?.minutes;
      if (!name || unitPrice === undefined || !lane || minutes === undefined) return [];
      const line: PrepOrderLine = {
        itemId: item.itemId,
        name,
        lane,
        quantity: item.quantity,
        unitPrice,
        minutes,
      };
      return [line];
    });
  }, [items, listings]);

  const cookId = items[0]?.cookId ?? '';
  const catalogCook = getPrepCook(cookId);
  const cookName = catalogCook?.name ?? (cookId === 'owner-kitchen' ? kitchen?.cookName ?? 'Your kitchen' : '');
  const windows = catalogCook?.windows ?? [];
  const readyCount = lines.filter((line) => line.lane === 'ready').reduce((sum, line) => sum + line.quantity, 0);
  const cookCount = lines.filter((line) => line.lane === 'cook').reduce((sum, line) => sum + line.quantity, 0);
  const mealCount = readyCount + cookCount;
  const mix = weekMix(readyCount, cookCount);
  const baseAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);
  const chosenWindow = windowLabel || (windows[0] ? `${windows[0].day} ${windows[0].hours} · ${windows[0].place}` : 'Cook confirms the handoff');

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const place = async () => {
    if (lines.length === 0 || charging) return;
    if (mealCount < 1) {
      setBlock('Add a ready meal or a cook kit. An add-on rides with the week.');
      return;
    }
    if (!cookName) {
      setBlock('This week is missing its cook.');
      return;
    }
    if (handoff === 'dropoff' && address.trim().length < 8) {
      setBlock('Enter the household address for drop-off.');
      return;
    }
    if (catalogCook && !catalogCook.accepting) {
      setBlock('This cook is not taking a week right now.');
      return;
    }
    if (cookId === 'owner-kitchen' && !accepting) {
      setBlock('Your kitchen is not accepting a week right now.');
      return;
    }
    setBlock(null);
    try {
      const paid = await chargeShop('meal_prep', lines.map((line) => ({ productId: line.itemId, quantity: line.quantity })));
      if (!paid) return;
      const order = placeOrder({
        id: paid.orderId,
        cookId,
        cookName,
        handoff,
        windowLabel: chosenWindow,
        address: handoff === 'dropoff' ? address.trim() : catalogCook?.handoffNote ?? kitchen?.handoffNote ?? '',
        mix,
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
      <MealPrepScreen title="Week placed" subtitle={mix} showWeek={false} testID="prep-checkout-done">
        <Text style={styles.lead}>Your card was charged for week {orderId}.</Text>
        <GlassPressable style={styles.button} onPress={() => router.push('/meal-prep-go/orders' as Href)}>
          <Text style={styles.buttonText}>View Prep Orders</Text>
        </GlassPressable>
        <GlassPressable
          style={styles.secondary}
          onPress={() => router.push(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/buyer-dashboard')}
        >
          <Text style={styles.secondaryText}>{user?.role === 'platemaker' ? 'Plate Maker Dashboard' : 'Buyer Dashboard'}</Text>
        </GlassPressable>
      </MealPrepScreen>
    );
  }

  return (
    <MealPrepScreen title="Week checkout" subtitle="Same fee split as the rest of the marketplace." testID="prep-checkout">
      {lines.length === 0 ? (
        <GlassPressable onPress={() => router.push('/meal-prep-go/board' as Href)}>
          <Text style={styles.link}>Add a week before checkout.</Text>
        </GlassPressable>
      ) : (
        <>
          <Text style={styles.mix}>{cookName} · {mix}</Text>
          <Text style={styles.meta}>{mealCount} meal{mealCount === 1 ? '' : 's'}</Text>
          {lines.map((line) => (
            <Text key={line.itemId} style={styles.line}>{line.quantity} × {titleCase(line.name)}</Text>
          ))}
        </>
      )}
      <Text style={styles.section}>Handoff</Text>
      <GlassPressable style={[styles.option, handoff === 'pickup' && styles.optionOn]} onPress={() => setHandoff('pickup')}>
        <Text style={[styles.optionText, handoff === 'pickup' && styles.optionTextOn]}>Pickup</Text>
      </GlassPressable>
      <GlassPressable style={[styles.option, handoff === 'dropoff' && styles.optionOn]} onPress={() => setHandoff('dropoff')}>
        <Text style={[styles.optionText, handoff === 'dropoff' && styles.optionTextOn]}>Household drop-off</Text>
      </GlassPressable>
      {windows.map((window) => {
        const label = `${window.day} ${window.hours} · ${window.place}`;
        const selected = chosenWindow === label;
        return (
          <GlassPressable key={label} style={[styles.option, selected && styles.optionOn]} onPress={() => setWindowLabel(label)}>
            <Text style={[styles.optionText, selected && styles.optionTextOn]}>{label}</Text>
          </GlassPressable>
        );
      })}
      {handoff === 'dropoff' ? (
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Household address"
          placeholderTextColor={Colors.gray[400]}
          style={styles.input}
          testID="prep-dropoff-address"
        />
      ) : null}
      {block ? <Text style={styles.block}>{block}</Text> : null}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Week ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <Text style={styles.note}>The cook hands you the week. This app does not book a driver.</Text>
      <GlassPressable
        style={[styles.button, (lines.length === 0 || charging) && styles.buttonOff]}
        disabled={lines.length === 0 || charging}
        onPress={place}
        testID="place-prep-order"
      >
        <Text style={styles.buttonText}>{charging ? 'Charging card' : 'Pay with card'}</Text>
      </GlassPressable>
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 22 },
  mix: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, marginBottom: 8 },
  line: { color: Colors.gray[800], marginTop: 4 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  option: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { backgroundColor: '#0E7490' },
  optionText: { color: Colors.gray[900], fontWeight: '700' },
  optionTextOn: { color: Colors.white },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
    marginBottom: 8,
  },
  block: { color: '#9F1239', marginTop: 8, lineHeight: 20 },
  totals: { marginTop: 12 },
  totalLine: { color: Colors.gray[700], marginTop: 4 },
  totalStrong: { marginTop: 6, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  note: { color: Colors.gray[600], marginTop: 10, lineHeight: 20 },
  link: { color: '#0E7490', fontWeight: '700' },
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#0E7490', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonOff: { opacity: 0.5 },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, marginTop: 10, alignItems: 'center', paddingVertical: 12  },
  secondaryText: { color: '#0E7490', fontWeight: '700' },
});
