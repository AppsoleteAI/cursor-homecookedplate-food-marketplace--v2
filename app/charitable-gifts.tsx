import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { BackCircle } from '@/components/BackCircle';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { producedCost } from '@/backend/lib/fees';
import { GIFT_AREAS, GIFT_AREA_LABEL, RECIPIENTS, RECIPIENT_LABEL, type GiftArea, type GiftRecipient } from '@/backend/lib/gift-areas';
import { useAuth } from '@/hooks/auth-context';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { trpc } from '@/lib/trpc';

function areaFromParam(value: string | string[] | undefined): GiftArea {
  const raw = Array.isArray(value) ? value[0] : value;
  return GIFT_AREAS.includes(raw as GiftArea) ? raw as GiftArea : 'home';
}

export default function CharitableGiftsScreen() {
  const params = useLocalSearchParams<{ area?: string }>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const leave = useLeaveScreen('/(tabs)/profile');
  const [area, setArea] = useState<GiftArea>(areaFromParam(params.area));
  const [itemName, setItemName] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [recipient, setRecipient] = useState<GiftRecipient>('unhoused');
  const [producedOn, setProducedOn] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [packagingText, setPackagingText] = useState('');
  const [claimText, setClaimText] = useState<Record<string, string>>({});

  const openGifts = trpc.charitable.listOpen.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const mine = trpc.charitable.listMine.useQuery(undefined, { enabled: user?.role === 'platemaker', retry: false });
  const save = trpc.charitable.save.useMutation({
    onSuccess: () => {
      mine.refetch();
      openGifts.refetch();
    },
  });
  const claim = trpc.charitable.claim.useMutation({
    onSuccess: () => openGifts.refetch(),
  });

  const costPreview = useMemo(() => {
    const ingredients = Number(ingredientText);
    const packaging = Number(packagingText);
    if (!Number.isFinite(ingredients) || !Number.isFinite(packaging)) return null;
    try {
      return producedCost(ingredients, packaging);
    } catch {
      return null;
    }
  }, [ingredientText, packagingText]);

  if (!isLoading && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  const saveGift = async () => {
    const quantity = Number(quantityText);
    const ingredientCost = Number(ingredientText);
    const packagingCost = Number(packagingText);
    if (itemName.trim().length < 2 || !Number.isInteger(quantity) || quantity < 1) {
      Alert.alert('Gift', 'Name the food and enter how many portions you are setting aside.');
      return;
    }
    if (!producedOn || costPreview == null) {
      Alert.alert('Gift', 'Enter the date and the ingredient and packaging cost.');
      return;
    }
    try {
      await save.mutateAsync({
        area,
        itemName: itemName.trim(),
        quantity,
        recipient,
        producedOn,
        ingredientCost,
        packagingCost,
      });
      setItemName('');
      setQuantityText('1');
      setIngredientText('');
      setPackagingText('');
      Alert.alert('Gift logged', 'This portion is not charged. No card is used.');
    } catch (error) {
      Alert.alert('Gift', error instanceof Error ? error.message : 'The gift could not be saved.');
    }
  };

  const takePortion = async (giftId: string) => {
    const quantity = Number(claimText[giftId] || '1');
    if (!Number.isInteger(quantity) || quantity < 1) {
      Alert.alert('Portion', 'Enter how many portions you are taking.');
      return;
    }
    try {
      const taken = await claim.mutateAsync({ giftId, quantity });
      Alert.alert('Portion recorded', `${taken.quantity} portion${taken.quantity === 1 ? '' : 's'} recorded. Nothing was charged.`);
    } catch (error) {
      Alert.alert('Portion', error instanceof Error ? error.message : 'The portion could not be recorded.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: 'Charitable gifts', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <BackCircle tone="honey" onPress={leave} testID="charitable-gifts-back" />
        <Text style={styles.title}>Charitable gifts</Text>
        <Text style={styles.lead}>
          A PlateMaker can set aside food for unhoused people, elders, or children. The portion is not sold. No card is charged. The register keeps the date, the quantity, who it is for, and what the ingredients and packaging cost. This screen is not a donation receipt, and it does not calculate a deduction.
        </Text>

        {user?.role === 'platemaker' ? (
          <>
            <Text style={styles.label}>Area</Text>
            <View style={styles.row}>
              {GIFT_AREAS.map((name) => (
                <GlassPressable key={name} style={[styles.chip, area === name && styles.chipOn]} onPress={() => setArea(name)}>
                  <Text style={[styles.chipText, area === name && styles.chipTextOn]}>{GIFT_AREA_LABEL[name]}</Text>
                </GlassPressable>
              ))}
            </View>
            <Text style={styles.label}>Who it is for</Text>
            <View style={styles.row}>
              {RECIPIENTS.map((name) => (
                <GlassPressable key={name} style={[styles.chip, recipient === name && styles.chipOn]} onPress={() => setRecipient(name)}>
                  <Text style={[styles.chipText, recipient === name && styles.chipTextOn]}>{RECIPIENT_LABEL[name]}</Text>
                </GlassPressable>
              ))}
            </View>
            <TextInput value={itemName} onChangeText={setItemName} placeholder="Food item" placeholderTextColor={Colors.gray[400]} style={styles.input} testID="gift-name" />
            <TextInput value={quantityText} onChangeText={(text) => setQuantityText(text.replace(/[^0-9]/g, ''))} placeholder="Portions" placeholderTextColor={Colors.gray[400]} keyboardType="number-pad" style={styles.input} />
            <TextInput value={producedOn} onChangeText={setProducedOn} placeholder="Date YYYY-MM-DD" placeholderTextColor={Colors.gray[400]} style={styles.input} />
            <TextInput value={ingredientText} onChangeText={(text) => setIngredientText(text.replace(/[^0-9.]/g, ''))} placeholder="Ingredient cost" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} />
            <TextInput value={packagingText} onChangeText={(text) => setPackagingText(text.replace(/[^0-9.]/g, ''))} placeholder="Packaging cost" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} />
            <Text style={styles.meta}>{costPreview == null ? 'Cost is ingredients plus packaging.' : `Cost to produce $${costPreview.toFixed(2)}.`}</Text>
            <GlassPressable style={styles.button} onPress={saveGift} testID="gift-save">
              <Text style={styles.buttonText}>Log this gift</Text>
            </GlassPressable>
            <Text style={styles.label}>Your register</Text>
            {(mine.data || []).length === 0 ? <Text style={styles.meta}>Nothing set aside yet.</Text> : null}
            {(mine.data || []).map((gift) => (
              <View key={gift.id} style={styles.card}>
                <Text style={styles.item}>{gift.itemName}</Text>
                <Text style={styles.meta}>
                  {GIFT_AREA_LABEL[gift.area as GiftArea] || gift.area} · {RECIPIENT_LABEL[gift.recipient as GiftRecipient] || gift.recipient} · {gift.producedOn}
                </Text>
                <Text style={styles.meta}>{gift.remaining} of {gift.quantity} left. Cost ${Number(gift.producedCost ?? 0).toFixed(2)}.</Text>
              </View>
            ))}
          </>
        ) : null}

        {user?.role === 'platetaker' ? (
          <>
            <Text style={styles.label}>Portions available</Text>
            {(openGifts.data || []).length === 0 ? <Text style={styles.meta}>No portions are set aside in your area right now.</Text> : null}
            {(openGifts.data || []).map((gift) => (
              <View key={gift.id} style={styles.card}>
                <Text style={styles.item}>{gift.itemName}</Text>
                <Text style={styles.meta}>
                  {gift.cookName} · {GIFT_AREA_LABEL[gift.area as GiftArea] || gift.area} · {RECIPIENT_LABEL[gift.recipient as GiftRecipient] || gift.recipient}
                </Text>
                <Text style={styles.meta}>{gift.remaining} left · {gift.producedOn}. No payment.</Text>
                <TextInput
                  value={claimText[gift.id] ?? '1'}
                  onChangeText={(text) => setClaimText((prev) => ({ ...prev, [gift.id]: text.replace(/[^0-9]/g, '') }))}
                  placeholder="Portions"
                  placeholderTextColor={Colors.gray[400]}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <GlassPressable style={styles.button} onPress={() => takePortion(gift.id)} testID={`gift-claim-${gift.id}`}>
                  <Text style={styles.buttonText}>Take this portion</Text>
                </GlassPressable>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  lead: { color: Colors.gray[700], lineHeight: 22, marginBottom: 8 },
  label: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[700], lineHeight: 20, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.gray[100], marginBottom: 8 },
  chipOn: { backgroundColor: '#166534' },
  chipText: { color: Colors.gray[800], fontWeight: '600' },
  chipTextOn: { color: Colors.white },
  input: { backgroundColor: Colors.gray[50], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, color: Colors.gray[900] },
  button: { marginTop: 12, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  card: { marginTop: 12 },
  item: { fontWeight: '700', color: Colors.gray[900] },
});
