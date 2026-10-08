import React, { useState } from 'react';
import { Text, StyleSheet, TextInput } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useSitDown } from '@/hooks/sit-down-store';
import { evaluateSitDownItem, evaluateSitDownLicense } from '@/lib/sit-down-license';

export default function ListSitItemScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { license, publishItem } = useSitDown();
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [summary, setSummary] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const licenseCheck = evaluateSitDownLicense(license);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  const publish = () => {
    const price = Number(priceText);
    const item = { name, price, summary, ingredients, allergens };
    const resultCheck = evaluateSitDownItem(license, item);
    if (!resultCheck.ok) {
      setBlocks(resultCheck.blocks);
      return;
    }
    const result = publishItem(item);
    if (!result.ok) {
      setBlocks(result.blocks);
      return;
    }
    router.replace('/sit-down-delicious/seller' as Href);
  };

  return (
    <SitDownScreen title="Add a menu item" subtitle="From a licensed restaurant. Not a cottage listing." testID="sit-list">
      {license && licenseCheck.ok ? (
        <Text style={styles.meta}>Listing on {license.placeName}. The item appears only while you mark the dining room open.</Text>
      ) : (
        <Text style={styles.block}>Save the retail food license before a menu item can go up.</Text>
      )}
      <TextInput value={name} onChangeText={setName} placeholder="Item name" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="sit-list-name" />
      <TextInput value={priceText} onChangeText={setPriceText} placeholder="Price" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} testID="sit-list-price" />
      <TextInput value={summary} onChangeText={setSummary} placeholder="What the guest orders" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={ingredients} onChangeText={setIngredients} placeholder="Ingredients" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={allergens} onChangeText={setAllergens} placeholder="Major allergens" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      {blocks.map((block) => (
        <Text key={block} style={styles.block}>{block}</Text>
      ))}
      <GlassPressable style={styles.button} onPress={publish} testID="sit-publish">
        <Text style={styles.buttonText}>Publish on the Menu</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/sit-down-delicious/license' as Href)}>
        <Text style={styles.link}>Edit the License Record</Text>
      </GlassPressable>
    </SitDownScreen>
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
  button: { ...glassSurface, marginTop: 8, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#92400E', fontWeight: '700' },
});
