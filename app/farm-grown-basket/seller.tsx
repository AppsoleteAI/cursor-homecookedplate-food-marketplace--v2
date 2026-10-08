import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router , type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { evaluateListing, stateName, trackLabel } from '@/lib/cottage-food';
import { calculateOrderSplit } from '@/lib/fees';

export default function FarmSellerScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { orders, listings, compliance } = useFarmBasket();
  const baseAmount = orders.reduce((sum, order) => sum + order.baseAmount, 0);
  const split = calculateOrderSplit(baseAmount);
  const complianceCheck = evaluateListing(compliance);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  return (
    <FarmScreen title="Seller stand" subtitle="Farm payouts stay separate from plate earnings." testID="farm-seller">
      <View style={styles.card}>
        <Text style={styles.label}>Farm goods sold</Text>
        <Text style={styles.value}>${baseAmount.toFixed(2)}</Text>
        <Text style={styles.meta}>Producer payout ${split.sellerPayout.toFixed(2)} after the platform fee</Text>
        <Text style={styles.meta}>{orders.length} farm order{orders.length === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Local compliance</Text>
        {compliance ? (
          <Text style={styles.meta}>
            {compliance.farmName} · {compliance.county} County, {stateName(compliance.stateCode)} · {trackLabel(compliance.track)}
          </Text>
        ) : (
          <Text style={styles.meta}>No state record yet. Listing stays closed until you save one.</Text>
        )}
        {!complianceCheck.ok ? <Text style={styles.block}>{complianceCheck.blocks[0]}</Text> : <Text style={styles.ok}>Record is complete for this product type.</Text>}
      </View>
      <GlassPressable style={styles.button} onPress={() => router.push('/farm-grown-basket/cottage-law' as Href)} testID="seller-cottage-law">
        <Text style={styles.buttonText}>State, Test, and Permit Fee</Text>
      </GlassPressable>
      <GlassPressable style={styles.secondary} onPress={() => router.push('/farm-grown-basket/list' as Href)} testID="seller-list">
        <Text style={styles.secondaryText}>List a Farm Good</Text>
      </GlassPressable>
      {user?.role === 'platemaker' ? (
        <GlassPressable style={styles.secondary} onPress={() => router.push('/(tabs)/dashboard')}>
          <Text style={styles.secondaryText}>Plate Maker Dashboard</Text>
        </GlassPressable>
      ) : null}
      <Text style={styles.section}>Your listings</Text>
      {listings.length === 0 ? <Text style={styles.meta}>Nothing listed yet.</Text> : null}
      {listings.map((listing) => (
        <GlassPressable key={listing.id} style={styles.card} onPress={() => router.push(`/farm-grown-basket/product/${listing.id}` as Href)}>
          <Text style={styles.valueSmall}>{titleCase(listing.name)}</Text>
          <Text style={styles.meta}>${listing.price.toFixed(2)} / {listing.unit} · {trackLabel(listing.track)}</Text>
        </GlassPressable>
      ))}
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10  },
  label: { color: Colors.gray[500], fontSize: 13 },
  value: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  valueSmall: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '600' },
  button: { ...glassSurface, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8  },
  secondaryText: { color: '#166534', fontWeight: '700' },
  section: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
});
