import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BackCircle } from '@/components/BackCircle';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, inAppHeaderBand, monoGradients } from '@/constants/colors';
import { GlassBadge, GlassIconButton, glassSurface } from '@/components/glass-surface';
import { titleCase } from '@/lib/title-case';
import { useMealPrep } from '@/hooks/meal-prep-store';

type MealPrepScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
  showWeek?: boolean;
  showBack?: boolean;
};

export function MealPrepScreen({ title, subtitle, children, testID, showWeek = true, showBack = true }: MealPrepScreenProps) {
  const leave = useLeaveScreen('/meal-prep-go', showBack);
  const { portionCount } = useMealPrep();

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <LinearGradient colors={monoGradients.blue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        {showBack ? <BackCircle tone="light" onPress={leave} gapBelow={false} testID="prep-back" /> : <View style={styles.backGap} />}
        <View style={styles.headerText}>
          <Text style={styles.kicker}>MealPrepGo</Text>
          <Text style={styles.title}>{titleCase(title)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showWeek ? (
          <GlassIconButton onPress={() => router.push('/meal-prep-go/week' as Href)} accessibilityLabel="Open the week" testID="prep-week-button">
            <Ionicons name="calendar-outline" size={20} color={Colors.white} />
            {portionCount > 0 ? (
              <GlassBadge style={styles.badge}>
                <Text style={styles.badgeText}>{portionCount}</Text>
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
          A MealPrepGo week is heat-and-eat meals, cook-at-home kits, or a mix, from one local cook. Add-ons ride with that week. Pickup or a household drop-off. This is separate from a single plate.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ECFEFF' },
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
  kicker: { color: '#CFFAFE', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#CFFAFE', fontSize: 14, marginTop: 4 },
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
  badgeText: { color: '#0E7490', fontSize: 11, fontWeight: '700' },
  badgeSpacer: { width: 24 },
  backGap: { width: 36, height: 36 },
  body: { padding: 16, paddingBottom: 32 },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
