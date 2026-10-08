import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { getPlace, getSitItem } from '@/constants/sit-down-delicious';
import { useSitDown } from '@/hooks/sit-down-store';
import { calculateOrderSplit } from '@/lib/fees';

export default function SitBasketScreen() {
  const { items, listings, license, setQuantity, clearItems } = useSitDown();
  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getSitItem(item.itemId);
      const listing = listings.find((entry) => entry.id === item.itemId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      if (!name || price === undefined) return [];
      return [{ id: item.itemId, placeId: item.placeId, name, price, quantity: item.quantity }];
    });
  }, [items, listings]);

  const placeId = lines[0]?.placeId;
  const placeName = placeId === 'owner-place' ? license?.placeName ?? 'Your restaurant' : getPlace(placeId ?? '')?.name ?? 'Restaurant';
  const baseAmount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);

  return (
    <SitDownScreen title="Restaurant order" subtitle="One shop. A table or counter takeout." showBasket={false} testID="sit-basket">
      {lines.length === 0 ? (
        <View>
          <Text style={styles.empty}>No restaurant order yet.</Text>
          <GlassPressable onPress={() => router.push('/sit-down-delicious/places' as Href)}>
            <Text style={styles.link}>See Independent Shops</Text>
          </GlassPressable>
        </View>
      ) : (
        <View>
          <Text style={styles.place}>{placeName}</Text>
          {lines.map((line) => (
            <View key={line.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{titleCase(line.name)}</Text>
                <Text style={styles.meta}>${line.price.toFixed(2)}</Text>
              </View>
              <View style={styles.qty}>
                <GlassPressable onPress={() => setQuantity(line.id, line.quantity - 1)}>
                  <Text style={styles.qtyText}>−</Text>
                </GlassPressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <GlassPressable onPress={() => setQuantity(line.id, line.quantity + 1)}>
                  <Text style={styles.qtyText}>+</Text>
                </GlassPressable>
              </View>
            </View>
          ))}
          <GlassPressable onPress={clearItems}>
            <Text style={styles.link}>Clear This Restaurant</Text>
          </GlassPressable>
        </View>
      )}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Food ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <GlassPressable
        style={[styles.button, lines.length === 0 && styles.buttonOff]}
        disabled={lines.length === 0}
        onPress={() => router.push('/sit-down-delicious/checkout' as Href)}
        testID="sit-basket-checkout"
      >
        <Text style={styles.buttonText}>Restaurant Checkout</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/(tabs)/cart')}>
        <Text style={styles.link}>Cooked-plate Cart</Text>
      </GlassPressable>
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700], fontSize: 16 },
  place: { fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  copy: { flex: 1 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 22, paddingHorizontal: 4 },
  qtyValue: { fontWeight: '700', minWidth: 16, textAlign: 'center' },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { marginTop: 4, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#92400E', fontWeight: '700' },
});
