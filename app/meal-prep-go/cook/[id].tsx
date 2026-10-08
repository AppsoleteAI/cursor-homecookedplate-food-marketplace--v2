import React, { useMemo, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, useLocalSearchParams, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { getPrepCook, itemsForCook, type PrepItem, type PrepLane } from '@/constants/meal-prep-go';
import { useMealPrep, type PrepListing } from '@/hooks/meal-prep-store';
import { dietLabel, laneDetail, laneLabel } from '@/lib/meal-prep-go';
import { stateName } from '@/lib/cottage-food';

const FILTERS: { id: 'all' | PrepLane; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'cook', label: 'Cook' },
  { id: 'addon', label: 'Add-on' },
];

export default function MealPrepCookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cookId = typeof id === 'string' ? id : '';
  const { kitchen, listings, accepting } = useMealPrep();
  const [lane, setLane] = useState<'all' | PrepLane>('all');
  const catalogCook = getPrepCook(cookId);
  const isOwner = cookId === 'owner-kitchen';

  const cook = catalogCook ?? (isOwner && kitchen
    ? {
        name: kitchen.cookName,
        city: kitchen.city,
        stateCode: kitchen.stateCode,
        summary: kitchen.handoffNote,
        accepting,
        weekLabel: 'Your week',
        handoffNote: kitchen.handoffNote,
      }
    : null);

  const items = useMemo(() => {
    if (catalogCook) return itemsForCook(catalogCook.id);
    if (isOwner) return listings.map(listingToItem);
    return [];
  }, [catalogCook, isOwner, listings]);

  const visible = lane === 'all' ? items : items.filter((item) => item.lane === lane);

  if (!cook) {
    return <Redirect href="/meal-prep-go/cooks" />;
  }

  return (
    <MealPrepScreen title={titleCase(cook.name)} subtitle={`${cook.city}, ${stateName(cook.stateCode)} · ${cook.weekLabel}`} testID="prep-cook">
      <Text style={[styles.status, cook.accepting ? styles.open : styles.closed]}>
        {cook.accepting ? 'Accepting this week' : 'Not accepting'}
      </Text>
      <Text style={styles.summary}>{cook.summary}</Text>
      <Text style={styles.meta}>{cook.handoffNote}</Text>
      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <GlassPressable key={filter.id} style={[styles.chip, lane === filter.id && styles.chipOn]} onPress={() => setLane(filter.id)}>
            <Text style={[styles.chipText, lane === filter.id && styles.chipTextOn]}>{filter.label}</Text>
          </GlassPressable>
        ))}
      </View>
      {visible.length === 0 ? <Text style={styles.meta}>Nothing is listed in this lane yet.</Text> : null}
      {visible.map((item) => (
        <GlassPressable key={item.id} style={styles.card} onPress={() => router.push(`/meal-prep-go/item/${item.id}` as Href)} testID={`prep-item-${item.id}`}>
          <Text style={styles.lane}>{laneLabel(item.lane)}</Text>
          <Text style={styles.name}>{titleCase(item.name)}</Text>
          <Text style={styles.meta}>{dietLabel(item.diet)} · {item.lane === 'addon' ? 'Rides with the week' : `${item.minutes} min`} · ${item.price.toFixed(2)}</Text>
          <Text style={styles.summary}>{laneDetail(item.lane)}</Text>
        </GlassPressable>
      ))}
    </MealPrepScreen>
  );
}

function listingToItem(listing: PrepListing): PrepItem {
  return {
    ...listing,
    image: '',
  };
}

const styles = StyleSheet.create({
  status: { fontWeight: '700', marginBottom: 8 },
  open: { color: '#166534' },
  closed: { color: '#9F1239' },
  summary: { color: Colors.gray[700], lineHeight: 20 },
  meta: { color: Colors.gray[600], marginTop: 6, lineHeight: 20 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#0E7490' },
  chipText: { color: Colors.gray[800], fontWeight: '700' },
  chipTextOn: { color: Colors.white },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginTop: 10  },
  lane: { color: '#0E7490', fontSize: 12, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
});
