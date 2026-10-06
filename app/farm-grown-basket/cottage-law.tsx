import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import {
  HOMEMADE_DISCLAIMER,
  PLATFORM_COTTAGE_RULE,
  US_STATE_NAMES,
  evaluateListing,
  frameworkForState,
  frameworkSummary,
  permitFeeGuidance,
  regulationDuty,
  testingProtocol,
  trackLabel,
  type ComplianceRecord,
  type RegulatoryTrack,
} from '@/lib/cottage-food';

const TRACKS: RegulatoryTrack[] = ['whole_produce', 'csa_share', 'cottage_non_tcs', 'shell_eggs', 'temperature_control'];

const EMPTY: ComplianceRecord = {
  farmName: '',
  stateCode: '',
  county: '',
  track: 'cottage_non_tcs',
  sellsDirectToConsumer: true,
  sellsWholesale: false,
  regulationsConfirmed: false,
  agencyName: '',
  statuteNote: '',
  testingProtocol: '',
  testingLab: '',
  testingDate: '',
  permitFee: '',
  permitNumber: '',
  commercialLicense: false,
  labelName: '',
  netWeight: '',
  ingredients: '',
  allergens: '',
  disclaimerAccepted: false,
  honeyInfantWarning: false,
  updatedAt: '',
};

