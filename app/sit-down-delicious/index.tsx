import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { GlassIconButton, GlassPressable, glassSurface } from '@/components/glass-surface';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { useSitDown } from '@/hooks/sit-down-store';
import { useAuth } from '@/hooks/auth-context';
import { SIT_DOWN_RULE } from '@/lib/sit-down-license';
import { titleCase } from '@/lib/title-case';

const LINKS: { title: string; detail: string; href: string; icon: keyof typeof Ionicons.glyphMap; seller?: boolean }[] = [
  { title: 'Places', detail: 'Coffee, yogurt, ice cream, diners, and small cafes', href: '/sit-down-delicious/places', icon: 'storefront-outline' },
  { title: 'Table or takeout', detail: 'One restaurant per order. No courier.', href: '/sit-down-delicious/basket', icon: 'cafe-outline' },
  { title: 'Restaurant orders', detail: 'Separate from plates, farms, trucks, and catering', href: '/sit-down-delicious/orders', icon: 'list-outline' },
  { title: 'Shop owner', detail: 'Open the dining room and see the payout', href: '/sit-down-delicious/seller', icon: 'restaurant-outline', seller: true },
  { title: 'Retail food license', detail: 'Fixed address, independence, and the permit fee', href: '/sit-down-delicious/license', icon: 'document-text-outline', seller: true },
];

export default function SitDownDeliciousHome() {
  const { itemCount } = useSitDown();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const links = LINKS.filter((link) => isMaker || !link.seller);
  const [zip, setZip] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="sit-hub">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={monoGradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <GlassIconButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)/home'))} testID="sit-hub-back" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={Colors.white} />
          </GlassIconButton>
          <Text style={styles.kicker}>Independent restaurants. Sit down or takeout.</Text>
          <Text style={styles.title}>SitDownDelicious</Text>
          <Text style={styles.lead}>
            Coffee, yogurt, ice cream, diners, and small cafes. Sit at a table or pick up at the counter. Chains are not listed.
          </Text>
          <View style={styles.zipRow}>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="ZIP code"
              placeholderTextColor={Colors.gray[500]}
              keyboardType="number-pad"
              style={styles.zipInput}
              testID="sit-zip"
              maxLength={5}
            />
            <GlassPressable
              style={styles.zipButton}
              onPress={() => router.push({ pathname: '/sit-down-delicious/places', params: { zip } } as unknown as Href)}
              testID="sit-zip-go"
            >
              <Text style={styles.zipButtonText}>Find Places</Text>
            </GlassPressable>
          </View>
        </LinearGradient>

        <View style={styles.models}>
          <Text style={styles.model}>Independently owned. No chains.</Text>
          <Text style={styles.model}>Sit down, counter takeout, or both</Text>
          <Text style={styles.model}>Same 10% service fee. Rank is not for sale.</Text>
        </View>

        {links.map((link) => (
          <GlassPressable key={link.href} style={styles.card} onPress={() => router.push(link.href as Href)} testID={`sit-link-${link.title}`}>
            <Ionicons name={link.icon} size={22} color="#92400E" />
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

        <GlassPressable onPress={() => router.push('/(tabs)/(home)/home')} testID="sit-back-to-plates">
          <Text style={styles.link}>Cooked plates stay on Home.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/farm-grown-basket' as Href)}>
          <Text style={styles.link}>Farm goods stay in FarmGrownBasket.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/food-truck-popup' as Href)}>
          <Text style={styles.link}>Food trucks stay in FoodTruckPopup.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/cater-event-deliver' as Href)}>
          <Text style={styles.link}>Group catering stays in CaterEventDeliver.</Text>
        </GlassPressable>
        {isMaker ? <Text style={styles.rule}>{SIT_DOWN_RULE}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFBEB' },
  body: { paddingBottom: 32 },
  hero: { ...glassSurface, padding: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28  },
  kicker: { color: '#FEF3C7', fontSize: 12, fontWeight: '700', marginTop: 12 },
  title: { color: Colors.white, fontSize: 32, fontWeight: '700', marginTop: 4 },
  lead: { color: '#FEF3C7', fontSize: 16, lineHeight: 22, marginTop: 8 },
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
  zipButton: { ...glassSurface, backgroundColor: '#78350F', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center'  },
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
  link: { marginHorizontal: 16, marginTop: 14, color: '#92400E', fontWeight: '700' },
  rule: { marginHorizontal: 16, marginTop: 12, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
