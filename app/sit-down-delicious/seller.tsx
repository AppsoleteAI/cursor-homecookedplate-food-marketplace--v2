import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { PricedItemCard } from '@/components/PricedItemCard';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useSitDown } from '@/hooks/sit-down-store';
import { evaluateSitDownLicense } from '@/lib/sit-down-license';
import { stateName } from '@/lib/cottage-food';
import { calculateOrderSplit } from '@/lib/fees';
import { AreaStoreSwitch } from '@/components/AreaStoreSwitch';

export default function SitSellerScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { orders, listings, license, ownerOpen, setOwnerOpen } = useSitDown();
  const baseAmount = orders.reduce((sum, order) => sum + order.baseAmount, 0);
  const split = calculateOrderSplit(baseAmount);
  const licenseCheck = evaluateSitDownLicense(license);
  const [ghostOpen, setGhostOpen] = useState(false);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  return (
    <SitDownScreen title="Shop owner" subtitle="Restaurant payouts stay separate from plate earnings." testID="sit-seller">
      {license?.image ? <Image source={{ uri: license.image }} style={styles.placePhoto} /> : null}
      <View style={styles.card}>
        <Text style={styles.label}>Restaurant food sold</Text>
        <Text style={styles.value}>${baseAmount.toFixed(2)}</Text>
        <Text style={styles.meta}>Restaurant payout ${split.sellerPayout.toFixed(2)} after the platform fee</Text>
        <Text style={styles.meta}>{orders.length} restaurant order{orders.length === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.activeRow}>
          <Text style={styles.label}>Dining room is {ownerOpen ? 'open' : 'closed'}</Text>
          <AreaStoreSwitch
            area="sit_down"
            value={ownerOpen}
            onValueChange={setOwnerOpen}
            disabled={!licenseCheck.ok}
            trackColor={{ true: '#92400E', false: Colors.gray[300] }}
          />
        </View>
        <Text style={styles.meta}>Open puts your menu on the places list. A closed shop can still be followed, and it cannot take a table or a takeout order.</Text>
        <View style={styles.activeRow}>
          <Text style={styles.label}>Ghost kitchen is {ghostOpen ? 'open' : 'closed'}</Text>
          <AreaStoreSwitch
            area="ghost_kitchen"
            value={ghostOpen}
            onValueChange={setGhostOpen}
            disabled={!licenseCheck.ok}
            trackColor={{ true: '#92400E', false: Colors.gray[300] }}
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Retail food license</Text>
        {license ? (
          <Text style={styles.meta}>{license.placeName} · {license.street}, {license.city}, {stateName(license.stateCode)}</Text>
        ) : (
          <Text style={styles.meta}>No license record yet. The menu stays closed until you save one.</Text>
        )}
        {!licenseCheck.ok ? <Text style={styles.block}>{licenseCheck.blocks[0]}</Text> : <Text style={styles.ok}>License record is complete enough to list.</Text>}
      </View>
      <GlassPressable style={styles.button} onPress={() => router.push('/sit-down-delicious/license' as Href)} testID="seller-license">
        <Text style={styles.buttonText}>License, Address, and Fee</Text>
      </GlassPressable>
      <GlassPressable style={styles.secondary} onPress={() => router.push('/sit-down-delicious/list' as Href)} testID="seller-list">
        <Text style={styles.secondaryText}>Add a Menu Item</Text>
      </GlassPressable>
      <GlassPressable style={styles.secondary} onPress={() => router.push('/kitchen-rules' as Href)}>
        <Text style={styles.secondaryText}>Kitchen Rules</Text>
      </GlassPressable>
      {user?.role === 'platemaker' ? (
        <GlassPressable style={styles.secondary} onPress={() => router.push('/(tabs)/dashboard')}>
          <Text style={styles.secondaryText}>Plate Maker Dashboard</Text>
        </GlassPressable>
      ) : null}
      <Text style={styles.section}>Your menu</Text>
      {listings.length === 0 ? <Text style={styles.meta}>Nothing listed yet.</Text> : null}
      {listings.map((item) => (
        <PricedItemCard
          key={item.id}
          image={item.image}
          title={titleCase(item.name)}
          meta={ownerOpen ? 'On the list' : 'Hidden while the shop is closed'}
          price={`$${item.price.toFixed(2)}`}
          priceColor="#92400E"
          onPress={() => router.push(`/sit-down-delicious/item/${item.id}` as Href)}
        />
      ))}
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10  },
  label: { color: Colors.gray[500], fontSize: 13 },
  value: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  itemName: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  section: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  placePhoto: { width: '100%', height: 160, borderRadius: 16, marginBottom: 10, backgroundColor: Colors.gray[200] },
  button: { ...glassSurface, backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8  },
  secondaryText: { color: '#92400E', fontWeight: '700' },
});
