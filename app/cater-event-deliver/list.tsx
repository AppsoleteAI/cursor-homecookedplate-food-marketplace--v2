import React, { useState } from 'react';
import { Text, StyleSheet, TextInput } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { evaluateCaterLicense, evaluateCaterPackage } from '@/lib/cater-event-license';

export default function ListCaterPackageScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { license, publishPackage } = useCaterEvent();
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [headcountText, setHeadcountText] = useState('20');
  const [summary, setSummary] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const licenseCheck = evaluateCaterLicense(license);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  const publish = () => {
    const item = {
      name,
      pricePerPerson: Number(priceText),
      minimumHeadcount: Number(headcountText),
      summary,
      ingredients,
      allergens,
    };
    const resultCheck = evaluateCaterPackage(license, item);
    if (!resultCheck.ok) {
      setBlocks(resultCheck.blocks);
      return;
    }
    const result = publishPackage(item);
    if (!result.ok) {
      setBlocks(result.blocks);
      return;
    }
    router.replace('/cater-event-deliver/seller' as Href);
  };

  return (
    <CaterEventScreen title="Add a package" subtitle="Fixed price per person. Not a cottage listing." testID="cater-list">
      {license && licenseCheck.ok ? (
        <Text style={styles.meta}>Listing on {license.companyName}. The package appears for order only while you are accepting drop-offs.</Text>
      ) : (
        <Text style={styles.block}>Save the catering license before a package can go up.</Text>
      )}
      <TextInput value={name} onChangeText={setName} placeholder="Package name" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="cater-list-name" />
      <TextInput value={priceText} onChangeText={setPriceText} placeholder="Price per person" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} testID="cater-list-price" />
      <TextInput value={headcountText} onChangeText={setHeadcountText} placeholder="Minimum headcount" placeholderTextColor={Colors.gray[400]} keyboardType="number-pad" style={styles.input} testID="cater-list-headcount" />
      <TextInput value={summary} onChangeText={setSummary} placeholder="What arrives at the drop-off" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={ingredients} onChangeText={setIngredients} placeholder="Ingredients" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      <TextInput value={allergens} onChangeText={setAllergens} placeholder="Major allergens" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      {blocks.map((block) => (
        <Text key={block} style={styles.block}>{block}</Text>
      ))}
      <GlassPressable style={styles.button} onPress={publish} testID="cater-publish">
        <Text style={styles.buttonText}>Publish the Package</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/cater-event-deliver/license' as Href)}>
        <Text style={styles.link}>Edit the License Record</Text>
      </GlassPressable>
    </CaterEventScreen>
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
  block: { color: '#9F1239', marginBottom: 6, lineHeight: 20 },
  button: { ...glassSurface, marginTop: 8, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#6D28D9', fontWeight: '700' },
});
