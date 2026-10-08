import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useSitDown } from '@/hooks/sit-down-store';
import { US_STATE_NAMES } from '@/lib/cottage-food';
import { SIT_DOWN_RULE, evaluateSitDownLicense, type SitDownLicense } from '@/lib/sit-down-license';

const EMPTY: SitDownLicense = {
  placeName: '',
  street: '',
  city: '',
  county: '',
  stateCode: '',
  healthDepartment: '',
  permitNumber: '',
  permitFee: '',
  inspectionNote: '',
  statuteNote: '',
  offersSitDown: true,
  offersTakeout: true,
  independentOwned: false,
  notFranchise: false,
  notChain: false,
  fixedLicensedKitchen: false,
  cottageDoesNotApply: false,
  regulationsConfirmed: false,
  updatedAt: '',
};

export default function SitLicenseScreen() {
  const sellerGate = useSellerGate();
  const { license, saveLicense } = useSitDown();
  const [draft, setDraft] = useState<SitDownLicense>(license ?? EMPTY);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const check = useMemo(() => evaluateSitDownLicense(draft.stateCode || draft.placeName ? draft : null), [draft]);

  useEffect(() => {
    if (license && !draft.stateCode && !draft.placeName) setDraft(license);
  }, [license, draft.stateCode, draft.placeName]);

  const states = US_STATE_NAMES.filter((state) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.code === draft.stateCode;
    return state.name.toLowerCase().includes(needle) || state.code.toLowerCase().includes(needle);
  }).slice(0, 8);

  const set = (patch: Partial<SitDownLicense>) => {
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
    <SitDownScreen title="Retail food license" subtitle="The street address, the independence check, and the fee." testID="sit-license">
      <Text style={styles.lead}>{SIT_DOWN_RULE}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. The permit for this address</Text>
        <Text style={styles.body}>A retail food license covers the kitchen at one street address. It does not travel to another city, a truck, or a home. Write the health department, the permit number, and the fee on your invoice.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Independently owned</Text>
        <Text style={styles.body}>This directory is for mom-and-pop shops and culinary startups. Franchises, corporate concepts, and national chains stay off the list. The app stores your attestation. It does not search a corporate registry, and it does not sell a higher rank.</Text>
        <GlassPressable onPress={() => router.push('/kitchen-rules' as Href)}>
          <Text style={styles.link}>Read the Kitchen Rules</Text>
        </GlassPressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Cottage law does not cover this kitchen</Text>
        <Text style={styles.body}>Cottage food and food-freedom rules are for homemade, non-restaurant sales. A sit-down or takeout restaurant uses the retail food permit for this address. A mobile-unit permit is for a food truck.</Text>
      </View>

      <Text style={styles.label}>State of the licensed address</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search states" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="sit-state-search" />
      <View style={styles.chips}>
        {states.map((state) => (
          <GlassPressable key={state.code} style={[styles.chip, draft.stateCode === state.code && styles.chipOn]} onPress={() => set({ stateCode: state.code })}>
            <Text style={[styles.chipText, draft.stateCode === state.code && styles.chipTextOn]}>{state.name}</Text>
          </GlassPressable>
        ))}
      </View>
      {states.length === 0 ? <Text style={styles.note}>Type a state name, such as Pennsylvania or Texas.</Text> : null}

      <Field label="Restaurant or shop name" value={draft.placeName} onChangeText={(placeName) => set({ placeName })} />
      <Field label="Street address on the permit" value={draft.street} onChangeText={(street) => set({ street })} />
      <Field label="City" value={draft.city} onChangeText={(city) => set({ city })} />
      <Field label="County" value={draft.county} onChangeText={(county) => set({ county })} />
      <Field label="Health department" value={draft.healthDepartment} onChangeText={(healthDepartment) => set({ healthDepartment })} />
      <Field label="Permit number" value={draft.permitNumber} onChangeText={(permitNumber) => set({ permitNumber })} />
      <Field label="Permit fee you were quoted" value={draft.permitFee} onChangeText={(permitFee) => set({ permitFee })} />
      <Field label="Last inspection, or that the license is in process" value={draft.inspectionNote} onChangeText={(inspectionNote) => set({ inspectionNote })} multiline />
      <Field label="What the health department requires" value={draft.statuteNote} onChangeText={(statuteNote) => set({ statuteNote })} multiline />

      <Toggle label="Guests can sit down" value={draft.offersSitDown} onValueChange={(offersSitDown) => set({ offersSitDown })} />
      <Toggle label="Guests can take food to go" value={draft.offersTakeout} onValueChange={(offersTakeout) => set({ offersTakeout })} />
      <Toggle label="This business is independently owned" value={draft.independentOwned} onValueChange={(independentOwned) => set({ independentOwned })} />
      <Toggle label="This location is not a franchise" value={draft.notFranchise} onValueChange={(notFranchise) => set({ notFranchise })} />
      <Toggle label="This business is not a corporate chain" value={draft.notChain} onValueChange={(notChain) => set({ notChain })} />
      <Toggle label="Food is prepared in the licensed kitchen at this street address" value={draft.fixedLicensedKitchen} onValueChange={(fixedLicensedKitchen) => set({ fixedLicensedKitchen })} />
      <Toggle label="Cottage food law is not the license for this restaurant" value={draft.cottageDoesNotApply} onValueChange={(cottageDoesNotApply) => set({ cottageDoesNotApply })} />
      <Toggle label="I read the current retail-food rule for this address" value={draft.regulationsConfirmed} onValueChange={(regulationsConfirmed) => set({ regulationsConfirmed })} />

      {saved && check.ok ? <Text style={styles.ok}>Saved. You can add menu items.</Text> : null}
      {saved && !check.ok ? (
        <View>
          <Text style={styles.block}>Saved. The menu stays closed until these are done:</Text>
          {check.blocks.map((block) => (
            <Text key={block} style={styles.block}>{block}</Text>
          ))}
        </View>
      ) : null}
      <GlassPressable style={styles.button} onPress={save} testID="save-sit-license">
        <Text style={styles.buttonText}>Save License Record</Text>
      </GlassPressable>
    </SitDownScreen>
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
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#92400E', false: Colors.gray[300] }} />
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
  chipOn: { backgroundColor: '#92400E' },
  chipText: { color: Colors.gray[800] },
  chipTextOn: { color: Colors.white, fontWeight: '700' },
  link: { color: '#92400E', fontWeight: '700', marginTop: 8 },
  note: { color: Colors.gray[500], marginTop: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  toggleLabel: { flex: 1, color: Colors.gray[800], lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '700' },
  button: { ...glassSurface, marginTop: 16, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
