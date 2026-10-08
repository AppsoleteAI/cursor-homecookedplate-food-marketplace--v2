import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { getPlace, getSitItem } from '@/constants/sit-down-delicious';
import { useSitDown } from '@/hooks/sit-down-store';

export default function SitItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const { listings, ownerOpen, license, addItem } = useSitDown();
  const catalog = itemId ? getSitItem(itemId) : undefined;
  const listing = listings.find((item) => item.id === itemId);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  if (!catalog && !listing) {
    return (
      <SitDownScreen title="Menu item" testID="sit-item-missing">
        <Text>That item is not on a restaurant menu.</Text>
      </SitDownScreen>
    );
  }

  const place = catalog ? getPlace(catalog.placeId) : undefined;
  const open = catalog ? Boolean(place?.openNow) : ownerOpen;
  const name = catalog?.name ?? listing!.name;
  const price = catalog?.price ?? listing!.price;
  const summary = catalog?.summary ?? listing!.summary;
  const ingredients = catalog?.ingredients ?? listing!.ingredients;
  const allergens = catalog?.allergens ?? listing!.allergens;
  const placeId = catalog?.placeId ?? 'owner-place';
  const placeName = place?.name ?? license?.placeName ?? 'Your restaurant';

  return (
    <SitDownScreen title={name} subtitle={placeName} testID="sit-item">
      {catalog ? <Image source={{ uri: catalog.image }} style={styles.hero} /> : null}
      <Text style={styles.price}>${price.toFixed(2)}</Text>
      <Text style={[styles.status, open ? styles.open : styles.closed]}>{open ? 'Open for a table or takeout' : 'Shop is closed'}</Text>
      <Text style={styles.body}>{summary}</Text>
      {place ? (
        <GlassPressable onPress={() => router.push(`/sit-down-delicious/place/${place.id}` as Href)}>
          <Text style={styles.link}>Back to {titleCase(place.name)}</Text>
        </GlassPressable>
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.label}>Ingredients</Text>
        <Text style={styles.body}>{ingredients}</Text>
        <Text style={styles.label}>Allergens</Text>
        <Text style={styles.body}>{allergens}</Text>
        <Text style={styles.body}>This item is served at the restaurant. It is not a cooked plate, a farm good, or a food-truck ticket.</Text>
      </View>
      <View style={styles.qtyRow}>
        <GlassPressable style={styles.qty} onPress={() => setQuantity((value) => Math.max(1, value - 1))}>
          <Text style={styles.qtyText}>−</Text>
        </GlassPressable>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <GlassPressable style={styles.qty} onPress={() => setQuantity((value) => Math.min(99, value + 1))}>
          <Text style={styles.qtyText}>+</Text>
        </GlassPressable>
      </View>
      <GlassPressable
        style={[styles.add, !open && styles.addOff]}
        disabled={!open}
        testID="add-sit-item"
        onPress={() => {
          if (!itemId) return;
          const result = addItem(itemId, placeId, quantity);
          setNotice(result.ok ? 'Added for this restaurant.' : result.reason);
        }}
      >
        <Text style={styles.addText}>{open ? 'Add to This Restaurant' : 'Shop Is Closed'}</Text>
      </GlassPressable>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {notice === 'Added for this restaurant.' ? (
        <GlassPressable onPress={() => router.push('/sit-down-delicious/basket' as Href)}>
          <Text style={styles.link}>Go to the Restaurant Order</Text>
        </GlassPressable>
      ) : null}
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  hero: { ...glassSurface, width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.gray[200]  },
  price: { marginTop: 12, fontSize: 22, fontWeight: '700', color: '#92400E' },
  status: { marginTop: 4, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9A3412' },
  body: { marginTop: 8, color: Colors.gray[700], lineHeight: 20 },
  link: { marginTop: 10, color: '#92400E', fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  label: { marginTop: 8, fontWeight: '700', color: Colors.gray[800] },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  qty: { ...glassSurface, width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center'  },
  qtyText: { fontSize: 22, color: Colors.gray[900] },
  qtyValue: { fontSize: 18, fontWeight: '700' },
  add: { ...glassSurface, marginTop: 16, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addOff: { backgroundColor: Colors.gray[400] },
  addText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  notice: { marginTop: 10, color: Colors.gray[800], lineHeight: 20 },
});
