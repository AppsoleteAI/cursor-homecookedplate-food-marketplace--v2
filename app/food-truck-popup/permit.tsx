import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch } from 'react-native';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { US_STATE_NAMES } from '@/lib/cottage-food';
import { COMMISSARY_REQUIRED_STATES, LAW_BACKGROUND_SOURCES } from '@/lib/kitchen-rules';
import {
  FOOD_TRUCK_RULE,
  commissaryExpected,
  evaluateTruckPermit,
  type TruckPermitRecord,
} from '@/lib/food-truck-permit';

const EMPTY: TruckPermitRecord = {
  truckName: '',
  stateCode: '',
  city: '',
  county: '',
  healthDepartment: '',
  permitNumber: '',
  permitFee: '',
  commissaryNote: '',
  serviceArea: '',
  statuteNote: '',
  fireNote: '',
  handlerCard: '',
  regulationsConfirmed: false,
  cottageDoesNotApply: false,
  windowOnly: true,
  updatedAt: '',
};

export default function TruckPermitScreen() {
  const sellerGate = useSellerGate();
  const { permit, savePermit } = useFoodTruck();
  const [draft, setDraft] = useState<TruckPermitRecord>(permit ?? EMPTY);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const check = useMemo(() => evaluateTruckPermit(draft.stateCode ? draft : null), [draft]);
  const truckArticle = LAW_BACKGROUND_SOURCES.find((source) => source.url.includes('food-trucks-need-a-commissary'));

  useEffect(() => {
    if (permit && !draft.stateCode) setDraft(permit);
  }, [permit, draft.stateCode]);

  const states = US_STATE_NAMES.filter((state) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.code === draft.stateCode;
    return state.name.toLowerCase().includes(needle) || state.code.toLowerCase().includes(needle);
  }).slice(0, 8);

  const set = (patch: Partial<TruckPermitRecord>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    savePermit(next);
    setDraft(next);
    setSaved(true);
  };

  if (sellerGate) return sellerGate;

  return (
    <FoodTruckScreen title="Mobile permit" subtitle="The city where the window opens, the commissary, and the fee." testID="truck-permit">
      <Text style={styles.lead}>{FOOD_TRUCK_RULE}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. The permit for this stop</Text>
        <Text style={styles.body}>A mobile unit permit is issued for a jurisdiction. Parking in the next county can require that county’s approval. Write the city and county where this window is allowed to open.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Commissary</Text>
        <Text style={styles.body}>Published summaries expect a licensed commissary agreement before a mobile food license in: {COMMISSARY_REQUIRED_STATES.join(', ')}. Ohio summaries describe a self-contained unit that the state has approved as a narrow exception. Food-freedom and MEHKO rules are for home kitchens. They are not a food-truck permit.</Text>
        <TouchableOpacity onPress={() => router.push('/kitchen-rules' as Href)}>
          <Text style={styles.link}>Read the kitchen rules</Text>
        </TouchableOpacity>
        {truckArticle ? (
          <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(truckArticle.url)}>{truckArticle.name}</Text>
        ) : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. The fee</Text>
        <Text style={styles.body}>Health, fire, and vending fees are set by the agency and they change. Type the amount on your invoice. This app does not publish a fee schedule.</Text>
      </View>

      <Text style={styles.label}>State where the window opens</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search states" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="truck-state-search" />
      <View style={styles.chips}>
        {states.map((state) => (
          <TouchableOpacity key={state.code} style={[styles.chip, draft.stateCode === state.code && styles.chipOn]} onPress={() => set({ stateCode: state.code })}>
            <Text style={[styles.chipText, draft.stateCode === state.code && styles.chipTextOn]}>{state.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {states.length === 0 ? <Text style={styles.note}>Type a state name, such as Texas or California.</Text> : null}
      {draft.stateCode ? (
        <Text style={styles.body}>
          {commissaryExpected(draft.stateCode)
            ? 'Summaries expect a commissary agreement here before the mobile license.'
            : 'This state is not on the published commissary list used by Kitchen rules. Ask the health department and write their answer below.'}
        </Text>
      ) : null}

      <Field label="Truck name" value={draft.truckName} onChangeText={(truckName) => set({ truckName })} />
      <Field label="City" value={draft.city} onChangeText={(city) => set({ city })} />
      <Field label="County" value={draft.county} onChangeText={(county) => set({ county })} />
      <Field label="Health department" value={draft.healthDepartment} onChangeText={(healthDepartment) => set({ healthDepartment })} />
      <Field label="Permit number" value={draft.permitNumber} onChangeText={(permitNumber) => set({ permitNumber })} />
      <Field label="Permit fee you were quoted" value={draft.permitFee} onChangeText={(permitFee) => set({ permitFee })} />
      <Field label="Commissary, or the agency’s answer" value={draft.commissaryNote} onChangeText={(commissaryNote) => set({ commissaryNote })} multiline />
      <Field label="Cities and lots this permit covers" value={draft.serviceArea} onChangeText={(serviceArea) => set({ serviceArea })} multiline />
      <Field label="What the health department said" value={draft.statuteNote} onChangeText={(statuteNote) => set({ statuteNote })} multiline />
      <Field label="Fire marshal result" value={draft.fireNote} onChangeText={(fireNote) => set({ fireNote })} />
      <Field label="Food handler or manager card" value={draft.handlerCard} onChangeText={(handlerCard) => set({ handlerCard })} />

      <Toggle label="I read the current mobile-unit rule for this stop" value={draft.regulationsConfirmed} onValueChange={(regulationsConfirmed) => set({ regulationsConfirmed })} />
      <Toggle label="Cottage food law is not the license for this truck" value={draft.cottageDoesNotApply} onValueChange={(cottageDoesNotApply) => set({ cottageDoesNotApply })} />
      <Toggle label="Orders on this app are picked up at the service window" value={draft.windowOnly} onValueChange={(windowOnly) => set({ windowOnly })} />

      {saved && check.ok ? <Text style={styles.ok}>Saved. You can add menu items.</Text> : null}
      {saved && !check.ok ? (
        <View>
          <Text style={styles.block}>Saved. The menu stays closed until these are done:</Text>
          {check.blocks.map((block) => (
            <Text key={block} style={styles.block}>{block}</Text>
          ))}
        </View>
      ) : null}
      <TouchableOpacity style={styles.button} onPress={save} testID="save-truck-permit">
        <Text style={styles.buttonText}>Save permit record</Text>
      </TouchableOpacity>
    </FoodTruckScreen>
  );
}

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={label} placeholderTextColor={Colors.gray[400]} style={[styles.input, multiline && styles.area]} multiline={multiline} />
    </View>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#C2410C', false: Colors.gray[300] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 20 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginTop: 10 },
  cardTitle: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 6 },
  label: { marginTop: 14, marginBottom: 6, fontWeight: '700', color: Colors.gray[900] },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  area: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#C2410C' },
  chipText: { color: Colors.gray[800] },
  chipTextOn: { color: Colors.white, fontWeight: '700' },
  link: { color: '#C2410C', fontWeight: '700', marginTop: 8 },
  note: { color: Colors.gray[500], marginTop: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  toggleLabel: { flex: 1, color: Colors.gray[800], lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '700' },
  button: { marginTop: 16, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
