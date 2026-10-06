import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { getCatalogProduct, getFarm } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { HOMEMADE_DISCLAIMER, frameworkForState, regulationDuty, stateName, trackLabel } from '@/lib/cottage-food';

export default function FarmProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const { listings, addItem } = useFarmBasket();
  const catalog = productId ? getCatalogProduct(productId) : undefined;
  const listing = listings.find((item) => item.id === productId);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!catalog && !listing) {
    return (
      <FarmScreen title="Good" testID="farm-product-missing">
        <Text>That farm good is not listed.</Text>
      </FarmScreen>
    );
  }

  const track = catalog?.track ?? listing!.track;
  const name = catalog?.name ?? listing!.name;
  const price = catalog?.price ?? listing!.price;
  const unit = catalog?.unit ?? listing!.unit;
  const summary = catalog?.summary ?? listing!.summary;
  const ingredients = catalog?.ingredients ?? listing!.ingredients;
  const allergens = catalog?.allergens ?? listing!.allergens;
  const farm = catalog ? getFarm(catalog.farmId) : undefined;
  const stateCode = farm?.stateCode ?? listing!.stateCode;
  const framework = frameworkForState(stateCode);
  const needsHomemade = track === 'cottage_non_tcs' || track === 'shell_eggs' || track === 'temperature_control';

  return (
    <FarmScreen title={name} subtitle={farm ? farm.name : listing!.farmName} testID="farm-product">
      {catalog ? <Image source={{ uri: catalog.image }} style={styles.hero} /> : null}
      <Text style={styles.price}>${price.toFixed(2)} / {unit}</Text>
      <Text style={styles.track}>{trackLabel(track)} · {stateName(stateCode)}</Text>
      <Text style={styles.body}>{summary}</Text>
      {farm ? (
        <TouchableOpacity onPress={() => router.push(`/farm-grown-basket/farm/${farm.id}` as Href)}>
          <Text style={styles.link}>Visit {farm.name}</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>What rule applies</Text>
        <Text style={styles.body}>{regulationDuty(track, framework)}</Text>
        <Text style={styles.label}>Ingredients</Text>
        <Text style={styles.body}>{ingredients}</Text>
        <Text style={styles.label}>Allergens</Text>
        <Text style={styles.body}>{allergens}</Text>
        {needsHomemade ? <Text style={styles.disclaimer}>{HOMEMADE_DISCLAIMER}</Text> : null}
        {/honey/i.test(`${name} ${ingredients}`) ? (
          <Text style={styles.disclaimer}>Do not feed honey to infants under one year.</Text>
        ) : null}
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qty} onPress={() => setQuantity((value) => Math.max(1, value - 1))}>
          <Text style={styles.qtyText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <TouchableOpacity style={styles.qty} onPress={() => setQuantity((value) => Math.min(99, value + 1))}>
          <Text style={styles.qtyText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.add}
        testID="add-farm-good"
        onPress={() => {
          if (productId) addItem(productId, quantity);
          setAdded(true);
        }}
      >
        <Text style={styles.addText}>{added ? 'Added to the farm basket' : 'Add to farm basket'}</Text>
      </TouchableOpacity>
      {added ? (
        <TouchableOpacity onPress={() => router.push('/farm-grown-basket/basket' as Href)}>
          <Text style={styles.link}>Go to farm basket</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.note}>This does not add a cooked plate to the plate cart.</Text>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.gray[200] },
  price: { marginTop: 12, fontSize: 22, fontWeight: '700', color: '#166534' },
  track: { marginTop: 4, color: Colors.gray[600] },
  body: { marginTop: 8, color: Colors.gray[700], lineHeight: 20 },
  link: { marginTop: 10, color: '#166534', fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  panelTitle: { fontWeight: '700', color: Colors.gray[900] },
  label: { marginTop: 10, fontWeight: '700', color: Colors.gray[800] },
  disclaimer: { marginTop: 10, fontWeight: '700', color: '#9A3412', lineHeight: 20 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  qty: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 22, color: Colors.gray[900] },
  qtyValue: { fontSize: 18, fontWeight: '700' },
  add: { marginTop: 16, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  note: { marginTop: 10, color: Colors.gray[500], fontSize: 13 },
});
