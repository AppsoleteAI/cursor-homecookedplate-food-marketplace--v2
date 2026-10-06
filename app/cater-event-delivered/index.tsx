import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { CATER_EVENT_RULE } from '@/lib/cater-event-license';

const LINKS: { title: string; detail: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { title: 'Open for orders', detail: 'Companies taking drop-offs right now', href: '/cater-event-delivered/board', icon: 'radio-outline' },
  { title: 'Catering companies', detail: 'Kitchens, packages, and service areas', href: '/cater-event-delivered/companies', icon: 'business-outline' },
  { title: 'Drop-off calendar', detail: 'Posted lunch and event windows', href: '/cater-event-delivered/calendar', icon: 'calendar-outline' },
  { title: 'Group order', detail: 'One company. Price is per person.', href: '/cater-event-delivered/basket', icon: 'people-outline' },
  { title: 'Catering orders', detail: 'Spend by organization, separate from plates', href: '/cater-event-delivered/orders', icon: 'receipt-outline' },
  { title: 'Catering company', detail: 'Accept orders and see the payout', href: '/cater-event-delivered/seller', icon: 'storefront-outline' },
  { title: 'Catering license', detail: 'Commercial kitchen, service area, and the fee', href: '/cater-event-delivered/license', icon: 'document-text-outline' },
];

export default function CaterEventDeliveredHome() {
  const { packageCount } = useCaterEvent();
  const [zip, setZip] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="cater-hub">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={monoGradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)/home'))} testID="cater-hub-back">
            <Ionicons name="chevron-back" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.kicker}>Group drop-off. Not a single plate.</Text>
          <Text style={styles.title}>CaterEventDelivered</Text>
          <Text style={styles.lead}>
            Offices, clinics, and event hosts order a fixed price per person. The catering company drops off the trays and sets them up.
          </Text>
          <View style={styles.zipRow}>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="ZIP code"
              placeholderTextColor={Colors.gray[500]}
              keyboardType="number-pad"
              style={styles.zipInput}
              testID="cater-zip"
              maxLength={5}
            />
            <TouchableOpacity
              style={styles.zipButton}
              onPress={() => router.push({ pathname: '/cater-event-delivered/board', params: { zip } } as unknown as Href)}
              testID="cater-zip-go"
            >
              <Text style={styles.zipButtonText}>Find caterers</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.models}>
          <Text style={styles.model}>Packages are priced per person, with a minimum headcount</Text>
          <Text style={styles.model}>Accepting means the company will take a drop-off today</Text>
          <Text style={styles.model}>Same 10% service fee. No 15% to 25% marketplace commission.</Text>
        </View>

        {LINKS.map((link) => (
          <TouchableOpacity key={link.href} style={styles.card} onPress={() => router.push(link.href as Href)} testID={`cater-link-${link.title}`}>
            <Ionicons name={link.icon} size={22} color="#6D28D9" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {link.title}
                {link.href.endsWith('basket') && packageCount > 0 ? ` (${packageCount})` : ''}
              </Text>
              <Text style={styles.cardDetail}>{link.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={() => router.push('/(tabs)/(home)/home')} testID="cater-back-to-plates">
          <Text style={styles.link}>Cooked plates stay on Home.</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/farm-grown-basket' as Href)}>
          <Text style={styles.link}>Farm goods stay in FarmGrownBasket.</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/food-truck-popup' as Href)}>
          <Text style={styles.link}>Food trucks stay in FoodTruckPopup.</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/sit-down-delicious' as Href)}>
          <Text style={styles.link}>Independent restaurants stay in SitDownDelicious.</Text>
        </TouchableOpacity>
        <Text style={styles.rule}>{CATER_EVENT_RULE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F3FF' },
  body: { paddingBottom: 32 },
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kicker: { color: '#EDE9FE', fontSize: 12, fontWeight: '700', marginTop: 12 },
  title: { color: Colors.white, fontSize: 32, fontWeight: '700', marginTop: 4 },
  lead: { color: '#EDE9FE', fontSize: 16, lineHeight: 22, marginTop: 8 },
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
  zipButton: { backgroundColor: '#4C1D95', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
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
  link: { marginHorizontal: 16, marginTop: 14, color: '#6D28D9', fontWeight: '700' },
  rule: { marginHorizontal: 16, marginTop: 12, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
