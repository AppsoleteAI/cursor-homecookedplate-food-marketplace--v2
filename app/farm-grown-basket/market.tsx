import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { FoodImage } from '@/components/FoodImage';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { FARM_PRODUCTS, FARM_STANDS, farmsNearZip, getFarm } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { trackLabel, type RegulatoryTrack } from '@/lib/cottage-food';
import { highlightBakedCottage } from '@/lib/baked-cottage';

type MarketFilter = 'all' | 'baked' | RegulatoryTrack;

const FILTERS: { id: MarketFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'baked', label: 'Cottage shelf' },
  { id: 'whole_produce', label: 'Produce' },
  { id: 'shell_eggs', label: 'Eggs' },
  { id: 'cottage_non_tcs', label: 'Cottage' },
  { id: 'csa_share', label: 'CSA' },
];

export default function FarmMarketScreen() {
  const params = useLocalSearchParams<{ zip?: string; highlight?: string }>();
  const initialZip = typeof params.zip === 'string' ? params.zip : '';
  const openBaked = params.highlight === 'baked' || params.highlight === 'cottage';
  const [zip, setZip] = useState(initialZip);
  const [filter, setFilter] = useState<MarketFilter>(openBaked ? 'baked' : 'all');
  const { listings } = useFarmBasket();

  const nearbyIds = useMemo(() => new Set(farmsNearZip(zip).map((farm) => farm.id)), [zip]);

  const showBaked = filter === 'all' || filter === 'baked' || filter === 'cottage_non_tcs';
  const bakedListings = listings.filter((listing) => highlightBakedCottage(listing));
  const bakedGoods = FARM_PRODUCTS.filter((product) => {
    if (!nearbyIds.has(product.farmId)) return false;
    const farm = getFarm(product.farmId);
    return highlightBakedCottage({ ...product, stateCode: farm?.stateCode ?? '' });
  });

  const goods = FARM_PRODUCTS.filter((product) => {
    if (!nearbyIds.has(product.farmId)) return false;
    if (filter === 'baked') return false;
    if (filter !== 'all' && product.track !== filter) return false;
    if (showBaked) {
      const farm = getFarm(product.farmId);
      if (highlightBakedCottage({ ...product, stateCode: farm?.stateCode ?? '' })) return false;
    }
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
          <GlassPressable
            key={item.id}
            style={[styles.chip, filter === item.id && styles.chipOn]}
            onPress={() => setFilter(item.id)}
          >
            <Text style={[styles.chipText, filter === item.id && styles.chipTextOn]}>{item.label}</Text>
          </GlassPressable>
        ))}
      </View>

      {showBaked && (bakedListings.length > 0 || bakedGoods.length > 0) ? (
        <View testID="baked-cottage-highlight">
          <Text style={styles.section}>Widely permitted cottage foods</Text>
          <Text style={styles.highlightNote}>
            Shelf-stable foods cottage laws commonly allow: baked goods without cream or custard, jams and preserves, candy, dry mixes, granola, popcorn, roasted coffee, dried tea, honey, vinegar, and mustard. Refrigerated foods stay off this shelf.
          </Text>
          <GlassPressable onPress={() => router.push('/farm-grown-basket/directory' as Href)} testID="market-cottage-directory">
            <Text style={styles.directoryLink}>State-by-state cottage directory</Text>
          </GlassPressable>
          {bakedListings.map((listing) => (
            <GlassPressable key={listing.id} style={[styles.card, styles.highlightCard]} onPress={() => router.push(`/farm-grown-basket/product/${listing.id}` as Href)}>
              {listing.image ? <FoodImage source={{ uri: listing.image }} style={styles.image} /> : null}
              <View style={styles.copy}>
                <Text style={styles.badge}>Cottage shelf</Text>
                <Text style={styles.name}>{titleCase(listing.name)}</Text>
                <Text style={styles.meta}>{listing.farmName} · {trackLabel(listing.track)}</Text>
                <Text style={styles.price}>${listing.price.toFixed(2)} / {listing.unit}</Text>
              </View>
            </GlassPressable>
          ))}
          {bakedGoods.map((product) => {
            const farm = getFarm(product.farmId);
            return (
              <GlassPressable
                key={product.id}
                style={[styles.card, styles.highlightCard]}
                onPress={() => router.push(`/farm-grown-basket/product/${product.id}` as Href)}
                testID={`baked-cottage-${product.id}`}
              >
                <FoodImage source={{ uri: product.image }} style={styles.image} />
                <View style={styles.copy}>
                  <Text style={styles.badge}>Cottage shelf</Text>
                  <Text style={styles.name}>{titleCase(product.name)}</Text>
                  <Text style={styles.meta}>{farm?.name} · {trackLabel(product.track)}</Text>
                  <Text style={styles.price}>${product.price.toFixed(2)} / {product.unit}</Text>
                </View>
              </GlassPressable>
            );
          })}
        </View>
      ) : null}

      {listings.some((listing) => (filter === 'all' || listing.track === filter) && !(showBaked && highlightBakedCottage(listing))) ? (
        <View>
          <Text style={styles.section}>Farm goods</Text>
          {listings
            .filter((listing) => (filter === 'all' || listing.track === filter) && !(showBaked && highlightBakedCottage(listing)))
            .map((listing) => (
              <GlassPressable key={listing.id} style={styles.card} onPress={() => router.push(`/farm-grown-basket/product/${listing.id}` as Href)}>
                {listing.image ? <FoodImage source={{ uri: listing.image }} style={styles.image} /> : null}
                <View style={styles.copy}>
                  <Text style={styles.name}>{titleCase(listing.name)}</Text>
                  <Text style={styles.meta}>{listing.farmName} · {trackLabel(listing.track)}</Text>
                  <Text style={styles.price}>${listing.price.toFixed(2)} / {listing.unit}</Text>
                </View>
              </GlassPressable>
            ))}
        </View>
      ) : null}

      {filter === 'baked' ? (
        bakedListings.length + bakedGoods.length === 0 ? (
          <>
            <Text style={styles.empty}>No widely permitted cottage foods match that ZIP.</Text>
            <GlassPressable onPress={() => router.push('/farm-grown-basket/directory' as Href)} testID="market-cottage-directory-empty">
              <Text style={styles.directoryLink}>State-by-state cottage directory</Text>
            </GlassPressable>
          </>
        ) : null
      ) : (
      <>
      <Text style={styles.section}>{zip.replace(/\D/g, '').length >= 3 ? 'Farms in this ZIP area' : 'All stands'}</Text>
      {goods.length === 0 ? (
        <Text style={styles.empty}>No farm goods match that ZIP and filter. Clear the ZIP to see every stand.</Text>
      ) : (
        goods.map((product) => {
          const farm = getFarm(product.farmId);
          return (
            <GlassPressable
              key={product.id}
              style={styles.card}
              onPress={() => router.push(`/farm-grown-basket/product/${product.id}` as Href)}
              testID={`market-product-${product.id}`}
            >
              <FoodImage source={{ uri: product.image }} style={styles.image} />
              <View style={styles.copy}>
                <Text style={styles.name}>{titleCase(product.name)}</Text>
                <Text style={styles.meta}>{farm?.name} · {trackLabel(product.track)}</Text>
                <Text style={styles.price}>${product.price.toFixed(2)} / {product.unit}</Text>
              </View>
            </GlassPressable>
          );
        })
      )}
      </>
      )}
      <Text style={styles.note}>{FARM_STANDS.length} stands in the directory. This market is produce, eggs, honey, and homemade goods. Hot meals are on Home.</Text>
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
  chip: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#166534' },
  chipText: { color: Colors.gray[700], fontWeight: '600' },
  chipTextOn: { color: Colors.white },
  section: { marginTop: 18, marginBottom: 8, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  card: { ...glassSurface, flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 10, marginBottom: 10  },
  highlightCard: { borderWidth: 2, borderColor: '#166534', backgroundColor: '#F0FDF4' },
  highlightNote: { color: Colors.gray[700], lineHeight: 20, marginBottom: 10 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#166534', color: Colors.white, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  image: { ...glassSurface, width: 84, height: 84, borderRadius: 12, backgroundColor: Colors.gray[200]  },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  price: { color: '#166534', fontWeight: '700', marginTop: 6 },
  empty: { color: Colors.gray[600], lineHeight: 20 },
  directoryLink: { color: '#166534', fontWeight: '700', marginBottom: 10 },
  note: { marginTop: 8, color: Colors.gray[500], fontSize: 13, lineHeight: 18 },
});
