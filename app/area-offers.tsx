import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { BackCircle } from '@/components/BackCircle';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { GIFT_AREA_LABEL, OFFER_AREAS, type OfferArea } from '@/backend/lib/gift-areas';
import { useAuth } from '@/hooks/auth-context';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { trpc } from '@/lib/trpc';

function areaFromParam(value: string | string[] | undefined): OfferArea {
  const raw = Array.isArray(value) ? value[0] : value;
  return OFFER_AREAS.includes(raw as OfferArea) ? raw as OfferArea : 'farm';
}

export default function AreaOffersScreen() {
  const params = useLocalSearchParams<{ area?: string }>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const leave = useLeaveScreen('/(tabs)/profile');
  const [area, setArea] = useState<OfferArea>(areaFromParam(params.area));
  const [listingId, setListingId] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed-amount' | 'buy-x-get-y' | 'free-item'>('percentage');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('');
  const [getQuantity, setGetQuantity] = useState('');
  const [freeItemName, setFreeItemName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const items = trpc.areaOffers.myItems.useQuery({ area }, { enabled: user?.role === 'platemaker', retry: false });
  const mine = trpc.areaOffers.listMine.useQuery({ area }, { enabled: user?.role === 'platemaker', retry: false });
  const save = trpc.areaOffers.save.useMutation({ onSuccess: () => mine.refetch() });
  const remove = trpc.areaOffers.delete.useMutation({ onSuccess: () => mine.refetch() });

  const ownListings = items.data || [];

  if (!isLoading && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  const saveOffer = async () => {
    const percent = Number(discountPercentage);
    const amount = Number(discountAmount);
    if (type === 'percentage' && !(percent >= 1 && percent <= 50)) {
      Alert.alert('Percentage off', 'Enter a percentage from 1 to 50.');
      return;
    }
    if (type === 'fixed-amount' && !(amount > 0 && amount <= 100)) {
      Alert.alert('Amount off', 'Enter an amount from $0.01 to $100.');
      return;
    }
    if (!listingId || !title.trim() || !description.trim() || !startDate || !endDate) {
      Alert.alert('Offer', 'Choose an item and fill in the offer.');
      return;
    }
    try {
      await save.mutateAsync({
        area,
        listingId,
        type,
        title: title.trim(),
        description: description.trim(),
        discountPercentage: type === 'percentage' ? percent : undefined,
        discountAmount: type === 'fixed-amount' ? amount : undefined,
        buyQuantity: type === 'buy-x-get-y' ? Number(buyQuantity) : undefined,
        getQuantity: type === 'buy-x-get-y' ? Number(getQuantity) : undefined,
        freeItemName: type === 'free-item' ? freeItemName.trim() : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        isActive: true,
      });
      Alert.alert('Offer saved', 'The charge uses this offer while it is active. A discount that reaches $0 is refused.');
    } catch (error) {
      Alert.alert('Offer', error instanceof Error ? error.message : 'The offer could not be saved.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: 'Area offers', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <BackCircle tone="honey" onPress={leave} testID="area-offers-back" />
        <Text style={styles.title}>Area offers</Text>
        <Text style={styles.lead}>Percentage off is 1 to 50. A fixed amount is at most $100. Home plates use Manage Promotions. The other areas use this screen. The server prices the item.</Text>
        {user?.role !== 'platemaker' ? <Text style={styles.block}>Only a PlateMaker can set an offer.</Text> : null}
        <GlassPressable onPress={() => router.push('/promotions' as Href)} testID="area-offers-home">
          <Text style={styles.link}>Home plate promotions, 1 to 50 percent or up to $100 off</Text>
        </GlassPressable>
        <View style={styles.row}>
          {OFFER_AREAS.map((name) => (
            <GlassPressable key={name} style={[styles.chip, area === name && styles.chipOn]} onPress={() => { setArea(name); setListingId(''); }}>
              <Text style={[styles.chipText, area === name && styles.chipTextOn]}>{GIFT_AREA_LABEL[name]}</Text>
            </GlassPressable>
          ))}
        </View>
        {user?.role === 'platemaker' ? (
          <>
            <Text style={styles.label}>Your item</Text>
            {ownListings.length === 0 ? <Text style={styles.meta}>Publish an item in this area before you can put an offer on it.</Text> : null}
            {ownListings.map((item) => (
              <GlassPressable key={item.id} style={[styles.chip, listingId === item.id && styles.chipOn]} onPress={() => setListingId(item.id)}>
                <Text style={[styles.chipText, listingId === item.id && styles.chipTextOn]}>
                  {item.name}{typeof item.price === 'number' ? ` · $${item.price.toFixed(2)}` : ''}
                </Text>
              </GlassPressable>
            ))}
            <View style={styles.row}>
              {([
                ['percentage', '1–50% off'],
                ['fixed-amount', 'Up to $100 off'],
                ['buy-x-get-y', 'Buy X Get Y'],
                ['free-item', 'Free item'],
              ] as const).map(([value, label]) => (
                <GlassPressable key={value} style={[styles.chip, type === value && styles.chipOn]} onPress={() => setType(value)}>
                  <Text style={[styles.chipText, type === value && styles.chipTextOn]}>{label}</Text>
                </GlassPressable>
              ))}
            </View>
            <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={Colors.gray[400]} style={styles.input} />
            <TextInput value={description} onChangeText={setDescription} placeholder="What the buyer should know" placeholderTextColor={Colors.gray[400]} style={[styles.input, styles.area]} multiline />
            {type === 'percentage' ? <TextInput value={discountPercentage} onChangeText={(text) => setDiscountPercentage(text.replace(/[^0-9]/g, ''))} placeholder="Percent, 1 to 50" placeholderTextColor={Colors.gray[400]} keyboardType="number-pad" style={styles.input} /> : null}
            {type === 'fixed-amount' ? <TextInput value={discountAmount} onChangeText={(text) => setDiscountAmount(text.replace(/[^0-9.]/g, ''))} placeholder="Dollars off, up to 100" placeholderTextColor={Colors.gray[400]} keyboardType="decimal-pad" style={styles.input} /> : null}
            {type === 'buy-x-get-y' ? (
              <>
                <TextInput value={buyQuantity} onChangeText={(text) => setBuyQuantity(text.replace(/[^0-9]/g, ''))} placeholder="Paid quantity" placeholderTextColor={Colors.gray[400]} keyboardType="number-pad" style={styles.input} />
                <TextInput value={getQuantity} onChangeText={(text) => setGetQuantity(text.replace(/[^0-9]/g, ''))} placeholder="Free quantity" placeholderTextColor={Colors.gray[400]} keyboardType="number-pad" style={styles.input} />
              </>
            ) : null}
            {type === 'free-item' ? <TextInput value={freeItemName} onChangeText={setFreeItemName} placeholder="Free item name" placeholderTextColor={Colors.gray[400]} style={styles.input} /> : null}
            <TextInput value={startDate} onChangeText={setStartDate} placeholder="Start date YYYY-MM-DD" placeholderTextColor={Colors.gray[400]} style={styles.input} />
            <TextInput value={endDate} onChangeText={setEndDate} placeholder="End date YYYY-MM-DD" placeholderTextColor={Colors.gray[400]} style={styles.input} />
            <GlassPressable style={styles.button} onPress={saveOffer} testID="area-offer-save">
              <Text style={styles.buttonText}>Save offer</Text>
            </GlassPressable>
            <Text style={styles.label}>Offers on this area</Text>
            {(mine.data || []).length === 0 ? <Text style={styles.meta}>No offer yet.</Text> : null}
            {(mine.data || []).map((offer) => (
              <View key={offer.id} style={styles.card}>
                <Text style={styles.item}>{offer.title}</Text>
                <Text style={styles.meta}>{offer.type === 'percentage' ? `${offer.discountPercentage}% off` : offer.type === 'fixed-amount' ? `$${offer.discountAmount} off` : offer.description}</Text>
                <GlassPressable onPress={() => remove.mutate({ id: offer.id })}>
                  <Text style={styles.link}>Remove</Text>
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
  lead: { color: Colors.gray[700], lineHeight: 22, marginBottom: 12 },
  label: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[700], lineHeight: 20, marginBottom: 8 },
  block: { color: '#9F1239', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.gray[100], marginBottom: 8 },
  chipOn: { backgroundColor: '#166534' },
  chipText: { color: Colors.gray[800], fontWeight: '600' },
  chipTextOn: { color: Colors.white },
  input: { backgroundColor: Colors.gray[50], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, color: Colors.gray[900] },
  area: { minHeight: 72 },
  button: { marginTop: 16, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { color: '#166534', fontWeight: '700', marginTop: 8, marginBottom: 8 },
  card: { paddingVertical: 8 },
  item: { fontWeight: '700', color: Colors.gray[900] },
});
