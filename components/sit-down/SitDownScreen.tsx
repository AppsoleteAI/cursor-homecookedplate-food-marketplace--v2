import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { useSitDown } from '@/hooks/sit-down-store';
import { useAuth } from '@/hooks/auth-context';

type SitDownScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  testID?: string;
  showBasket?: boolean;
};

export function SitDownScreen({ title, subtitle, children, testID, showBasket = true }: SitDownScreenProps) {
  const { itemCount } = useSitDown();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <LinearGradient colors={monoGradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/sit-down-delicious' as Href))}
          accessibilityLabel="Back"
          testID="sit-back"
        >
          <Ionicons name="chevron-back" size={26} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>SitDownDelicious</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showBasket ? (
          <TouchableOpacity onPress={() => router.push('/sit-down-delicious/basket' as Href)} accessibilityLabel="Open restaurant order" testID="sit-basket-button">
            <Ionicons name="cafe-outline" size={24} color={Colors.white} />
            {itemCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
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
            ? 'SitDownDelicious does not inspect restaurants or issue retail food licenses. Chains and franchises are not listed. Confirm the health permit and the fee for the street address before you sell.'
            : 'Sit at a table or pick the food up at the counter. Chains are not listed.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFBEB' },
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
  kicker: { color: '#FEF3C7', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#FEF3C7', fontSize: 14, marginTop: 4 },
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
  badgeText: { color: '#92400E', fontSize: 11, fontWeight: '700' },
  badgeSpacer: { width: 24 },
  body: { padding: 16, paddingBottom: 32 },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.gray[500] },
});
