import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { GlassIconButton, GlassPressable, glassSurface } from '@/components/glass-surface';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { useAuth } from '@/hooks/auth-context';
import { MEAL_PREP_RULE } from '@/lib/meal-prep-go';
import { titleCase } from '@/lib/title-case';

const LINKS: { title: string; detail: string; href: string; icon: keyof typeof Ionicons.glyphMap; seller?: boolean }[] = [
  { title: 'Open this week', detail: 'Cooks taking a weekly order right now', href: '/meal-prep-go/board', icon: 'radio-outline' },
  { title: 'Cooks', detail: 'Kitchens, menus, and pickup windows', href: '/meal-prep-go/cooks', icon: 'restaurant-outline' },
  { title: 'Your week', detail: 'Ready meals, cook kits, and add-ons from one cook', href: '/meal-prep-go/week', icon: 'calendar-outline' },
  { title: 'Prep orders', detail: 'Weekly plans, separate from single plates', href: '/meal-prep-go/orders', icon: 'receipt-outline' },
  { title: 'Your kitchen', detail: 'Open the week and see the payout', href: '/meal-prep-go/seller', icon: 'storefront-outline', seller: true },
  { title: 'Kitchen record', detail: 'Where the week is prepared, held, and handed off', href: '/meal-prep-go/kitchen', icon: 'document-text-outline', seller: true },
];

export default function MealPrepGoHome() {
  const { portionCount } = useMealPrep();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const links = LINKS.filter((link) => isMaker || !link.seller);
  const [zip, setZip] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="prep-hub">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={monoGradients.blue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <GlassIconButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)/home'))} testID="prep-hub-back" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={Colors.white} />
          </GlassIconButton>
          <Text style={styles.kicker}>A week of meals. Not a single plate.</Text>
          <Text style={styles.title}>MealPrepGo</Text>
          <Text style={styles.lead}>
            Heat-and-eat meals, cook-at-home kits, or a mix. Built for the week, picked up or dropped off by the cook.
          </Text>
          <View style={styles.zipRow}>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="ZIP code"
              placeholderTextColor={Colors.gray[500]}
              keyboardType="number-pad"
              style={styles.zipInput}
              testID="prep-zip"
              maxLength={5}
            />
            <GlassPressable
              style={styles.zipButton}
              onPress={() => router.push({ pathname: '/meal-prep-go/board', params: { zip } } as unknown as Href)}
              testID="prep-zip-go"
            >
              <Text style={styles.zipButtonText}>Find Cooks</Text>
            </GlassPressable>
          </View>
        </LinearGradient>

        <View style={styles.models}>
          <Text style={styles.model}>Ready meals are finished. Reheat them in about 15 minutes.</Text>
          <Text style={styles.model}>Cook kits are portioned ingredients and a recipe, about 30 to 40 minutes.</Text>
          <Text style={styles.model}>Add-ons ride with the week. They are not a separate order.</Text>
          <Text style={styles.model}>Same 10% service fee. No extra marketplace commission.</Text>
        </View>

        {links.map((link) => (
          <GlassPressable key={link.href} style={styles.card} onPress={() => router.push(link.href as Href)} testID={`prep-link-${link.title}`}>
            <Ionicons name={link.icon} size={22} color="#0E7490" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {titleCase(link.title)}
                {link.href.endsWith('week') && portionCount > 0 ? ` (${portionCount})` : ''}
              </Text>
              <Text style={styles.cardDetail}>{link.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
          </GlassPressable>
        ))}

        <GlassPressable onPress={() => router.push('/(tabs)/(home)/home')} testID="prep-back-to-plates">
          <Text style={styles.link}>Single plates stay on Home.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/farm-grown-basket' as Href)}>
          <Text style={styles.link}>Farm goods stay in FarmGrownBasket.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/food-truck-popup' as Href)}>
          <Text style={styles.link}>Food trucks stay in FoodTruckPopup.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/cater-event-deliver' as Href)}>
          <Text style={styles.link}>Group drop-off stays in CaterEventDeliver.</Text>
        </GlassPressable>
        <GlassPressable onPress={() => router.push('/sit-down-delicious' as Href)}>
          <Text style={styles.link}>Independent restaurants stay in SitDownDelicious.</Text>
        </GlassPressable>
        {isMaker ? <Text style={styles.rule}>{MEAL_PREP_RULE}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ECFEFF' },
  body: { paddingBottom: 32 },
  hero: { ...glassSurface, padding: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28  },
  kicker: { color: '#CFFAFE', fontSize: 12, fontWeight: '700', marginTop: 12 },
  title: { color: Colors.white, fontSize: 32, fontWeight: '700', marginTop: 4 },
  lead: { color: '#CFFAFE', fontSize: 16, lineHeight: 22, marginTop: 8 },
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
  zipButton: { ...glassSurface, backgroundColor: '#155E75', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center'  },
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
  link: { marginHorizontal: 16, marginTop: 14, color: '#0E7490', fontWeight: '700' },
  rule: { marginHorizontal: 16, marginTop: 12, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
