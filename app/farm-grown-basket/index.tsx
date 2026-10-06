import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router , type Href } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { PLATFORM_COTTAGE_RULE } from '@/lib/cottage-food';

const LINKS: { title: string; detail: string; href: '/farm-grown-basket/market' | '/farm-grown-basket/farms' | '/farm-grown-basket/csa' | '/farm-grown-basket/logistics' | '/farm-grown-basket/cottage-law' | '/farm-grown-basket/seller' | '/farm-grown-basket/basket' | '/farm-grown-basket/orders'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { title: 'Market', detail: 'Produce, eggs, honey, and cottage foods', href: '/farm-grown-basket/market', icon: 'leaf-outline' },
  { title: 'Farms and co-ops', detail: 'Find a stand by ZIP', href: '/farm-grown-basket/farms', icon: 'map-outline' },
  { title: 'CSA shares', detail: 'Current box, pause, and this week’s price', href: '/farm-grown-basket/csa', icon: 'cube-outline' },
  { title: 'Pickup and delivery', detail: 'Farm pickup, neighborhood handoff, or hub', href: '/farm-grown-basket/logistics', icon: 'bicycle-outline' },
  { title: 'Cottage food rules', detail: 'Your state, your test, your permit fee', href: '/farm-grown-basket/cottage-law', icon: 'document-text-outline' },
  { title: 'Seller stand', detail: 'List goods and see farm payouts', href: '/farm-grown-basket/seller', icon: 'storefront-outline' },
  { title: 'Farm basket', detail: 'Separate from the cooked-plate cart', href: '/farm-grown-basket/basket', icon: 'basket-outline' },
  { title: 'Farm orders', detail: 'Opens your buyer dashboard after checkout', href: '/farm-grown-basket/orders', icon: 'receipt-outline' },
];

export default function FarmGrownBasketHome() {
  const { itemCount } = useFarmBasket();
  const [zip, setZip] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="farm-hub">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={monoGradients.green} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)/home'))} testID="farm-hub-back">
            <Ionicons name="chevron-back" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.kicker}>Separate from cooked plates</Text>
          <Text style={styles.title}>FarmGrownBasket</Text>
          <Text style={styles.lead}>
            A farm, garden, and co-op marketplace. Buyers meet local producers for produce, eggs, CSA boxes, and shelf-stable cottage foods.
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
            <TouchableOpacity
              style={styles.zipButton}
              onPress={() => router.push({ pathname: '/farm-grown-basket/market', params: { zip } } as unknown as Href)}
              testID="farm-zip-go"
            >
              <Text style={styles.zipButtonText}>Find farms</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.models}>
          <Text style={styles.model}>Direct pickup from the farm</Text>
          <Text style={styles.model}>Neighborhood stand or handoff</Text>
          <Text style={styles.model}>Weekly hub for whole produce only</Text>
        </View>

        {LINKS.map((link) => (
          <TouchableOpacity key={link.href} style={styles.card} onPress={() => router.push(link.href as Href)} testID={`farm-link-${link.title}`}>
            <Ionicons name={link.icon} size={22} color="#166534" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {link.title}
                {link.href.endsWith('basket') && itemCount > 0 ? ` (${itemCount})` : ''}
              </Text>
              <Text style={styles.cardDetail}>{link.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.plateLink} onPress={() => router.push('/(tabs)/(home)/home')} testID="farm-back-to-plates">
          <Text style={styles.plateLinkText}>Cooked plates stay on Home. They are not sold in this basket.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.plateLink} onPress={() => router.push('/cater-event-delivered' as Href)}>
          <Text style={styles.plateLinkText}>Group catering stays in CaterEventDelivered.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.plateLink} onPress={() => router.push('/sit-down-delicious' as Href)}>
          <Text style={styles.plateLinkText}>Independent restaurants stay in SitDownDelicious.</Text>
        </TouchableOpacity>
        <Text style={styles.rule}>{PLATFORM_COTTAGE_RULE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F2' },
  body: { paddingBottom: 32 },
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kicker: { color: '#DCFCE7', fontSize: 12, fontWeight: '700', marginTop: 12 },
  title: { color: Colors.white, fontSize: 32, fontWeight: '700', marginTop: 4 },
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
  zipButton: { backgroundColor: '#14532D', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  zipButtonText: { color: Colors.white, fontWeight: '700' },
  models: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  model: { color: Colors.gray[700], fontSize: 14 },
  card: {
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
  plateLink: { marginHorizontal: 16, marginTop: 16 },
  plateLinkText: { color: '#166534', fontWeight: '600' },
  rule: { marginHorizontal: 16, marginTop: 12, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
