import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { SIT_DOWN_PLACES, SHOP_KIND_LABEL, placesNearZip, type ShopKind } from '@/constants/sit-down-delicious';
import { useSitDown } from '@/hooks/sit-down-store';
import { useAuth } from '@/hooks/auth-context';
import { stateName } from '@/lib/cottage-food';
import { evaluateSitDownLicense } from '@/lib/sit-down-license';

const KINDS: { id: ShopKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'yogurt', label: 'Yogurt' },
  { id: 'ice_cream', label: 'Ice cream' },
  { id: 'diner', label: 'Diner' },
  { id: 'cafe', label: 'Cafe' },
];

export default function PlacesScreen() {
  const params = useLocalSearchParams<{ zip?: string }>();
  const initialZip = Array.isArray(params.zip) ? params.zip[0] : params.zip ?? '';
  const [zip, setZip] = useState(initialZip);
  const [kind, setKind] = useState<ShopKind | 'all'>('all');
  const { follows, license, ownerOpen, listings } = useSitDown();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const searching = zip.replace(/\D/g, '').length >= 3;
  const nearby = searching ? placesNearZip(zip) : SIT_DOWN_PLACES;
  const list = kind === 'all' ? nearby : nearby.filter((place) => place.kind === kind);
  const ownerReady = ownerOpen && evaluateSitDownLicense(license).ok && listings.length > 0;

  return (
    <SitDownScreen title="Places" subtitle="Independent shops. Chains are not in this directory." testID="sit-places">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="Search by ZIP"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="places-zip"
      />
      <View style={styles.chips}>
        {KINDS.map((option) => (
          <TouchableOpacity key={option.id} style={[styles.chip, kind === option.id && styles.chipOn]} onPress={() => setKind(option.id)}>
            <Text style={[styles.chipText, kind === option.id && styles.chipTextOn]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isMaker && ownerReady && kind === 'all' && !searching ? (
        <TouchableOpacity style={styles.card} onPress={() => router.push('/sit-down-delicious/seller' as Href)} testID="owner-place-card">
          <View style={styles.copy}>
            <Text style={styles.name}>{license?.placeName}</Text>
            <Text style={styles.meta}>{license?.city}, {stateName(license?.stateCode ?? '')}</Text>
            <Text style={styles.meta}>Open · your menu · {listings.length} item{listings.length === 1 ? '' : 's'}</Text>
          </View>
        </TouchableOpacity>
      ) : null}
      {searching && list.length === 0 ? <Text style={styles.empty}>No independent shop matches that ZIP.</Text> : null}
      {list.map((place) => (
        <TouchableOpacity key={place.id} style={styles.card} onPress={() => router.push(`/sit-down-delicious/place/${place.id}` as Href)} testID={`place-card-${place.id}`}>
          <Image source={{ uri: place.image }} style={styles.image} />
          <View style={styles.copy}>
            <Text style={styles.name}>{place.name}</Text>
            <Text style={styles.meta}>{place.city}, {stateName(place.stateCode)} {place.zip}</Text>
            <Text style={styles.meta}>{place.openNow ? 'Open' : 'Closed'} · {SHOP_KIND_LABEL[place.kind]}</Text>
            {follows.includes(place.id) ? <Text style={styles.follow}>On your list</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#92400E' },
  chipText: { color: Colors.gray[800] },
  chipTextOn: { color: Colors.white, fontWeight: '700' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 10, marginBottom: 10 },
  image: { width: 88, height: 88, borderRadius: 12, backgroundColor: Colors.gray[200] },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  follow: { marginTop: 6, color: '#92400E', fontWeight: '700', fontSize: 12 },
  empty: { color: Colors.gray[600], marginBottom: 12 },
});
