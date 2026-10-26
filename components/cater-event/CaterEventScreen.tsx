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
import { useCaterEvent } from '@/hooks/cater-event-store';
import { useAuth } from '@/hooks/auth-context';

type CaterEventScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
  showOrder?: boolean;
  showBack?: boolean;
  backHref?: Href;
};

export function CaterEventScreen({ title, subtitle, children, testID, showOrder = true, showBack = true, backHref }: CaterEventScreenProps) {
  const replace = backHref != null;
  const popLeave = useLeaveScreen('/cater-event-deliver', showBack && !replace);
  const swapLeave = useReplaceBack(backHref ?? '/cater-event-deliver', showBack && replace);
  const leave = replace ? swapLeave : popLeave;
  const { packageCount } = useCaterEvent();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <LinearGradient colors={monoGradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        {showBack ? <BackCircle tone="light" onPress={leave} gapBelow={false} testID="cater-back" /> : <View style={styles.backGap} />}
        <View style={styles.headerText}>
          <Text style={styles.kicker}>CaterEventDeliver</Text>
          <Text style={styles.title}>{titleCase(title)}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showOrder ? (
          <GlassIconButton onPress={() => router.push('/cater-event-deliver/basket' as Href)} accessibilityLabel="Open catering order" testID="cater-order-button" tint={CHROME_FROST_TINT}>
            <Ionicons name="people-outline" size={20} color={Colors.white} />
            {packageCount > 0 ? (
              <GlassBadge style={styles.badge}>
                <Text style={styles.badgeText}>{packageCount}</Text>
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
            ? 'CaterEventDeliver does not inspect kitchens, issue catering licenses, or book a driver. The catering company drops off the food and sets it up. Confirm the commercial license and the fee for the city where the food is prepared.'
            : 'The catering company drops off the food and sets it up.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F3FF' },
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
  kicker: { color: '#EDE9FE', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#EDE9FE', fontSize: 14, marginTop: 4 },
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
  badgeText: { color: '#5B21B6', fontSize: 11, fontWeight: '700' },
  badgeSpacer: { width: 24 },
  backGap: { width: 36, height: 36 },
  body: { padding: 16, paddingBottom: 32 },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
