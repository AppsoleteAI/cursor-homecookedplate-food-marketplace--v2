import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { US_STATE_NAMES } from '@/lib/cottage-food';
import {
  CATER_EVENT_RULE,
  evaluateCaterLicense,
  type CaterLicenseRecord,
} from '@/lib/cater-event-license';

const EMPTY: CaterLicenseRecord = {
  companyName: '',
  stateCode: '',
  city: '',
  county: '',
  healthDepartment: '',
  licenseNumber: '',
  licenseFee: '',
  kitchenNote: '',
  serviceArea: '',
  driverNote: '',
  statuteNote: '',
  handlerCard: '',
  regulationsConfirmed: false,
  cottageDoesNotApply: false,
  companyArrangesDropoff: true,
  updatedAt: '',
};

export default function CaterLicenseScreen() {
  const sellerGate = useSellerGate();
  const { license, saveLicense } = useCaterEvent();
  const [draft, setDraft] = useState<CaterLicenseRecord>(license ?? EMPTY);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const check = useMemo(() => evaluateCaterLicense(draft.stateCode ? draft : null), [draft]);

  useEffect(() => {
    if (license && !draft.stateCode) setDraft(license);
  }, [license, draft.stateCode]);

  const states = US_STATE_NAMES.filter((state) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.code === draft.stateCode;
    return state.name.toLowerCase().includes(needle) || state.code.toLowerCase().includes(needle);
  }).slice(0, 8);

  const set = (patch: Partial<CaterLicenseRecord>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    saveLicense(next);
    setDraft(next);
    setSaved(true);
  };

  if (sellerGate) return sellerGate;

  return (
    <CaterEventScreen title="Catering license" subtitle="Commercial kitchen, service area, and the fee." testID="cater-license">
      <Text style={styles.lead}>{CATER_EVENT_RULE}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. The license for this kitchen</Text>
        <Text style={styles.body}>A catering license is issued for a jurisdiction. Serving the next county can require that county’s approval. Write the city and county where this kitchen is allowed to prepare food for drop-off.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Commercial kitchen</Text>
        <Text style={styles.body}>Hot group meals need a licensed commercial kitchen. Cottage food, food-freedom, and home-kitchen permits cover a different kind of sale. They are not a catering license.</Text>
        <GlassPressable onPress={() => router.push('/kitchen-rules' as Href)}>
          <Text style={styles.link}>Read the Kitchen Rules</Text>
        </GlassPressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Drop-off is yours</Text>
        <Text style={styles.body}>You drop off and set up, or you hire that service yourself. This app does not book a driver and does not add a 15% to 25% marketplace commission. The buyer pays the same 10% service fee as every other order.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>4. The fee</Text>
        <Text style={styles.body}>Health department fees are set by the agency and they change. Type the amount on your invoice. This app does not publish a fee schedule.</Text>
      </View>

      <Text style={styles.label}>State where the kitchen is licensed</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search states" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="cater-state-search" />
      <View style={styles.chips}>
        {states.map((state) => (
          <GlassPressable key={state.code} style={[styles.chip, draft.stateCode === state.code && styles.chipOn]} onPress={() => set({ stateCode: state.code })}>
            <Text style={[styles.chipText, draft.stateCode === state.code && styles.chipTextOn]}>{state.name}</Text>
          </GlassPressable>
        ))}
      </View>
      {states.length === 0 ? <Text style={styles.note}>Type a state name, such as Texas or California.</Text> : null}

      <Field label="Company name" value={draft.companyName} onChangeText={(companyName) => set({ companyName })} />
      <Field label="City" value={draft.city} onChangeText={(city) => set({ city })} />
      <Field label="County" value={draft.county} onChangeText={(county) => set({ county })} />
      <Field label="Health department" value={draft.healthDepartment} onChangeText={(healthDepartment) => set({ healthDepartment })} />
      <Field label="License number" value={draft.licenseNumber} onChangeText={(licenseNumber) => set({ licenseNumber })} />
      <Field label="License fee you were quoted" value={draft.licenseFee} onChangeText={(licenseFee) => set({ licenseFee })} />
      <Field label="Commercial kitchen and address" value={draft.kitchenNote} onChangeText={(kitchenNote) => set({ kitchenNote })} multiline />
      <Field label="Cities this license covers" value={draft.serviceArea} onChangeText={(serviceArea) => set({ serviceArea })} multiline />
      <Field label="Who drops off and sets up" value={draft.driverNote} onChangeText={(driverNote) => set({ driverNote })} multiline />
      <Field label="What the health department said" value={draft.statuteNote} onChangeText={(statuteNote) => set({ statuteNote })} multiline />
      <Field label="Food handler or manager card" value={draft.handlerCard} onChangeText={(handlerCard) => set({ handlerCard })} />

      <Toggle label="I read the current catering rule for this kitchen" value={draft.regulationsConfirmed} onValueChange={(regulationsConfirmed) => set({ regulationsConfirmed })} />
      <Toggle label="Cottage food law is not the license for this company" value={draft.cottageDoesNotApply} onValueChange={(cottageDoesNotApply) => set({ cottageDoesNotApply })} />
      <Toggle label="My company arranges drop-off and setup" value={draft.companyArrangesDropoff} onValueChange={(companyArrangesDropoff) => set({ companyArrangesDropoff })} />

      {saved && check.ok ? <Text style={styles.ok}>Saved. You can add packages.</Text> : null}
      {saved && !check.ok ? (
        <View>
          <Text style={styles.block}>Saved. Packages stay closed until these are done:</Text>
          {check.blocks.map((item) => (
            <Text key={item} style={styles.block}>{item}</Text>
          ))}
        </View>
      ) : null}
      <GlassPressable style={styles.button} onPress={save} testID="save-cater-license">
        <Text style={styles.buttonText}>Save License Record</Text>
      </GlassPressable>
    </CaterEventScreen>
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
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#6D28D9', false: Colors.gray[300] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 20 },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginTop: 10  },
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
  chip: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#6D28D9' },
  chipText: { color: Colors.gray[800] },
  chipTextOn: { color: Colors.white, fontWeight: '700' },
  link: { color: '#6D28D9', fontWeight: '700', marginTop: 8 },
  note: { color: Colors.gray[500], marginTop: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  toggleLabel: { flex: 1, color: Colors.gray[800], lineHeight: 20 },
  block: { color: '#9F1239', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '700' },
  button: { ...glassSurface, marginTop: 16, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