export default function CottageLawScreen() {
  const { compliance, saveCompliance } = useFarmBasket();
  const [draft, setDraft] = useState<ComplianceRecord>(compliance ?? EMPTY);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (compliance && !draft.stateCode) setDraft(compliance);
  }, [compliance, draft.stateCode]);

  const framework = frameworkForState(draft.stateCode);
  const protocol = testingProtocol(draft.track);
  const check = useMemo(() => evaluateListing(draft.stateCode ? draft : null), [draft]);
  const states = US_STATE_NAMES.filter((state) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.code === draft.stateCode;
    return state.name.toLowerCase().includes(needle) || state.code.toLowerCase().includes(needle);
  }).slice(0, 8);

  const set = (patch: Partial<ComplianceRecord>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    saveCompliance(next);
    setDraft(next);
    setSaved(true);
  };

  return (
    <FarmScreen title="Cottage food rules" subtitle="Your county, your test, and your fee." testID="farm-cottage-law">
      <Text style={styles.lead}>{PLATFORM_COTTAGE_RULE}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Exact local regulations</Text>
        <Text style={styles.body}>
          State law is the start. The county and the city can be stricter, and the rule changes by product. A jam, a dozen eggs, and a hot meal are three different legal objects. Write the rule you actually read. A checkbox here is not a permit.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Testing protocols</Text>
        <Text style={styles.body}>
          Some foods need a lab, a process authority, or a kitchen inspection. Others need no lab test at all. Ask the agency which one applies, then record the answer, the lab, and the date. Do not invent a passing result.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Permit fees</Text>
        <Text style={styles.body}>
          Fees are published by the agency and they change. The app does not keep a price list. Type the figure from the current schedule or from your invoice. Use 0 only when the agency told you there is no fee.
        </Text>
      </View>

      <Text style={styles.label}>State</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search states"
        placeholderTextColor={Colors.gray[400]}
        style={styles.input}
        testID="cottage-state-search"
      />
      <View style={styles.chips}>
        {states.map((state) => (
          <TouchableOpacity key={state.code} style={[styles.chip, draft.stateCode === state.code && styles.chipOn]} onPress={() => set({ stateCode: state.code })}>
            <Text style={[styles.chipText, draft.stateCode === state.code && styles.chipTextOn]}>{state.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {states.length === 0 ? <Text style={styles.note}>Type a state name, such as Pennsylvania, Utah, or California.</Text> : null}
      {draft.stateCode ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{framework.replace(/_/g, ' ')}</Text>
          <Text style={styles.body}>{frameworkSummary(framework)}</Text>
          {draft.stateCode === 'PA' ? (
            <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync('https://www.pa.gov/agencies/pda/food/food-safety/limited-food-establishment-')}>
              Pennsylvania Limited Food Establishment page
            </Text>
          ) : null}
          <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}>
            cottagefoodlaws.com starting map
          </Text>
          <Text style={styles.note}>HomeCookedPlate is not affiliated with cottagefoodlaws.com.</Text>
        </View>
      ) : null}

      <Text style={styles.label}>County</Text>
      <TextInput value={draft.county} onChangeText={(county) => set({ county })} placeholder="County where the food is made" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="cottage-county" />
      <Text style={styles.label}>Farm or kitchen name</Text>
      <TextInput value={draft.farmName} onChangeText={(farmName) => set({ farmName })} placeholder="Name on the label and the stand" placeholderTextColor={Colors.gray[400]} style={styles.input} />

      <Text style={styles.label}>Product type</Text>
      {TRACKS.map((track) => (
        <TouchableOpacity key={track} style={[styles.option, draft.track === track && styles.optionOn]} onPress={() => set({ track })}>
          <Text style={[styles.optionText, draft.track === track && styles.optionTextOn]}>{trackLabel(track)}</Text>
        </TouchableOpacity>
      ))}
      {draft.stateCode ? <Text style={styles.body}>{regulationDuty(draft.track, framework)}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{protocol.title}</Text>
        {protocol.steps.map((step) => (
          <Text key={step} style={styles.step}>{step}</Text>
        ))}
        <Text style={styles.body}>{permitFeeGuidance(framework)}</Text>
      </View>

      <Field label="Agency you confirmed with" value={draft.agencyName} onChangeText={(agencyName) => set({ agencyName })} />
      <Field label="What the current rule says" value={draft.statuteNote} onChangeText={(statuteNote) => set({ statuteNote })} multiline />
      <Field label="Testing protocol you were given" value={draft.testingProtocol} onChangeText={(testingProtocolText) => set({ testingProtocol: testingProtocolText })} multiline />
      <Field label="Lab or inspector" value={draft.testingLab} onChangeText={(testingLab) => set({ testingLab })} />
      <Field label="Test or inspection date" value={draft.testingDate} onChangeText={(testingDate) => set({ testingDate })} />
      <Field label="Permit fee you were quoted" value={draft.permitFee} onChangeText={(permitFee) => set({ permitFee })} />
      <Field label="Permit or registration number" value={draft.permitNumber} onChangeText={(permitNumber) => set({ permitNumber })} />

      <Toggle label="I am selling direct to the end consumer" value={draft.sellsDirectToConsumer} onValueChange={(sellsDirectToConsumer) => set({ sellsDirectToConsumer })} />
      <Toggle label="I also plan to sell wholesale" value={draft.sellsWholesale} onValueChange={(sellsWholesale) => set({ sellsWholesale })} />
      <Toggle label="I hold a commercial or commissary license for this food" value={draft.commercialLicense} onValueChange={(commercialLicense) => set({ commercialLicense })} />
      <Toggle label="I read the current local rule for this product" value={draft.regulationsConfirmed} onValueChange={(regulationsConfirmed) => set({ regulationsConfirmed })} />

      <Text style={styles.label}>Label</Text>
      <Text style={styles.body}>Cottage foods, eggs, and temperature-controlled foods need a product name, net weight, ingredients by weight, allergens, and the homemade disclaimer where the law requires it.</Text>
      <Field label="Product name on the label" value={draft.labelName} onChangeText={(labelName) => set({ labelName })} />
      <Field label="Net weight or count" value={draft.netWeight} onChangeText={(netWeight) => set({ netWeight })} />
      <Field label="Ingredients, heaviest first" value={draft.ingredients} onChangeText={(ingredients) => set({ ingredients })} multiline />
      <Field label="Major allergens" value={draft.allergens} onChangeText={(allergens) => set({ allergens })} />
      <Toggle label={HOMEMADE_DISCLAIMER} value={draft.disclaimerAccepted} onValueChange={(disclaimerAccepted) => set({ disclaimerAccepted })} />
      <Toggle label="If this is honey: I will warn that it must not be fed to infants under one year" value={draft.honeyInfantWarning} onValueChange={(honeyInfantWarning) => set({ honeyInfantWarning })} />

      {saved && check.ok ? <Text style={styles.ok}>Saved. You can list this product type.</Text> : null}
      {saved && !check.ok ? (
        <View>
          <Text style={styles.block}>Saved. Listing stays closed until these are done:</Text>
          {check.blocks.map((block) => (
            <Text key={block} style={styles.block}>{block}</Text>
          ))}
        </View>
      ) : null}
      <TouchableOpacity style={styles.button} onPress={save} testID="save-cottage-record">
        <Text style={styles.buttonText}>Save local record</Text>
      </TouchableOpacity>
    </FarmScreen>
  );
}

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={Colors.gray[400]}
        style={[styles.input, multiline && styles.area]}
        multiline={multiline}
      />
    </View>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#166534', false: Colors.gray[300] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[800], lineHeight: 20, marginBottom: 8 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginTop: 10 },
  cardTitle: { fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 6 },
  step: { color: Colors.gray[700], lineHeight: 20, marginTop: 6 },
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
  chipOn: { backgroundColor: '#166534' },
  chipText: { color: Colors.gray[800] },
  chipTextOn: { color: Colors.white, fontWeight: '700' },
  option: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { backgroundColor: '#166534' },
  optionText: { color: Colors.gray[800], fontWeight: '600' },
  optionTextOn: { color: Colors.white },
  link: { color: '#166534', fontWeight: '700', marginTop: 8 },
  note: { color: Colors.gray[500], fontSize: 12, marginTop: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  toggleLabel: { flex: 1, color: Colors.gray[800], lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '700' },
  button: { marginTop: 16, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
