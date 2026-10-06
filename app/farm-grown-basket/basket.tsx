import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { getCatalogProduct } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { calculateOrderSplit } from '@/lib/fees';

export default function FarmBasketScreen() {
  const { items, listings, setQuantity } = useFarmBasket();

  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getCatalogProduct(item.productId);
      const listing = listings.find((entry) => entry.id === item.productId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      if (!name || price === undefined) return [];
      return [{ id: item.productId, name, price, quantity: item.quantity, unit: catalog?.unit ?? listing?.unit ?? '' }];
    });
  }, [items, listings]);

  const baseAmount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const split = calculateOrderSplit(baseAmount);

  return (
    <FarmScreen title="Farm basket" subtitle="These goods never mix with cooked plates." showBasket={false} testID="farm-basket">
      {lines.length === 0 ? (
        <View>
          <Text style={styles.empty}>Your farm basket is empty.</Text>
          <TouchableOpacity onPress={() => router.push('/farm-grown-basket/market' as Href)}>
            <Text style={styles.link}>Browse the market</Text>
          </TouchableOpacity>
        </View>
      ) : (
        lines.map((line) => (
          <View key={line.id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name}>{line.name}</Text>
              <Text style={styles.meta}>${line.price.toFixed(2)} / {line.unit}</Text>
            </View>
            <View style={styles.qty}>
              <TouchableOpacity onPress={() => setQuantity(line.id, line.quantity - 1)} testID={`farm-qty-down-${line.id}`}>
                <Text style={styles.qtyText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{line.quantity}</Text>
              <TouchableOpacity onPress={() => setQuantity(line.id, line.quantity + 1)}>
                <Text style={styles.qtyText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Goods {`$${baseAmount.toFixed(2)}`}</Text>
        <Text style={styles.totalLine}>Service fee {`$${(split.totalCaptured - baseAmount).toFixed(2)}`}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, lines.length === 0 && styles.buttonOff]}
        disabled={lines.length === 0}
        onPress={() => router.push('/farm-grown-basket/checkout' as Href)}
        testID="farm-basket-checkout"
      >
        <Text style={styles.buttonText}>Farm checkout</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(tabs)/cart')}>
        <Text style={styles.link}>Cooked-plate cart</Text>
      </TouchableOpacity>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700], fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  copy: { flex: 1 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 22, color: Colors.gray[900], paddingHorizontal: 4 },
  qtyValue: { fontWeight: '700', minWidth: 16, textAlign: 'center' },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { marginTop: 4, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  button: { marginTop: 14, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#166534', fontWeight: '700' },
});
