import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { getCompany, getPackage } from '@/constants/cater-event-deliver';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { calculateOrderSplit } from '@/lib/fees';

export default function CaterPackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const packageId = Array.isArray(id) ? id[0] : id;
  const { listings, accepting, license, addPackage } = useCaterEvent();
  const catalog = packageId ? getPackage(packageId) : undefined;
  const listing = listings.find((item) => item.id === packageId);
  const minimum = catalog?.minimumHeadcount ?? listing?.minimumHeadcount ?? 8;
  const [headcount, setHeadcount] = useState(minimum);
  const [notice, setNotice] = useState<string | null>(null);

  if (!catalog && !listing) {
    return (
      <CaterEventScreen title="Package" testID="cater-package-missing">
        <Text>That package is not listed.</Text>
      </CaterEventScreen>
    );
  }

  const company = catalog ? getCompany(catalog.companyId) : undefined;
  const open = catalog ? Boolean(company?.accepting) : accepting;
  const name = catalog?.name ?? listing!.name;
  const pricePerPerson = catalog?.pricePerPerson ?? listing!.pricePerPerson;
  const summary = catalog?.summary ?? listing!.summary;
  const ingredients = catalog?.ingredients ?? listing!.ingredients;
  const allergens = catalog?.allergens ?? listing!.allergens;
  const companyId = catalog?.companyId ?? 'owner-company';
  const companyName = company?.name ?? license?.companyName ?? 'Your company';
  const people = Math.max(minimum, headcount);
  const baseAmount = pricePerPerson * people;
  const split = calculateOrderSplit(baseAmount);

  return (
    <CaterEventScreen title={name} subtitle={companyName} testID="cater-package">
      {catalog ? <Image source={{ uri: catalog.image }} style={styles.hero} /> : null}
      <Text style={styles.price}>${pricePerPerson.toFixed(2)} per person</Text>
      <Text style={[styles.status, open ? styles.open : styles.closed]}>{open ? 'Accepting this drop-off' : 'Not accepting orders'}</Text>
      <Text style={styles.body}>{summary}</Text>
      {company ? (
        <GlassPressable onPress={() => router.push(`/cater-event-deliver/company/${company.id}` as Href)}>
          <Text style={styles.link}>Back to {titleCase(company.name)}</Text>
        </GlassPressable>
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.label}>Ingredients</Text>
        <Text style={styles.body}>{ingredients}</Text>
        <Text style={styles.label}>Allergens</Text>
        <Text style={styles.body}>{allergens}</Text>
        <Text style={styles.body}>Minimum {minimum} people. Food is ${baseAmount.toFixed(2)} before the service fee. You pay ${split.totalCaptured.toFixed(2)}.</Text>
        <Text style={styles.body}>The catering company drops this off and sets it up. It is not a cooked plate and not a farm good.</Text>
      </View>
      <View style={styles.qtyRow}>
        <GlassPressable style={styles.qty} onPress={() => setHeadcount((value) => Math.max(minimum, value - 1))}>
          <Text style={styles.qtyText}>−</Text>
        </GlassPressable>
        <Text style={styles.qtyValue}>{people} people</Text>
        <GlassPressable style={styles.qty} onPress={() => setHeadcount((value) => Math.min(500, value + 1))}>
          <Text style={styles.qtyText}>+</Text>
        </GlassPressable>
      </View>
      <GlassPressable
        style={[styles.add, !open && styles.addOff]}
        disabled={!open}
        testID="add-cater-package"
        onPress={() => {
          if (!packageId) return;
          const result = addPackage(packageId, companyId, people);
          setNotice(result.ok ? 'Added to the group order.' : result.reason);
        }}
      >
        <Text style={styles.addText}>{open ? 'Add to the Group Order' : 'Not Accepting Orders'}</Text>
      </GlassPressable>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {notice === 'Added to the group order.' ? (
        <GlassPressable onPress={() => router.push('/cater-event-deliver/basket' as Href)}>
          <Text style={styles.link}>Go to the Group Order</Text>
        </GlassPressable>
      ) : null}
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  hero: { ...glassSurface, width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.gray[200]  },
  price: { marginTop: 12, fontSize: 22, fontWeight: '700', color: '#6D28D9' },
  status: { marginTop: 4, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9F1239' },
  body: { marginTop: 8, color: Colors.gray[700], lineHeight: 20 },
  link: { marginTop: 10, color: '#6D28D9', fontWeight: '700' },
  panel: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  label: { marginTop: 8, fontWeight: '700', color: Colors.gray[800] },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  qty: { ...glassSurface, width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center'  },
  qtyText: { fontSize: 22, color: Colors.gray[900] },
  qtyValue: { fontSize: 18, fontWeight: '700' },
  add: { ...glassSurface, marginTop: 16, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addOff: { backgroundColor: Colors.gray[400] },
  addText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  notice: { marginTop: 10, color: Colors.gray[800], lineHeight: 20 },
});
