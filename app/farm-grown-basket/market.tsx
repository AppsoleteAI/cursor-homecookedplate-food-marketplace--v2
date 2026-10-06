import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput } from 'react-native';
import { router, useLocalSearchParams , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { FARM_PRODUCTS, FARM_STANDS, farmsNearZip, getFarm } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { trackLabel, type RegulatoryTrack } from '@/lib/cottage-food';

const FILTERS: { id: 'all' | RegulatoryTrack; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'whole_produce', label: 'Produce' },
  { id: 'shell_eggs', label: 'Eggs' },
  { id: 'cottage_non_tcs', label: 'Cottage' },
  { id: 'csa_share', label: 'CSA' },
];

export default function FarmMarketScreen() {
  const params = useLocalSearchParams<{ zip?: string }>();
  const initialZip = typeof params.zip === 'string' ? params.zip : '';
  const [zip, setZip] = useState(initialZip);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const { listings } = useFarmBasket();

  const nearbyIds = useMemo(() => new Set(farmsNearZip(zip).map((farm) => farm.id)), [zip]);

  const goods = FARM_PRODUCTS.filter((product) => {
    if (!nearbyIds.has(product.farmId)) return false;
    if (filter !== 'all' && product.track !== filter) return false;
    return true;
  });

  return (
    <FarmScreen title="Market" subtitle="Farm goods only. Cooked plates are not listed here." testID="farm-market">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="Filter by ZIP"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        testID="market-zip"
        maxLength={5}
      />
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, filter === item.id && styles.chipOn]}
            onPress={() => setFilter(item.id)}
          >
            <Text style={[styles.chipText, filter === item.id && styles.chipTextOn]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {listings.length > 0 && (filter === 'all' || listings.some((listing) => listing.track === filter)) ? (
        <View>
          <Text style={styles.section}>Your stand</Text>
          {listings
            .filter((listing) => filter === 'all' || listing.track === filter)
            .map((listing) => (
              <TouchableOpacity key={listing.id} style={styles.card} onPress={() => router.push(`/farm-grown-basket/product/${listing.id}` as Href)}>
                <View style={styles.copy}>
                  <Text style={styles.name}>{listing.name}</Text>
                  <Text style={styles.meta}>{listing.farmName} · {trackLabel(listing.track)}</Text>
                  <Text style={styles.price}>${listing.price.toFixed(2)} / {listing.unit}</Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>
      ) : null}

      <Text style={styles.section}>{zip.replace(/\D/g, '').length >= 3 ? 'Farms in this ZIP area' : 'All stands'}</Text>
      {goods.length === 0 ? (
        <Text style={styles.empty}>No farm goods match that ZIP and filter. Clear the ZIP to see every stand.</Text>
      ) : (
        goods.map((product) => {
          const farm = getFarm(product.farmId);
          return (
            <TouchableOpacity
              key={product.id}
              style={styles.card}
              onPress={() => router.push(`/farm-grown-basket/product/${product.id}` as Href)}
              testID={`market-product-${product.id}`}
            >
              <Image source={{ uri: product.image }} style={styles.image} />
              <View style={styles.copy}>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.meta}>{farm?.name} · {trackLabel(product.track)}</Text>
                <Text style={styles.price}>${product.price.toFixed(2)} / {product.unit}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
      <Text style={styles.note}>{FARM_STANDS.length} stands in the directory. Meat, dairy, and hot meals are not offered as cottage foods here.</Text>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#166534' },
  chipText: { color: Colors.gray[700], fontWeight: '600' },
  chipTextOn: { color: Colors.white },
  section: { marginTop: 18, marginBottom: 8, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 10, marginBottom: 10 },
  image: { width: 84, height: 84, borderRadius: 12, backgroundColor: Colors.gray[200] },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  price: { color: '#166534', fontWeight: '700', marginTop: 6 },
  empty: { color: Colors.gray[600], lineHeight: 20 },
  note: { marginTop: 8, color: Colors.gray[500], fontSize: 13, lineHeight: 18 },
});
