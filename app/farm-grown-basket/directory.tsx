import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { stateName, US_STATE_NAMES } from '@/lib/cottage-food';
import {
  COTTAGE_DIRECTORY_NOTICE,
  COTTAGE_RESOURCES,
  COTTAGE_STATE_DIRECTORY,
  cottageBandLabel,
  foodFreedomDirectory,
  VEGETABLE_LEATHER_ALSO,
  VEGETABLE_LEATHER_PARAGRAPHS,
  VEGETABLE_LEATHER_TITLE,
  type CottageMapBand,
} from '@/lib/cottage-directory';

const BANDS: { id: 'all' | CottageMapBand; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hazardous', label: 'Some hazardous' },
  { id: 'non_hazardous', label: 'Non-hazardous' },
  { id: 'baked_only', label: 'Baked only' },
  { id: 'none', label: 'No law on the chart' },
];

export default function CottageDirectoryScreen() {
  const [query, setQuery] = useState('');
  const [band, setBand] = useState<(typeof BANDS)[number]['id']>('all');

  const freedomRows = foodFreedomDirectory();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return COTTAGE_STATE_DIRECTORY.filter((row) => {
      if (band !== 'all' && row.band !== band) return false;
      if (!needle) return true;
      const name = row.code === 'DC' ? 'district of columbia' : stateName(row.code).toLowerCase();
      return name.includes(needle) || row.code.toLowerCase().includes(needle);
    });
  }, [band, query]);

  return (
    <FarmScreen title="Cottage food directory" subtitle="A map summary. Not a permit." testID="cottage-directory">
      <Text style={styles.notice}>{COTTAGE_DIRECTORY_NOTICE}</Text>
      <View style={styles.card} testID="cottage-leather-definition">
        <Text style={styles.name}>{VEGETABLE_LEATHER_TITLE}</Text>
        <Text style={styles.band}>Also called {VEGETABLE_LEATHER_ALSO}</Text>
        {VEGETABLE_LEATHER_PARAGRAPHS.map((paragraph) => (
          <Text key={paragraph} style={styles.note}>{paragraph}</Text>
        ))}
      </View>
      <Text style={styles.section}>Expanded food freedom</Text>
      <Text style={styles.notice}>
        Wyoming, North Dakota, Utah, Oklahoma, Montana, and Tennessee are the food-freedom group in FarmGrownBasket. The foods and caps below come from publisher summaries. A hot meal, dairy product, or cooked meat uses the food-freedom listing only after the cook confirms the statute. The cottage shelf stays shelf-stable.
      </Text>
      {freedomRows.map((row) => {
        const name = US_STATE_NAMES.find((state) => state.code === row.code)?.name ?? row.code;
        return (
          <View key={`freedom-${row.code}`} style={styles.card} testID={`cottage-freedom-${row.code}`}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.band}>Food freedom</Text>
            {row.expanded ? <Text style={styles.note}>{row.expanded}</Text> : null}
            {row.cap ? <Text style={styles.cap}>Annual cap: {row.cap}</Text> : null}
          </View>
        );
      })}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search states"
        placeholderTextColor={Colors.gray[400]}
        style={styles.input}
        testID="cottage-directory-search"
        autoCorrect={false}
      />
      <View style={styles.filters}>
        {BANDS.map((item) => (
          <GlassPressable key={item.id} style={[styles.chip, band === item.id && styles.chipOn]} onPress={() => setBand(item.id)}>
            <Text style={[styles.chipText, band === item.id && styles.chipTextOn]}>{item.label}</Text>
          </GlassPressable>
        ))}
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>No state matches that search.</Text> : null}
      {rows.map((row) => {
        const name = US_STATE_NAMES.find((state) => state.code === row.code)?.name ?? 'District of Columbia';
        return (
          <View key={row.code} style={styles.card} testID={`cottage-directory-${row.code}`}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.band}>{cottageBandLabel(row.band)}</Text>
            {row.foodFreedom ? <Text style={styles.band}>Food freedom</Text> : null}
            {row.expanded ? <Text style={styles.note}>{row.expanded}</Text> : null}
            {row.cap ? <Text style={styles.cap}>Annual cap: {row.cap}</Text> : null}
            {row.note ? <Text style={styles.note}>{row.note}</Text> : null}
          </View>
        );
      })}
      <Text style={styles.section}>Outside pages</Text>
      <Text style={styles.notice}>These pages are not written or checked by HomeCookedPlate.</Text>
      {COTTAGE_RESOURCES.map((resource) => (
        <GlassPressable key={resource.url} style={styles.card} onPress={() => WebBrowser.openBrowserAsync(resource.url)} testID={`cottage-resource-${resource.name}`}>
          <Text style={styles.name}>{resource.name}</Text>
          <Text style={styles.note}>{resource.detail}</Text>
        </GlassPressable>
      ))}
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  notice: { color: Colors.gray[700], lineHeight: 20 },
  input: {
    marginTop: 12,
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
  empty: { marginTop: 12, color: Colors.gray[600] },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginTop: 10 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  band: { color: '#166534', marginTop: 4, fontWeight: '600' },
  cap: { color: Colors.gray[900], lineHeight: 20, marginTop: 8, fontWeight: '600' },
  note: { color: Colors.gray[700], lineHeight: 20, marginTop: 8 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
});
