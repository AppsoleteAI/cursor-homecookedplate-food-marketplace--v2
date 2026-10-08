import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { GlassIconButton, GlassPressable, glassSurface } from '@/components/glass-surface';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { useAuth } from '@/hooks/auth-context';
import { FOOD_TRUCK_RULE } from '@/lib/food-truck-permit';
import { titleCase } from '@/lib/title-case';

const LINKS: { title: string; detail: string; href: string; icon: keyof typeof Ionicons.glyphMap; seller?: boolean }[] = [
  { title: 'Live board', detail: 'Trucks that have the window open', href: '/food-truck-popup/board', icon: 'radio-outline' },
  { title: 'Trucks', detail: 'Menus, lots, and neighborhoods', href: '/food-truck-popup/trucks', icon: 'bus-outline' },
  { title: 'Schedules', detail: 'Lot calendars for later today and this week', href: '/food-truck-popup/schedule', icon: 'calendar-outline' },
  { title: 'Window order', detail: 'One truck at a time. Pickup at the window.', href: '/food-truck-popup/basket', icon: 'receipt-outline' },
  { title: 'Truck orders', detail: 'Separate from plates and farm goods', href: '/food-truck-popup/orders', icon: 'list-outline' },
  { title: 'Truck owner', detail: 'Mark the window open and see the payout', href: '/food-truck-popup/seller', icon: 'storefront-outline', seller: true },
  { title: 'Mobile permit', detail: 'Health permit, commissary, and the fee', href: '/food-truck-popup/permit', icon: 'document-text-outline', seller: true },
];

export default function FoodTruckPopupHome() {
  const { itemCount } = useFoodTruck();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const links = LINKS.filter((link) => isMaker || !link.seller);
  const [zip, setZip] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="truck-hub">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={monoGradients.orange} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <GlassIconButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)/home'))} testID="truck-hub-back" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={Colors.white} />
          </GlassIconButton>
          <Text style={styles.kicker}>Window pickup. Not a delivery app.</Text>
          <Text style={styles.title}>FoodTruckPopup</Text>
          <Text style={styles.lead}>
            Find a truck, read the lot schedule, and order ahead for the service window. The truck marks itself active when the window is open.
          </Text>
          <View style={styles.zipRow}>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="ZIP code"
              placeholderTextColor={Colors.gray[500]}
              keyboardType="number-pad"
              style={styles.zipInput}
              testID="truck-zip"
              maxLength={5}
            />
            <GlassPressable
              style={styles.zipButton}
              onPress={() => router.push({ pathname: '/food-truck-popup/board', params: { zip } } as unknown as Href)}
              testID="truck-zip-go"
            >
              <Text style={styles.zipButtonText}>Find Trucks</Text>
            </GlassPressable>
          </View>
        </LinearGradient>

        <View style={styles.models}>
          <Text style={styles.model}>Order ahead, then skip the line at the window</Text>
          <Text style={styles.model}>Active means the window is open right now</Text>
          <Text style={styles.model}>Same 10% service fee. No courier commission.</Text>
        </View>

        {links.map((link) => (
          <GlassPressable key={link.href} style={styles.card} onPress={() => router.push(link.href as Href)} testID={`truck-link-${link.title}`}>
            <Ionicons name={link.icon} size={22} color="#C2410C" />
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

        <GlassPressable onPress={() => router.push('/(tabs)/(home)/home')} testID="truck-back-to-plates">
          <Text style={styles.link}>Cooked plates stay on Home.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/farm-grown-basket' as Href)}>
          <Text style={styles.link}>Farm goods stay in FarmGrownBasket.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/cater-event-deliver' as Href)}>
          <Text style={styles.link}>Group catering stays in CaterEventDeliver.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/sit-down-delicious' as Href)}>
          <Text style={styles.link}>Independent restaurants stay in SitDownDelicious.</Text>
        </GlassPressable>
        {isMaker ? <Text style={styles.rule}>{FOOD_TRUCK_RULE}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF7ED' },
  body: { paddingBottom: 32 },
  hero: { ...glassSurface, padding: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28  },
  kicker: { color: '#FFEDD5', fontSize: 12, fontWeight: '700', marginTop: 12 },
  title: { color: Colors.white, fontSize: 32, fontWeight: '700', marginTop: 4 },
  lead: { color: '#FFEDD5', fontSize: 16, lineHeight: 22, marginTop: 8 },
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
  zipButton: { ...glassSurface, backgroundColor: '#7C2D12', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center'  },
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
  link: { marginHorizontal: 16, marginTop: 14, color: '#C2410C', fontWeight: '700' },
  rule: { marginHorizontal: 16, marginTop: 12, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
