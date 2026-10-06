import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { getFarm, productsForFarm } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useAuth } from '@/hooks/auth-context';
import { frameworkForState, frameworkSummary, stateName, trackLabel } from '@/lib/cottage-food';

export default function FarmProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = Array.isArray(id) ? id[0] : id;
  const farm = farmId ? getFarm(farmId) : undefined;
  const { follows, toggleFollow } = useFarmBasket();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  if (!farm) {
    return (
      <FarmScreen title="Farm" testID="farm-missing">
        <Text style={styles.body}>That stand is not in the directory.</Text>
      </FarmScreen>
    );
  }

  const framework = frameworkForState(farm.stateCode);
  const following = follows.includes(farm.id);

  return (
    <FarmScreen title={farm.name} subtitle={`${farm.city}, ${stateName(farm.stateCode)}`} testID="farm-profile">
      <Image source={{ uri: farm.image }} style={styles.hero} />
      <Text style={styles.body}>{farm.summary}</Text>
      <Text style={styles.meta}>{farm.county} County · {farm.zip}</Text>
      <TouchableOpacity style={styles.follow} onPress={() => toggleFollow(farm.id)} testID="farm-follow">
        <Text style={styles.followText}>{following ? 'Following this stand' : 'Follow this stand'}</Text>
      </TouchableOpacity>
      {isMaker ? (
        <View style={styles.rule}>
          <Text style={styles.ruleTitle}>Local rule for this stand</Text>
          <Text style={styles.body}>{frameworkSummary(framework)}</Text>
          <TouchableOpacity onPress={() => router.push('/farm-grown-basket/cottage-law' as Href)}>
            <Text style={styles.link}>Open the cottage food checklist</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <Text style={styles.section}>Goods from this stand</Text>
      {productsForFarm(farm.id).map((product) => (
        <TouchableOpacity key={product.id} style={styles.row} onPress={() => router.push(`/farm-grown-basket/product/${product.id}` as Href)}>
          <View style={styles.copy}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.meta}>{trackLabel(product.track)} · ${product.price.toFixed(2)} / {product.unit}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 180, borderRadius: 16, backgroundColor: Colors.gray[200] },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 8 },
  meta: { color: Colors.gray[500], marginTop: 4 },
  follow: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#166534', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  followText: { color: Colors.white, fontWeight: '700' },
  rule: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  ruleTitle: { fontWeight: '700', color: Colors.gray[900] },
  link: { color: '#166534', fontWeight: '700', marginTop: 8 },
  section: { marginTop: 18, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  row: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginTop: 8 },
  copy: {},
  name: { fontWeight: '700', color: Colors.gray[900] },
});
