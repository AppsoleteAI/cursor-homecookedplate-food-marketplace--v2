import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { Colors } from '@/constants/colors';
import { getCompany, getPackage } from '@/constants/cater-event-deliver';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { calculateOrderSplit } from '@/lib/fees';

export default function CaterBasketScreen() {
  const { items, listings, license, setHeadcount, clearItems } = useCaterEvent();
  const lines = useMemo(() => {
    return items.flatMap((item) => {
      const catalog = getPackage(item.packageId);
      const listing = listings.find((entry) => entry.id === item.packageId);
      const name = catalog?.name ?? listing?.name;
      const pricePerPerson = catalog?.pricePerPerson ?? listing?.pricePerPerson;
      const minimum = catalog?.minimumHeadcount ?? listing?.minimumHeadcount ?? 1;
      if (!name || pricePerPerson === undefined) return [];
      return [{ id: item.packageId, companyId: item.companyId, name, pricePerPerson, minimum, headcount: item.headcount }];
    });
  }, [items, listings]);

  const companyId = lines[0]?.companyId;
  const companyName = companyId === 'owner-company' ? license?.companyName ?? 'Your company' : getCompany(companyId ?? '')?.name ?? 'Catering company';
  const baseAmount = lines.reduce((sum, line) => sum + line.pricePerPerson * line.headcount, 0);
  const split = calculateOrderSplit(baseAmount);

  return (
    <CaterEventScreen title="Group order" subtitle="One company. Price is per person." showOrder={false} testID="cater-basket">
      {lines.length === 0 ? (
        <View>
          <Text style={styles.empty}>No catering order yet.</Text>
          <GlassPressable onPress={() => router.push('/cater-event-deliver/board' as Href)}>
            <Text style={styles.link}>See Which Companies Are Accepting</Text>
          </GlassPressable>
        </View>
      ) : (
        <View>
          <Text style={styles.company}>{companyName}</Text>
          {lines.map((line) => (
            <View key={line.id} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{titleCase(line.name)}</Text>
                <Text style={styles.meta}>${line.pricePerPerson.toFixed(2)} per person · minimum {line.minimum}</Text>
                <Text style={styles.meta}>Food ${(line.pricePerPerson * line.headcount).toFixed(2)}</Text>
              </View>
              <View style={styles.qty}>
                <GlassPressable onPress={() => setHeadcount(line.id, line.headcount <= line.minimum ? 0 : line.headcount - 1)}>
                  <Text style={styles.qtyText}>−</Text>
                </GlassPressable>
                <Text style={styles.qtyValue}>{line.headcount}</Text>
                <GlassPressable onPress={() => setHeadcount(line.id, Math.min(500, line.headcount + 1))}>
                  <Text style={styles.qtyText}>+</Text>
                </GlassPressable>
              </View>
            </View>
          ))}
          <GlassPressable onPress={clearItems}>
            <Text style={styles.link}>Clear This Company</Text>
          </GlassPressable>
        </View>
      )}
      <View style={styles.totals}>
        <Text style={styles.totalLine}>Food ${baseAmount.toFixed(2)}</Text>
        <Text style={styles.totalLine}>Service fee ${(split.totalCaptured - baseAmount).toFixed(2)}</Text>
        <Text style={styles.totalStrong}>You pay ${split.totalCaptured.toFixed(2)}</Text>
      </View>
      <GlassPressable
        style={[styles.button, lines.length === 0 && styles.buttonOff]}
        disabled={lines.length === 0}
        onPress={() => router.push('/cater-event-deliver/checkout' as Href)}
        testID="cater-basket-checkout"
      >
        <Text style={styles.buttonText}>Catering Checkout</Text>
      </GlassPressable>
      <GlassPressable onPress={() => router.push('/(tabs)/cart')}>
        <Text style={styles.link}>Cooked-plate Cart</Text>
      </GlassPressable>
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  empty: { color: Colors.gray[700], fontSize: 16 },
  company: { fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  copy: { flex: 1 },
  name: { fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[600], marginTop: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 22, paddingHorizontal: 4 },
  qtyValue: { fontWeight: '700', minWidth: 16, textAlign: 'center' },
  totals: { marginTop: 8, backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  totalLine: { color: Colors.gray[700], marginBottom: 4 },
  totalStrong: { marginTop: 4, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  button: { ...glassSurface, marginTop: 14, backgroundColor: '#6D28D9', borderRadius: 14, paddingVertical: 14, alignItems: 'center'  },
  buttonOff: { backgroundColor: Colors.gray[400] },
  buttonText: { color: Colors.white, fontWeight: '700' },
  link: { marginTop: 12, color: '#6D28D9', fontWeight: '700' },
});
