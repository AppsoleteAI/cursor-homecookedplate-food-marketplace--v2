import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { FARM_PRODUCTS, getFarm } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';

export default function CsaScreen() {
  const { addItem } = useFarmBasket();
  const shares = FARM_PRODUCTS.filter((product) => product.kind === 'csa');

  return (
    <FarmScreen title="CSA shares" subtitle="Pay for the current box. The farm handles pauses and the rest of the season." testID="farm-csa">
      <Text style={styles.lead}>
        A share is a direct agreement with one farm or co-op. This checkout charges the current box through the same fee split as other FarmGrownBasket orders. It does not bill future installments, and it does not put a cooked plate in your plate cart.
      </Text>
      {shares.map((share) => {
        const farm = getFarm(share.farmId);
        return (
          <View key={share.id} style={styles.card}>
            <Text style={styles.name}>{share.name}</Text>
            <Text style={styles.meta}>{farm?.name}</Text>
            <Text style={styles.body}>{share.summary}</Text>
            <Text style={styles.body}>{share.seasonNote}</Text>
            <Text style={styles.price}>${share.price.toFixed(2)} / {share.unit}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.button} onPress={() => addItem(share.id, 1)} testID={`add-csa-${share.id}`}>
                <Text style={styles.buttonText}>Add current box</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/farm-grown-basket/product/${share.id}` as Href)}>
                <Text style={styles.link}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <TouchableOpacity onPress={() => router.push('/farm-grown-basket/basket' as Href)}>
        <Text style={styles.link}>Review the farm basket</Text>
      </TouchableOpacity>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  lead: { color: Colors.gray[700], lineHeight: 20 },
  card: { marginTop: 14, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  name: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[500], marginTop: 4 },
  body: { color: Colors.gray[700], marginTop: 8, lineHeight: 20 },
  price: { marginTop: 8, color: '#166534', fontWeight: '700', fontSize: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  button: { backgroundColor: '#166534', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { color: '#166534', fontWeight: '700', marginTop: 12 },
});
