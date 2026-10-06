import React, { useState } from 'react';
import { Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Redirect, router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { evaluateTruckMenuItem, evaluateTruckPermit } from '@/lib/food-truck-permit';

export default function ListTruckItemScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { permit, publishItem } = useFoodTruck();
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [summary, setSummary] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const permitCheck = evaluateTruckPermit(permit);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  const publish = () => {
    const price = Number(priceText);
    const item = { name, price, summary, ingredients, allergens };
    const resultCheck = evaluateTruckMenuItem(permit, item);
    if (!resultCheck.ok) {
      setBlocks(resultCheck.blocks);
      return;
    }
    const result = publishItem(item);
    if (!result.ok) {
      setBlocks(result.blocks);
      return;
    }
    router.replace('/food-truck-popup/seller' as Href);
  };

  return (
    <FoodTruckScreen title="Add a menu item" subtitle="Hot food from a licensed truck. Not a cottage listing." testID="truck-list">
      {permit && permitCheck.ok ? (
        <Text style={styles.meta}>Listing on {permit.truckName}. The item appears for order-ahead only while you mark the window open.</Text>
      ) : (
        <Text style={styles.block}>Save the mobile permit before a menu item can go up.</Text>
      )}
      <TextInput value={name} onChangeText={setName} placeholder="Item name" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="truck-list-name" />
      <TextInput value={priceText} onChangeText={setPriceText} placeholder="Price" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} testID="truck-list-price" />
      <TextInput value={summary} onChangeText={setSummary} placeholder="What the customer picks up" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={ingredients} onChangeText={setIngredients} placeholder="Ingredients" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={allergens} onChangeText={setAllergens} placeholder="Major allergens" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      {blocks.map((block) => (
        <Text key={block} style={styles.block}>{block}</Text>
      ))}
      <TouchableOpacity style={styles.button} onPress={publish} testID="truck-publish">
        <Text style={styles.buttonText}>Publish on the truck</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/food-truck-popup/permit' as Href)}>
        <Text style={styles.link}>Edit the permit record</Text>
      </TouchableOpacity>
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  meta: { color: Colors.gray[700], marginBottom: 8, lineHeight: 20 },
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
  block: { color: '#9A3412', marginBottom: 6, lineHeight: 20 },
  button: { marginTop: 8, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#C2410C', fontWeight: '700' },
});
