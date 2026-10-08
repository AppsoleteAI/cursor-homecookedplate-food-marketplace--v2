import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { getPrepCook, getPrepItem, type PrepLane } from '@/constants/meal-prep-go';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { WEEK_SIZES, laneLabel, weekMix } from '@/lib/meal-prep-go';

export default function MealPrepWeekScreen() {
  const { items, listings, kitchen, setQuantity, clearWeek } = useMealPrep();

  const lines = useMemo(() => {
    return items.flatMap((line) => {
      const catalog = getPrepItem(line.itemId);
      const listing = listings.find((entry) => entry.id === line.itemId);
      const name = catalog?.name ?? listing?.name;
      const price = catalog?.price ?? listing?.price;
      const lane = catalog?.lane ?? listing?.lane;
      if (!name || price === undefined || !lane) return [];
      return [{ ...line, name, price, lane }];
    });
  }, [items, listings]);

  const readyCount = lines.filter((line) => line.lane === 'ready').reduce((sum, line) => sum + line.quantity, 0);
  const cookCount = lines.filter((line) => line.lane === 'cook').reduce((sum, line) => sum + line.quantity, 0);
  const addonCount = lines.filter((line) => line.lane === 'addon').reduce((sum, line) => sum + line.quantity, 0);
  const mealCount = readyCount + cookCount;
  const mix = weekMix(readyCount, cookCount);
  const cookId = items[0]?.cookId;
  const cookName = (cookId && getPrepCook(cookId)?.name) || (cookId === 'owner-kitchen' ? kitchen?.cookName : '') || 'One cook';
  const baseAmount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  return (
    <MealPrepScreen title="Your week" subtitle={lines.length === 0 ? 'Nothing added yet' : cookName} testID="prep-week">
      {lines.length === 0 ? (
        <GlassPressable onPress={() => router.push('/meal-prep-go/board' as Href)}>
          <Text style={styles.link}>Find a cook who is open this week.</Text>
        </GlassPressable>
      ) : (
        <>
          <Text style={styles.mix}>{mix}</Text>
          <Text style={styles.meta}>{mealCount} meal{mealCount === 1 ? '' : 's'} · {addonCount} add-on{addonCount === 1 ? '' : 's'}</Text>
          <View style={styles.sizes}>
            {WEEK_SIZES.map((size) => (
              <View key={size} style={[styles.size, mealCount === size && styles.sizeOn]}>
                <Text style={[styles.sizeText, mealCount === size && styles.sizeTextOn]}>{size}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>6, 8, 10, or 12 meals is a full week. Any count can be checked out.</Text>
          {lines.map((line) => (
            <View key={line.itemId} style={styles.card}>
              <Text style={styles.lane}>{laneLabel(line.lane as PrepLane)}</Text>
              <Text style={styles.name}>{titleCase(line.name)}</Text>
              <Text style={styles.meta}>{line.quantity} × ${line.price.toFixed(2)}</Text>
              <View style={styles.row}>
                <GlassPressable onPress={() => setQuantity(line.itemId, line.cookId, line.quantity - 1)} testID={`week-down-${line.itemId}`}>
                  <Text style={styles.link}>Remove One</Text>
                </GlassPressable>
              </View>
            </View>
          ))}
          <Text style={styles.total}>Week ${baseAmount.toFixed(2)} before the service fee</Text>
          <GlassPressable style={styles.button} onPress={() => router.push('/meal-prep-go/checkout' as Href)} testID="prep-week-checkout">
            <Text style={styles.buttonText}>Checkout</Text>
          </GlassPressable>
          <GlassPressable onPress={clearWeek}>
            <Text style={styles.clear}>Clear this week</Text>
          </GlassPressable>
        </>
      )}
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  mix: { fontSize: 22, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4 },
  sizes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  size: { backgroundColor: Colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  sizeOn: { backgroundColor: '#0E7490' },
  sizeText: { fontWeight: '700', color: Colors.gray[800] },
  sizeTextOn: { color: Colors.white },
  hint: { color: Colors.gray[600], marginTop: 8, lineHeight: 20 },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginTop: 10  },
  lane: { color: '#0E7490', fontSize: 12, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  row: { marginTop: 8 },
  link: { color: '#0E7490', fontWeight: '700' },
  total: { marginTop: 16, fontWeight: '700', color: Colors.gray[900] },
  button: { ...glassSurface, marginTop: 12, backgroundColor: '#0E7490', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  clear: { marginTop: 12, color: '#9F1239', fontWeight: '700' },
});
