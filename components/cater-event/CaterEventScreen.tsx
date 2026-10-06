import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { useAuth } from '@/hooks/auth-context';

type CaterEventScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
  showOrder?: boolean;
};

export function CaterEventScreen({ title, subtitle, children, testID, showOrder = true }: CaterEventScreenProps) {
  const { packageCount } = useCaterEvent();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <LinearGradient colors={monoGradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/cater-event-deliver' as Href))}
          accessibilityLabel="Back"
          testID="cater-back"
        >
          <Ionicons name="chevron-back" size={26} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>CaterEventDeliver</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showOrder ? (
          <TouchableOpacity onPress={() => router.push('/cater-event-deliver/basket' as Href)} accessibilityLabel="Open catering order" testID="cater-order-button">
            <Ionicons name="people-outline" size={24} color={Colors.white} />
            {packageCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{packageCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
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
    paddingTop: 8,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  body: { padding: 16, paddingBottom: 32 },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
