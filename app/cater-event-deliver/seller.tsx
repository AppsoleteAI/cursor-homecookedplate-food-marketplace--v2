import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { evaluateCaterLicense } from '@/lib/cater-event-license';
import { stateName } from '@/lib/cottage-food';
import { calculateOrderSplit } from '@/lib/fees';

export default function CaterSellerScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { orders, listings, license, accepting, setAccepting } = useCaterEvent();
  const baseAmount = orders.reduce((sum, order) => sum + order.baseAmount, 0);
  const split = calculateOrderSplit(baseAmount);
  const licenseCheck = evaluateCaterLicense(license);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  return (
    <CaterEventScreen title="Catering company" subtitle="Drop-off payouts stay separate from plate earnings." testID="cater-seller">
      <View style={styles.card}>
        <Text style={styles.label}>Catering food sold</Text>
        <Text style={styles.value}>${baseAmount.toFixed(2)}</Text>
        <Text style={styles.meta}>Caterer payout ${split.sellerPayout.toFixed(2)} after the platform fee</Text>
        <Text style={styles.meta}>{orders.length} group order{orders.length === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>{accepting ? 'Accepting drop-offs' : 'Not accepting orders'}</Text>
          <Switch value={accepting} onValueChange={setAccepting} trackColor={{ true: '#6D28D9', false: Colors.gray[300] }} />
        </View>
        <Text style={styles.meta}>Accepting puts your packages on the board. A closed company can still show a calendar, and it cannot take an order.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Catering license</Text>
        {license ? (
          <Text style={styles.meta}>{license.companyName} · {license.city}, {stateName(license.stateCode)}</Text>
        ) : (
          <Text style={styles.meta}>No license record yet. Packages stay closed until you save one.</Text>
        )}
        {!licenseCheck.ok ? <Text style={styles.block}>{licenseCheck.blocks[0]}</Text> : <Text style={styles.ok}>License record is complete enough to list.</Text>}
      </View>
      <GlassPressable style={styles.button} onPress={() => router.push('/cater-event-deliver/license' as Href)} testID="seller-license">
        <Text style={styles.buttonText}>License, Kitchen, and Fee</Text>
      </GlassPressable>
      <GlassPressable style={styles.secondary} onPress={() => router.push('/cater-event-deliver/list' as Href)} testID="seller-list">
        <Text style={styles.secondaryText}>Add a Per-person Package</Text>
      </GlassPressable>
      <GlassPressable style={styles.secondary} onPress={() => router.push('/cater-event-deliver/orders' as Href)}>
        <Text style={styles.secondaryText}>Orders and Organization Spend</Text>
      </GlassPressable>
      <GlassPressable style={styles.secondary} onPress={() => router.push('/kitchen-rules' as Href)}>
        <Text style={styles.secondaryText}>Kitchen Rules</Text>
      </GlassPressable>
      {user?.role === 'platemaker' ? (
        <GlassPressable style={styles.secondary} onPress={() => router.push('/(tabs)/dashboard')}>
          <Text style={styles.secondaryText}>Plate Maker Dashboard</Text>
        </GlassPressable>
      ) : null}
      <Text style={styles.section}>Your packages</Text>
      {listings.length === 0 ? <Text style={styles.meta}>Nothing listed yet.</Text> : null}
      {listings.map((item) => (
        <GlassPressable key={item.id} style={styles.card} onPress={() => router.push(`/cater-event-deliver/package/${item.id}` as Href)}>
          <Text style={styles.itemName}>{titleCase(item.name)}</Text>
          <Text style={styles.meta}>${item.pricePerPerson.toFixed(2)} per person · minimum {item.minimumHeadcount} · {accepting ? 'On the board' : 'Hidden while you are closed'}</Text>
        </GlassPressable>
      ))}
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10  },
  label: { color: Colors.gray[500], fontSize: 13 },
  activeLabel: { color: Colors.gray[800], fontSize: 15, fontWeight: '700', flex: 1 },
  value: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  itemName: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4, lineHeight: 20 },
  block: { color: '#9F1239', marginTop: 8, lineHeight: 20 },
  ok: { color: '#166534', marginTop: 8, fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  button: { ...glassSurface, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8  },
  secondaryText: { color: '#6D28D9', fontWeight: '700' },
  section: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
});
