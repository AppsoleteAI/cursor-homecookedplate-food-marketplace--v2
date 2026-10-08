import React, { useState } from 'react';
import { Text, StyleSheet, TextInput, Switch, View } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { MEAL_PREP_RULE, evaluatePrepKitchen, type PrepKitchenRecord } from '@/lib/meal-prep-go';

export default function MealPrepKitchenScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { kitchen, saveKitchen } = useMealPrep();
  const [cookName, setCookName] = useState(kitchen?.cookName ?? '');
  const [stateCode, setStateCode] = useState(kitchen?.stateCode ?? '');
  const [city, setCity] = useState(kitchen?.city ?? '');
  const [county, setCounty] = useState(kitchen?.county ?? '');
  const [kitchenNote, setKitchenNote] = useState(kitchen?.kitchenNote ?? '');
  const [readyHoldNote, setReadyHoldNote] = useState(kitchen?.readyHoldNote ?? '');
  const [kitNote, setKitNote] = useState(kitchen?.kitNote ?? '');
  const [handoffNote, setHandoffNote] = useState(kitchen?.handoffNote ?? '');
  const [handlerCard, setHandlerCard] = useState(kitchen?.handlerCard ?? '');
  const [regulationsConfirmed, setRegulationsConfirmed] = useState(kitchen?.regulationsConfirmed ?? false);
  const [weekIsSeparate, setWeekIsSeparate] = useState(kitchen?.weekIsSeparate ?? false);
  const [blocks, setBlocks] = useState<string[]>([]);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/meal-prep-go" />;
  }

  const save = () => {
    const record: PrepKitchenRecord = {
      cookName,
      stateCode: stateCode.trim().toUpperCase(),
      city,
      county,
      kitchenNote,
      readyHoldNote,
      kitNote,
      handoffNote,
      handlerCard,
      regulationsConfirmed,
      weekIsSeparate,
      updatedAt: new Date().toISOString(),
    };
    const check = evaluatePrepKitchen(record);
    if (!check.ok) {
      setBlocks(check.blocks);
      return;
    }
    saveKitchen(record);
    router.replace('/meal-prep-go/seller' as Href);
  };

  return (
    <MealPrepScreen title="Kitchen record" subtitle="The app does not inspect this kitchen." testID="prep-kitchen">
      <Text style={styles.rule}>{MEAL_PREP_RULE}</Text>
      <TextInput value={cookName} onChangeText={setCookName} placeholder="Cook or kitchen name" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="prep-kitchen-name" />
      <TextInput value={stateCode} onChangeText={setStateCode} placeholder="State code" placeholderTextColor={Colors.gray[400]} autoCapitalize="characters" maxLength={2} style={styles.input} />
      <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      <TextInput value={county} onChangeText={setCounty} placeholder="County" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      <TextInput value={kitchenNote} onChangeText={setKitchenNote} placeholder="Where the week is prepared" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={readyHoldNote} onChangeText={setReadyHoldNote} placeholder="How finished meals are cooled and held" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={kitNote} onChangeText={setKitNote} placeholder="How cook-kit ingredients are portioned" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={handoffNote} onChangeText={setHandoffNote} placeholder="Pickup place, or who drops the week off" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={handlerCard} onChangeText={setHandlerCard} placeholder="Food-handler card, or none required" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>I read the current food rule. The app has not verified it.</Text>
        <Switch value={regulationsConfirmed} onValueChange={setRegulationsConfirmed} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>This week is separate from plates, farms, trucks, catering, and restaurants.</Text>
        <Switch value={weekIsSeparate} onValueChange={setWeekIsSeparate} />
      </View>
      {blocks.map((block) => (
        <Text key={block} style={styles.block}>{block}</Text>
      ))}
      <GlassPressable style={styles.button} onPress={save} testID="prep-kitchen-save">
        <Text style={styles.buttonText}>Save Kitchen Record</Text>
      </GlassPressable>
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  rule: { color: Colors.gray[600], lineHeight: 18, marginBottom: 12, fontSize: 13 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
    marginBottom: 8,
  },
  area: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rowLabel: { flex: 1, color: Colors.gray[800], lineHeight: 20 },
  block: { color: '#9F1239', marginBottom: 6, lineHeight: 20 },
  button: { ...glassSurface, marginTop: 8, backgroundColor: '#0E7490', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
