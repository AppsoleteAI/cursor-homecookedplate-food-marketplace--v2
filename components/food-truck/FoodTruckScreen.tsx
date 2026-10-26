import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackCircle } from '@/components/BackCircle';
import { useLeaveScreen, useReplaceBack } from '@/hooks/use-leave-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, inAppHeaderBand, monoGradients } from '@/constants/colors';
import { CHROME_FROST_TINT } from '@/lib/chrome-activity';
import { GlassBadge, GlassIconButton, glassSurface } from '@/components/glass-surface';
import { titleCase } from '@/lib/title-case';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { useAuth } from '@/hooks/auth-context';

type FoodTruckScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
  showBasket?: boolean;
  showBack?: boolean;
  backHref?: Href;
};

export function FoodTruckScreen({ title, subtitle, children, testID, showBasket = true, showBack = true, backHref }: FoodTruckScreenProps) {
  const replace = backHref != null;
  const popLeave = useLeaveScreen('/food-truck-popup', showBack && !replace);
  const swapLeave = useReplaceBack(backHref ?? '/food-truck-popup', showBack && replace);
  const leave = replace ? swapLeave : popLeave;
  const { itemCount } = useFoodTruck();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <LinearGradient colors={monoGradients.orange} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        {showBack ? <BackCircle tone="light" onPress={leave} gapBelow={false} testID="truck-back" /> : <View style={styles.backGap} />}
        <View style={styles.headerText}>
          <Text style={styles.kicker}>FoodTruckPopup</Text>
          <Text style={styles.title}>{titleCase(title)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showBasket ? (
          <GlassIconButton onPress={() => router.push('/food-truck-popup/basket' as Href)} accessibilityLabel="Open truck basket" testID="truck-basket-button" tint={CHROME_FROST_TINT}>
            <Ionicons name="receipt-outline" size={20} color={Colors.white} />
            {itemCount > 0 ? (
              <GlassBadge style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </GlassBadge>
            ) : null}
          </GlassIconButton>
        ) : (
          <View style={styles.badgeSpacer} />
        )}
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
        <Text style={styles.legal}>
          {isMaker
            ? 'FoodTruckPopup does not inspect trucks, issue mobile-unit permits, or confirm a commissary agreement. Pickup is at the service window. Confirm the health rule and the fee for the city where the window is open.'
            : 'Order ahead, then pick the food up at the service window.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF7ED' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: inAppHeaderBand.paddingHorizontal,
    paddingBottom: inAppHeaderBand.paddingBottom,
    minHeight: inAppHeaderBand.minHeight,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  headerText: { flex: 1 },
  kicker: { color: '#FFEDD5', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#FFEDD5', fontSize: 14, marginTop: 4 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.white,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#9A3412', fontSize: 11, fontWeight: '700' },
  badgeSpacer: { width: 24 },
  backGap: { width: 36, height: 36 },
  body: { padding: 16, paddingBottom: 32 },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
