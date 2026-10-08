import React, { useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, useLocalSearchParams, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { getPrepCook, getPrepItem } from '@/constants/meal-prep-go';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { dietLabel, laneDetail, laneLabel } from '@/lib/meal-prep-go';

export default function MealPrepItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = typeof id === 'string' ? id : '';
  const { listings, kitchen, items, setQuantity, accepting } = useMealPrep();
  const catalog = getPrepItem(itemId);
  const listing = listings.find((entry) => entry.id === itemId);
  const item = catalog ?? listing ?? null;
  const cook = catalog ? getPrepCook(catalog.cookId) : null;
  const cookId = catalog?.cookId ?? listing?.cookId ?? '';
  const cookName = cook?.name ?? kitchen?.cookName ?? 'Your kitchen';
  const openForOrders = cook ? cook.accepting : accepting;
  const current = items.find((line) => line.itemId === itemId)?.quantity ?? 0;
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return <Redirect href="/meal-prep-go/cooks" />;
  }

  const change = (next: number) => {
    const result = setQuantity(itemId, cookId, next);
    setError(result.ok ? null : result.reason);
  };

  return (
    <MealPrepScreen title={titleCase(item.name)} subtitle={`${laneLabel(item.lane)} · ${cookName}`} testID="prep-item">
      <Text style={styles.price}>${item.price.toFixed(2)}</Text>
      <Text style={styles.meta}>{dietLabel(item.diet)} · {item.lane === 'addon' ? 'Rides with the week' : `${item.minutes} minutes`}</Text>
      <Text style={styles.body}>{item.summary}</Text>
      <Text style={styles.body}>{laneDetail(item.lane)}</Text>
      <Text style={styles.label}>Ingredients</Text>
      <Text style={styles.body}>{item.ingredients}</Text>
      <Text style={styles.label}>Allergens</Text>
      <Text style={styles.body}>{item.allergens}</Text>
      {item.lane === 'cook' && item.recipeNote ? (
        <>
          <Text style={styles.label}>Recipe</Text>
          <Text style={styles.body}>{item.recipeNote}</Text>
        </>
      ) : null}
      {!openForOrders ? <Text style={styles.block}>This cook is not taking a week right now.</Text> : null}
      {error ? <Text style={styles.block}>{error}</Text> : null}
      <View style={styles.stepper}>
        <GlassPressable style={styles.step} onPress={() => change(Math.max(0, current - 1))} disabled={!openForOrders} testID="prep-qty-down">
          <Text style={styles.stepText}>−</Text>
        </GlassPressable>
        <Text style={styles.count}>{current}</Text>
        <GlassPressable style={styles.step} onPress={() => change(current + 1)} disabled={!openForOrders} testID="prep-qty-up">
          <Text style={styles.stepText}>+</Text>
        </GlassPressable>
      </View>
      <GlassPressable style={styles.linkButton} onPress={() => router.push('/meal-prep-go/week' as Href)}>
        <Text style={styles.link}>Open Your Week</Text>
      </GlassPressable>
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  price: { fontSize: 28, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: '#0E7490', fontWeight: '700', marginTop: 6 },
  label: { marginTop: 14, fontWeight: '700', color: Colors.gray[900] },
  body: { color: Colors.gray[700], marginTop: 4, lineHeight: 20 },
  block: { color: '#9F1239', marginTop: 12, lineHeight: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  step: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0E7490', alignItems: 'center', justifyContent: 'center', ...glassSurface },
  stepText: { color: Colors.white, fontSize: 24, fontWeight: '700' },
  count: { fontSize: 20, fontWeight: '700', color: Colors.gray[900], minWidth: 24, textAlign: 'center' },
  linkButton: { marginTop: 16 },
  link: { color: '#0E7490', fontWeight: '700' },
});
