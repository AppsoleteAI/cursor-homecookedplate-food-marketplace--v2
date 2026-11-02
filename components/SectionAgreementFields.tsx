import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Colors } from '@/constants/colors';
import { SECTION_AGREEMENT_RULE, type SectionAgreement } from '@/lib/section-agreement';

export function SectionAgreementFields(props: {
  value: SectionAgreement;
  onChange: (patch: Partial<SectionAgreement>) => void;
  testID: string;
}) {
  const set = props.onChange;
  const draft = props.value;
  return (
    <View>
      <Text style={styles.body}>{SECTION_AGREEMENT_RULE}</Text>
      <Text style={styles.link} onPress={() => router.push('/food-handling' as Href)} testID={`${props.testID}-food`}>
        Open the in-app food handling information
      </Text>
      <Text style={styles.link} onPress={() => router.push('/kitchen-rules' as Href)} testID={`${props.testID}-state`}>
        Open the in-app state and local food-requirement information
      </Text>
      <Toggle
        label="The in-app food handling information was read."
        value={draft.readFoodInformation}
        onValueChange={(readFoodInformation) => set({ readFoodInformation })}
        testID={`${props.testID}-read-food`}
      />
      <Toggle
        label="The in-app state and local food-requirement information was read, and the rules for where the food is cooked were checked."
        value={draft.readStateInformation}
        onValueChange={(readStateInformation) => set({ readStateInformation })}
        testID={`${props.testID}-read-state`}
      />
      <Toggle
        label="The cook will follow the food rules of that city, county, and state. HomeCookedPlate does not verify them."
        value={draft.acceptsLocalRules}
        onValueChange={(acceptsLocalRules) => set({ acceptsLocalRules })}
        testID={`${props.testID}-local-rules`}
      />
      <Toggle
        label="The cook takes full responsibility and all liability for food served to PlateTakers."
        value={draft.acceptsAllLiability}
        onValueChange={(acceptsAllLiability) => set({ acceptsAllLiability })}
        testID={`${props.testID}-liability`}
      />
      <Toggle
        label="The cook waives any claim of responsibility or liability against HomeCookedPlate, Appsolete, PUSL, LLC, and any associated entities or individuals."
        value={draft.waivesPlatformLiability}
        onValueChange={(waivesPlatformLiability) => set({ waivesPlatformLiability })}
        testID={`${props.testID}-waiver`}
      />
      <Toggle
        label="If the city, county, or state governing body requires a commissary kitchen, the cook (platemaker) will ensure access to an authorized kitchen and will meet every requirement that comes with it. HomeCookedPlate does not provide a commissary kitchen and does not review that access."
        value={draft.maintainsCommissaryAccess}
        onValueChange={(maintainsCommissaryAccess) => set({ maintainsCommissaryAccess })}
        testID={`${props.testID}-commissary`}
      />
    </View>
  );
}

function Toggle(props: { label: string; value: boolean; onValueChange: (value: boolean) => void; testID: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Switch value={props.value} onValueChange={props.onValueChange} testID={props.testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22, color: Colors.gray[700], marginBottom: 16 },
  link: { fontSize: 15, lineHeight: 22, color: Colors.gradient.red, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rowLabel: { flex: 1, color: Colors.gray[800], lineHeight: 20 },
});
