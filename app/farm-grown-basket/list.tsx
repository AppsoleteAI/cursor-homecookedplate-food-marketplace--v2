import React, { useState } from 'react';
import { Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Redirect, router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { evaluateListing, trackLabel } from '@/lib/cottage-food';

export default function ListFarmGoodScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const { compliance, publishListing } = useFarmBasket();
  const [name, setName] = useState(compliance?.labelName ?? '');
  const [priceText, setPriceText] = useState('');
  const [unit, setUnit] = useState('');
  const [summary, setSummary] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const check = evaluateListing(compliance);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const publish = () => {
    const price = Number(priceText);
    const nextBlocks = [...check.blocks];
    if (name.trim().length < 2) nextBlocks.push('Name the good.');
    if (!Number.isFinite(price) || price <= 0) nextBlocks.push('Enter a price greater than zero.');
    if (unit.trim().length < 1) nextBlocks.push('Enter the unit, such as jar, dozen, or pound.');
    if (summary.trim().length < 8) nextBlocks.push('Describe what the buyer is getting.');
    if (nextBlocks.length > 0) {
      setBlocks(nextBlocks);
      return;
    }
    const result = publishListing({ name, price, unit, summary });
    if (!result.ok) {
      setBlocks(result.blocks);
      return;
    }
    router.replace('/farm-grown-basket/seller' as Href);
  };

  return (
    <FarmScreen title="List a farm good" subtitle="Cooked plates are created on the meal screen, not here." testID="farm-list">
      {compliance ? (
        <Text style={styles.meta}>Listing as {trackLabel(compliance.track)} from {compliance.county} County.</Text>
      ) : (
        <Text style={styles.block}>Save the cottage food record before you can list.</Text>
      )}
      <TextInput value={name} onChangeText={setName} placeholder="Product name" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="farm-list-name" />
      <TextInput value={priceText} onChangeText={setPriceText} placeholder="Price" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} testID="farm-list-price" />
      <TextInput value={unit} onChangeText={setUnit} placeholder="Unit (jar, dozen, pound)" placeholderTextColor={Colors.gray[400]} style={styles.input} />
      <TextInput value={summary} onChangeText={setSummary} placeholder="What the buyer receives" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
      {blocks.map((block) => (
        <Text key={block} style={styles.block}>{block}</Text>
      ))}
      <TouchableOpacity style={styles.button} onPress={publish} testID="farm-publish">
        <Text style={styles.buttonText}>Publish to FarmGrownBasket</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/farm-grown-basket/cottage-law' as Href)}>
        <Text style={styles.link}>Edit state, test, and permit fee</Text>
      </TouchableOpacity>
    </FarmScreen>
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
  area: { minHeight: 80, textAlignVertical: 'top' },
  block: { color: '#9A3412', marginBottom: 6, lineHeight: 20 },
  button: { marginTop: 8, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#166534', fontWeight: '700' },
});
