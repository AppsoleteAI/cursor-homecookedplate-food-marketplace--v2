import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { calculateFees } from '@/backend/lib/fees';

function formatMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

export default function PlatemakerEarningsScreen() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [saleAmountText, setSaleAmountText] = useState('100.00');

  const saleAmount = useMemo(() => {
    const parsed = Number(String(saleAmountText).replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [saleAmountText]);

  const fees = useMemo(() => calculateFees(saleAmount, 10, 10), [saleAmount]);

  return (
    <View style={styles.container}>
      <View style={styles.staticHeader}>
        <LinearGradient
          colors={monoGradients.green}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height ?? 0;
            if (h !== headerHeight) setHeaderHeight(h);
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Platemaker Earnings</Text>
            <Text style={styles.subtitle}>Transparent fee breakdown (Double 10)</Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Gross Sale (base amount)</Text>
          <TextInput
            value={saleAmountText}
            onChangeText={setSaleAmountText}
            keyboardType="decimal-pad"
            placeholder="100.00"
            placeholderTextColor={Colors.gray[400]}
            style={styles.input}
            testID="earnings-sale-amount"
          />
          <Text style={styles.cardHint}>Uses `backend/lib/fees.ts` as the source of truth.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Gross Sale</Text>
            <Text style={styles.rowValue}>{formatMoney(fees.baseAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Platetaker Fee (10% on top)</Text>
            <Text style={styles.rowValue}>-{formatMoney(fees.buyerFee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Platemaker Fee (10% deducted)</Text>
            <Text style={styles.rowValue}>-{formatMoney(fees.sellerFee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Platform Revenue (20% total)</Text>
            <Text style={styles.rowValue}>{formatMoney(fees.appTotalRevenue)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, styles.bold]}>Your Net Payout</Text>
            <Text style={[styles.rowValue, styles.bold]}>{formatMoney(fees.sellerPayout)}</Text>
          </View>
          <Text style={styles.cardHint}>
            Note: Stripe processing is not included on this screen (platform + buyer/seller fees only).
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  staticHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: { paddingBottom: 100 },
  header: { paddingTop: 16, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.white, opacity: 0.9 },
  card: {
    marginHorizontal: 24,
    marginTop: 12,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  cardLabel: { fontSize: 14, color: Colors.gray[700], fontWeight: '700', marginBottom: 10 },
  cardHint: { fontSize: 12, color: Colors.gray[600], marginTop: 10, lineHeight: 18 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 14, color: Colors.gray[700], fontWeight: '600' },
  rowValue: { fontSize: 14, color: Colors.gray[900], fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.gray[200], marginVertical: 10 },
  bold: { fontWeight: '800' },
});

