import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity } from 'react-native';
import { router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { FARM_STANDS, farmsNearZip } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { frameworkForState, stateName } from '@/lib/cottage-food';

export default function FarmsScreen() {
  const [zip, setZip] = useState('');
  const { follows } = useFarmBasket();
  const farms = farmsNearZip(zip);
  const searching = zip.replace(/\D/g, '').length >= 3;

  return (
    <FarmScreen title="Farms and co-ops" subtitle="Directory of producers. Not a plate menu." testID="farm-directory">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="Search by ZIP"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="farms-zip"
      />
      {searching && farms.length === 0 ? (
        <Text style={styles.empty}>No stand shares the first three digits of that ZIP. Showing none until you clear it.</Text>
      ) : null}
      {(searching ? farms : FARM_STANDS).map((farm) => (
        <TouchableOpacity key={farm.id} style={styles.card} onPress={() => router.push(`/farm-grown-basket/farm/${farm.id}` as Href)} testID={`farm-card-${farm.id}`}>
          <Image source={{ uri: farm.image }} style={styles.image} />
          <View style={styles.copy}>
            <Text style={styles.name}>{farm.name}</Text>
            <Text style={styles.meta}>{farm.city}, {stateName(farm.stateCode)} {farm.zip}</Text>
            <Text style={styles.meta}>{farm.county} County · {frameworkForState(farm.stateCode).replace(/_/g, ' ')}</Text>
            {follows.includes(farm.id) ? <Text style={styles.follow}>Following</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </FarmScreen>
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
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 10, marginBottom: 10 },
  image: { width: 88, height: 88, borderRadius: 12, backgroundColor: Colors.gray[200] },
  copy: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, fontSize: 13 },
  follow: { marginTop: 6, color: '#166534', fontWeight: '700', fontSize: 12 },
  empty: { color: Colors.gray[600], marginBottom: 12, lineHeight: 20 },
});
