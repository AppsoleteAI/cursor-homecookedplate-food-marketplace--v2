import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Redirect, router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useSitDown } from '@/hooks/sit-down-store';
import { evaluateSitDownLicense } from '@/lib/sit-down-license';
import { stateName } from '@/lib/cottage-food';
import { calculateOrderSplit } from '@/lib/fees';

export default function SitSellerScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { orders, listings, license, ownerOpen, setOwnerOpen } = useSitDown();
  const baseAmount = orders.reduce((sum, order) => sum + order.baseAmount, 0);
  const split = calculateOrderSplit(baseAmount);
  const licenseCheck = evaluateSitDownLicense(license);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SitDownScreen title="Shop owner" subtitle="Restaurant payouts stay separate from plate earnings." testID="sit-seller">
      <View style={styles.card}>
        <Text style={styles.label}>Restaurant food sold</Text>
        <Text style={styles.value}>${baseAmount.toFixed(2)}</Text>
        <Text style={styles.meta}>Restaurant payout ${split.sellerPayout.toFixed(2)} after the platform fee</Text>
        <Text style={styles.meta}>{orders.length} restaurant order{orders.length === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.activeRow}>
          <Text style={styles.label}>Dining room is {ownerOpen ? 'open' : 'closed'}</Text>
          <Switch value={ownerOpen} onValueChange={setOwnerOpen} trackColor={{ true: '#92400E', false: Colors.gray[300] }} />
        </View>
        <Text style={styles.meta}>Open puts your menu on the places list. A closed shop can still be followed, and it cannot take a table or a takeout order.</Text>
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
      <TouchableOpacity style={styles.button} onPress={() => router.push('/sit-down-delicious/license' as Href)} testID="seller-license">
        <Text style={styles.buttonText}>License, address, and fee</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => router.push('/sit-down-delicious/list' as Href)} testID="seller-list">
        <Text style={styles.secondaryText}>Add a menu item</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => router.push('/kitchen-rules' as Href)}>
        <Text style={styles.secondaryText}>Kitchen rules</Text>
      </TouchableOpacity>
      {user?.role === 'platemaker' ? (
        <TouchableOpacity style={styles.secondary} onPress={() => router.push('/(tabs)/dashboard')}>
          <Text style={styles.secondaryText}>Plate maker dashboard</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.section}>Your menu</Text>
      {listings.length === 0 ? <Text style={styles.meta}>Nothing listed yet.</Text> : null}
      {listings.map((item) => (
        <TouchableOpacity key={item.id} style={styles.card} onPress={() => router.push(`/sit-down-delicious/item/${item.id}` as Href)}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.meta}>${item.price.toFixed(2)} · {ownerOpen ? 'On the list' : 'Hidden while the shop is closed'}</Text>
        </TouchableOpacity>
      ))}
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  label: { color: Colors.gray[500], fontSize: 13 },
  value: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  itemName: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, lineHeight: 20 },
  block: { color: '#9A3412', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  section: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  button: { backgroundColor: '#92400E', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  secondaryText: { color: '#92400E', fontWeight: '700' },
});
