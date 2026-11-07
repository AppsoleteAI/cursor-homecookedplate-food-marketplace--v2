import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenBack } from '@/components/BackCircle';
import { trpc } from '@/lib/trpc';

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function FinalReceiptScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const insets = useSafeAreaInsets();
  const receipt = trpc.orders.finalReceipt.useQuery(
    { orderId: String(orderId || '') },
    { enabled: Boolean(orderId) },
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: 'Final receipt', headerShown: false }} />
      <View style={styles.backRow}>
        <ScreenBack fallback="/(tabs)/orders" testID="final-receipt-back" />
      </View>
      {receipt.isLoading ? <ActivityIndicator color={Colors.gray[700]} /> : null}
      {receipt.error ? <Text style={styles.error}>{receipt.error.message}</Text> : null}
      {receipt.data ? (
        <View style={styles.card} testID="final-receipt-card">
          {receipt.data.lines.length > 1 ? receipt.data.lines.map((line) => (
            <View key={`${line.areaLabel || ''}-${line.mealName}`} style={styles.item}>
              {line.areaLabel ? <Text style={styles.area}>{line.areaLabel}</Text> : null}
              <Text style={styles.title}>{line.mealName}</Text>
              <Text style={styles.line}>Quantity {line.quantity}</Text>
              <Text style={styles.line}>Base {money(line.baseAmount)}</Text>
              <Text style={styles.line}>Cook receives {money(line.sellerPayout)}</Text>
            </View>
          )) : (
            <>
              <Text style={styles.title}>{receipt.data.mealName}</Text>
              <Text style={styles.line}>Quantity {receipt.data.quantity}</Text>
            </>
          )}
          <Text style={styles.line}>Base {money(receipt.data.baseAmount)}</Text>
          <Text style={styles.line}>Buyer fee {money(receipt.data.buyerFee)}</Text>
          <Text style={styles.line}>Seller fee {money(receipt.data.sellerFee)}</Text>
          <Text style={styles.line}>PlateTaker pays {money(receipt.data.buyerPays)}</Text>
          <Text style={styles.line}>PlateMaker receives {money(receipt.data.sellerPayout)}</Text>
          <Text style={styles.viewer} testID={`final-receipt-${receipt.data.role}`}>
            {receipt.data.viewerLabel} {money(receipt.data.viewerAmount)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 16 },
  backRow: { paddingTop: 16, marginBottom: 16 },
  card: { gap: 8 },
  item: { gap: 4, marginBottom: 8 },
  area: { fontSize: 13, fontWeight: '700', color: Colors.gray[500] },
  title: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
  line: { fontSize: 15, color: Colors.gray[700] },
  viewer: { marginTop: 8, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  error: { color: Colors.error, fontWeight: '700' },
});
