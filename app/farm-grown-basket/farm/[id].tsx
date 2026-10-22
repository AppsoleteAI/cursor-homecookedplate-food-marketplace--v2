import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { PricedItemCard } from '@/components/PricedItemCard';
import { Colors } from '@/constants/colors';
import { getFarm, productsForFarm } from '@/constants/farm-grown-basket';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useAuth } from '@/hooks/auth-context';
import { frameworkForState, frameworkSummary, stateName, trackLabel } from '@/lib/cottage-food';
import { cottageBandLabel, cottageDirectoryRow } from '@/lib/cottage-directory';

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
    <FarmScreen title={titleCase(farm.name)} subtitle={`${farm.city}, ${stateName(farm.stateCode)}`} testID="farm-profile">
      <Image source={{ uri: farm.image }} style={styles.hero} />
      <Text style={styles.body}>{farm.summary}</Text>
      <Text style={styles.meta}>{farm.county} County · {farm.zip}</Text>
      <GlassPressable style={styles.follow} onPress={() => toggleFollow(farm.id)} testID="farm-follow">
        <Text style={styles.followText}>{following ? 'Following This Stand' : 'Follow This Stand'}</Text>
      </GlassPressable>
      {cottageDirectoryRow(farm.stateCode) ? (
        <View style={styles.rule}>
          <Text style={styles.ruleTitle}>Cottage map summary</Text>
          <Text style={styles.body}>{cottageBandLabel(cottageDirectoryRow(farm.stateCode)!.band)}. This is a map summary, not a permit.</Text>
          {cottageDirectoryRow(farm.stateCode)?.foodFreedom ? <Text style={styles.body}>Food freedom is named for this state. Hot meals, dairy, and cooked meat stay off the cottage shelf until you confirm the statute.</Text> : null}
          {cottageDirectoryRow(farm.stateCode)?.cap ? <Text style={styles.body}>Annual cap: {cottageDirectoryRow(farm.stateCode)?.cap}</Text> : null}
          <GlassPressable onPress={() => router.push('/farm-grown-basket/directory' as Href)} testID="farm-profile-directory">
            <Text style={styles.link}>State-by-state cottage directory</Text>
          </GlassPressable>
        </View>
      ) : null}
      {isMaker ? (
        <View style={styles.rule}>
          <Text style={styles.ruleTitle}>Local rule for this stand</Text>
          <Text style={styles.body}>{frameworkSummary(framework)}</Text>
          <GlassPressable onPress={() => router.push('/farm-grown-basket/cottage-law' as Href)}>
            <Text style={styles.link}>Open the Cottage Food Checklist</Text>
          </GlassPressable>
        </View>
      ) : null}
      <Text style={styles.section}>Goods from this stand</Text>
      {productsForFarm(farm.id).map((product) => (
        <PricedItemCard
          key={product.id}
          image={product.image}
          title={titleCase(product.name)}
          meta={trackLabel(product.track)}
          price={`$${product.price.toFixed(2)} / ${product.unit}`}
          onPress={() => router.push(`/farm-grown-basket/product/${product.id}` as Href)}
          testID={`farm-product-${product.id}`}
        />
      ))}
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  hero: { ...glassSurface, width: '100%', height: 180, borderRadius: 16, backgroundColor: Colors.gray[200]  },
  body: { color: Colors.gray[700], lineHeight: 20, marginTop: 8 },
  meta: { color: Colors.gray[500], marginTop: 4 },
  follow: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#166534', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  followText: { color: Colors.white, fontWeight: '700' },
  rule: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  ruleTitle: { fontWeight: '700', color: Colors.gray[900] },
  link: { color: '#166534', fontWeight: '700', marginTop: 8 },
  section: { marginTop: 18, marginBottom: 8, fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
});
