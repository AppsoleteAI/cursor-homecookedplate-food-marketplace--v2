import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { GlassIconButton, GlassPressable, glassSurface } from '@/components/glass-surface';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router , type Href } from 'expo-router';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useAuth } from '@/hooks/auth-context';
import { PLATFORM_COTTAGE_RULE } from '@/lib/cottage-food';
import { titleCase } from '@/lib/title-case';

const LINKS: { title: string; detail: string; href: '/farm-grown-basket/market' | '/farm-grown-basket/farms' | '/farm-grown-basket/csa' | '/farm-grown-basket/logistics' | '/farm-grown-basket/cottage-law' | '/farm-grown-basket/seller' | '/farm-grown-basket/basket' | '/farm-grown-basket/orders'; icon: keyof typeof Ionicons.glyphMap; seller?: boolean }[] = [
  { title: 'Market', detail: 'Produce, eggs, honey, and homemade goods', href: '/farm-grown-basket/market', icon: 'leaf-outline' },
  { title: 'Farms and co-ops', detail: 'Find a stand by ZIP', href: '/farm-grown-basket/farms', icon: 'map-outline' },
  { title: 'CSA shares', detail: 'A weekly produce box from one farm. Pay for this box, then pause or keep the season with that farm.', href: '/farm-grown-basket/csa', icon: 'cube-outline' },
  { title: 'Pickup and delivery', detail: 'Farm pickup, neighborhood handoff, or hub', href: '/farm-grown-basket/logistics', icon: 'bicycle-outline' },
  { title: 'Cottage food rules', detail: 'Your state, your test, your permit fee', href: '/farm-grown-basket/cottage-law', icon: 'document-text-outline', seller: true },
  { title: 'Seller stand', detail: 'List goods and see farm payouts', href: '/farm-grown-basket/seller', icon: 'storefront-outline', seller: true },
  { title: 'Farm basket', detail: 'The cart for produce, eggs, honey, and homemade goods you add on this page.', href: '/farm-grown-basket/basket', icon: 'basket-outline' },
  { title: 'Farm orders', detail: 'Opens your buyer dashboard after checkout', href: '/farm-grown-basket/orders', icon: 'receipt-outline' },
];

export default function FarmGrownBasketHome() {
  const { itemCount } = useFarmBasket();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const links = LINKS.filter((link) => isMaker || !link.seller);
  const [zip, setZip] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="farm-hub">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={monoGradients.green} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <GlassIconButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)/home'))} testID="farm-hub-back" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={Colors.white} />
          </GlassIconButton>
          <Text style={styles.title}>FarmGrownBasket</Text>
          <Text style={styles.lead}>
            Find produce, eggs, honey, and homemade goods. Pick them up from the farm or a neighborhood stand.
          </Text>
          <View style={styles.zipRow}>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="ZIP code"
              placeholderTextColor={Colors.gray[500]}
              keyboardType="number-pad"
              style={styles.zipInput}
              testID="farm-zip"
              maxLength={5}
            />
            <GlassPressable
              style={styles.zipButton}
              onPress={() => router.push({ pathname: '/farm-grown-basket/market', params: { zip } } as unknown as Href)}
              testID="farm-zip-go"
            >
              <Text style={styles.zipButtonText}>{titleCase('Find farms')}</Text>
            </GlassPressable>
          </View>
        </LinearGradient>

        <View style={styles.models}>
          <Text style={styles.model}>Direct pickup from the farm</Text>
          <Text style={styles.model}>Neighborhood stand or handoff</Text>
          <Text style={styles.model}>Wholesale goods upon request</Text>
        </View>

        {links.map((link) => (
          <GlassPressable key={link.href} style={styles.card} onPress={() => router.push(link.href as Href)} testID={`farm-link-${link.title}`}>
            <Ionicons name={link.icon} size={22} color="#166534" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {titleCase(link.title)}
                {link.href.endsWith('basket') && itemCount > 0 ? ` (${itemCount})` : ''}
              </Text>
              <Text style={styles.cardDetail}>{link.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
          </GlassPressable>
        ))}

        <View style={styles.fresh} testID="farm-fresh-goods">
          <Text style={styles.freshTitle}>Buy fresh poultry, beef, pork and dairy goods</Text>
          <Text style={styles.freshSupport}>Support your local farmer</Text>
        </View>

        {isMaker ? <Text style={styles.rule}>{PLATFORM_COTTAGE_RULE}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pagePastel.green },
  body: { paddingBottom: 32 },
  hero: { ...glassSurface, padding: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28  },
  title: { color: Colors.white, fontSize: 32, fontWeight: '700', marginTop: 12 },
  lead: { color: '#ECFDF5', fontSize: 16, lineHeight: 22, marginTop: 8 },
  zipRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  zipInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  zipButton: { ...glassSurface, backgroundColor: '#14532D', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center'  },
  zipButtonText: { color: Colors.white, fontWeight: '700' },
  models: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  model: { color: Colors.gray[700], fontSize: 14 },
  card: {
    ...glassSurface,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  cardDetail: { fontSize: 13, color: Colors.gray[600], marginTop: 2 },
  fresh: { marginHorizontal: 16, marginTop: 20, paddingVertical: 16, paddingHorizontal: 4, gap: 8 },
  freshTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: Colors.gray[900] },
  freshSupport: { fontSize: 15, lineHeight: 22, color: Colors.gray[700] },
  rule: { marginHorizontal: 16, marginTop: 12, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
