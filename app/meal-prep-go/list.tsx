import React, { useState } from 'react';
import { Text, StyleSheet, TextInput, View } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import type { PrepDiet, PrepLane } from '@/constants/meal-prep-go';
import { useAuth } from '@/hooks/auth-context';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { PREP_DIETS, PREP_LANES, dietLabel, evaluatePrepKitchen, laneLabel } from '@/lib/meal-prep-go';

export default function ListPrepItemScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { kitchen, publishItem } = useMealPrep();
  const [lane, setLane] = useState<PrepLane>('ready');
  const [diet, setDiet] = useState<PrepDiet>('balanced');
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [minutesText, setMinutesText] = useState(lane === 'addon' ? '0' : '15');
  const [summary, setSummary] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('None');
  const [recipeNote, setRecipeNote] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const kitchenCheck = evaluatePrepKitchen(kitchen);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/meal-prep-go" />;
  }

  const chooseLane = (next: PrepLane) => {
    setLane(next);
    if (next === 'addon') setMinutesText('0');
    if (next === 'ready') setRecipeNote('');
    if (next === 'cook' && minutesText === '0') setMinutesText('35');
  };

  const publish = () => {
    const price = Number(priceText);
    const minutes = Number(minutesText);
    const result = publishItem({
      lane,
      diet,
      name,
      price,
      minutes,
      summary,
      ingredients,
      allergens,
      recipeNote,
    });
    if (!result.ok) {
      setBlocks(result.blocks);
      return;
    }
    router.replace('/meal-prep-go/seller' as Href);
  };

  return (
    <MealPrepScreen title="Add a weekly item" subtitle="Ready, cook, or an add-on that rides with the week." testID="prep-list">
      {kitchenCheck.ok ? null : <Text style={styles.block}>{kitchenCheck.blocks[0]}</Text>}
      <Text style={styles.label}>Lane</Text>
      <View style={styles.row}>
        {PREP_LANES.map((option) => (
          <GlassPressable key={option} style={[styles.chip, lane === option && styles.chipOn]} onPress={() => chooseLane(option)}>
            <Text style={[styles.chipText, lane === option && styles.chipTextOn]}>{laneLabel(option)}</Text>
          </GlassPressable>
        ))}
      </View>
      <Text style={styles.label}>Diet</Text>
      <View style={styles.row}>
        {PREP_DIETS.map((option) => (
          <GlassPressable key={option} style={[styles.chip, diet === option && styles.chipOn]} onPress={() => setDiet(option)}>
            <Text style={[styles.chipText, diet === option && styles.chipTextOn]}>{dietLabel(option)}</Text>
          </GlassPressable>
        ))}
      </View>
      <TextInput value={name} onChangeText={setName} placeholder="Item name" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="prep-list-name" />
      <TextInput value={priceText} onChangeText={setPriceText} placeholder="Price" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} testID="prep-list-price" />
      <TextInput value={minutesText} onChangeText={setMinutesText} placeholder="Minutes" placeholderTextColor={Colors.gray[400]} keyboardType="number-pad" style={styles.input} />
      <TextInput value={summary} onChangeText={setSummary} placeholder="What the buyer receives" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={ingredients} onChangeText={setIngredients} placeholder="Ingredients" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={allergens} onChangeText={setAllergens} placeholder="Allergens, or None" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      {lane === 'cook' ? (
        <TextInput value={recipeNote} onChangeText={setRecipeNote} placeholder="Recipe steps" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      ) : null}
      {blocks.map((block) => (
        <Text key={block} style={styles.block}>{block}</Text>
      ))}
      <GlassPressable style={styles.button} onPress={publish} testID="prep-publish">
        <Text style={styles.buttonText}>Publish to MealPrepGo</Text>
      </GlassPressable>
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#0E7490' },
  chipText: { color: Colors.gray[800], fontWeight: '700' },
  chipTextOn: { color: Colors.white },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
    marginBottom: 8,
  },
  area: { minHeight: 80, textAlignVertical: 'top' },
  block: { color: '#9F1239', marginBottom: 6, lineHeight: 20 },
  button: { ...glassSurface, marginTop: 8, backgroundColor: '#0E7490', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
