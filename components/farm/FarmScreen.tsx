import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router , type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, inAppHeaderBand, monoGradients, pagePastel } from '@/constants/colors';
import { GlassBadge, GlassIconButton, glassSurface } from '@/components/glass-surface';
import { titleCase } from '@/lib/title-case';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { useAuth } from '@/hooks/auth-context';

type FarmScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
  showBasket?: boolean;
};

export function FarmScreen({ title, subtitle, children, footer, testID, showBasket = true }: FarmScreenProps) {
  const { itemCount } = useFarmBasket();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <LinearGradient colors={monoGradients.green} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <GlassIconButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/farm-grown-basket' as Href))}
          accessibilityLabel="Back"
          testID="farm-back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.white} />
        </GlassIconButton>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>FarmGrownBasket</Text>
          <Text style={styles.title}>{titleCase(title)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showBasket ? (
          <GlassIconButton onPress={() => router.push('/farm-grown-basket/basket' as Href)} accessibilityLabel="Open farm basket" testID="farm-basket-button">
            <Ionicons name="basket-outline" size={20} color={Colors.white} />
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
            ? 'FarmGrownBasket does not inspect kitchens, issue permits, or confirm that a listing meets your cottage, food-freedom, or farm-stand law. Confirm the statute, the test, and the fee with your state and county before you sell.'
            : 'Ingredients are listed on each item. Pick the food up from the farm or the place named on your order.'}
        </Text>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pagePastel.green },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: inAppHeaderBand.paddingTop,
    paddingBottom: inAppHeaderBand.paddingBottom,
    minHeight: inAppHeaderBand.minHeight,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  headerText: { flex: 1 },
  kicker: { color: '#DCFCE7', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#ECFDF5', fontSize: 14, marginTop: 4 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.gradient.yellow,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: Colors.gray[900], fontSize: 11, fontWeight: '700' },
  badgeSpacer: { width: 24 },
  body: { padding: 16, paddingBottom: 32 },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
});
