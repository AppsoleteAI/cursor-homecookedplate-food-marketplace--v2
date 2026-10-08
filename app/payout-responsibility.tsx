import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { SellerOnly } from '@/components/RoleGuard';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';

function money(value: number) {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

function when(value: string | null) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString();
}

function payoutLabel(status: string, releaseAt: string | null) {
  if (status === 'held') return `Held until ${when(releaseAt)}`;
  if (status === 'settled') return 'Paid to your Stripe account';
  if (status === 'refunded') return 'Refunded. This payout will not be sent.';
  if (status === 'disputed') return 'Chargeback. This payout is stopped or pulled back.';
  return status;
}

export default function PayoutResponsibilityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [draft, setDraft] = useState('');
  const [feesAcknowledged, setFeesAcknowledged] = useState(false);
  const standing = trpc.platemaker.getPayoutStanding.useQuery(undefined, {
    enabled: user?.role === 'platemaker',
  });
  const connect = trpc.payments.getConnectAccountStatus.useQuery(undefined, {
    enabled: user?.role === 'platemaker',
  });
  const send = trpc.platemaker.sendPayoutAdminMessage.useMutation({
    onSuccess: () => {
      setDraft('');
      standing.refetch();
    },
    onError: (error) => Alert.alert('Message not sent', error.message),
  });
  const startConnect = trpc.payments.createConnectAccount.useMutation({
    onSuccess: (result) => {
      WebBrowser.openBrowserAsync(result.onboardingUrl).catch(() => {
        Alert.alert('Stripe', 'Open this link in a browser to finish payout setup.');
      });
    },
    onError: (error) => Alert.alert('Stripe', error.message),
  });

  const data = standing.data;

  return (
    <SellerOnly>
      <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.green}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerGradient, { paddingTop: insets.top }]}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height ?? 0;
              if (height !== headerHeight) setHeaderHeight(height);
            }}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Payouts and responsibility</Text>
              <Text style={styles.subtitle}>Stripe pays you after a 7-day hold</Text>
            </View>
          </LinearGradient>
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: headerHeight + 12 }]}>
          {standing.isLoading ? <ActivityIndicator color={Colors.gradient.green} /> : null}
          {standing.error ? <Text style={styles.error}>{standing.error.message}</Text> : null}

          {data ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {data.sellingRemoved ? 'Selling removed' : 'In good standing'}
                </Text>
                <Text style={styles.body}>{data.statement}</Text>
                {data.sellingRemovedReason ? (
                  <Text style={styles.reason}>{data.sellingRemovedReason}</Text>
                ) : null}
                <Text style={styles.meta}>
                  Rolling {data.windowDays} days: {data.thresholds.chargeback} chargebacks, {data.thresholds.refund} refunds, {data.thresholds.complaint} complaints, or {data.thresholds.governmentRequest} government request. Each one sends you a notice. One event before a block sends a warning.
                </Text>
              </View>

              {data.warnings.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Close to a selling block</Text>
                  {data.warnings.map((warning) => (
                    <Text key={warning} style={styles.reason}>{warning}</Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Stripe account</Text>
                <Text style={styles.body}>
                  HomeCookedPlate keeps both non-refundable 10% fees. Buyers pay 10% on top. Your payout is 10% less. Neither fee is returned on a refund.
                </Text>
                <Text style={styles.body}>
                  {connect.data?.payoutsEnabled
                    ? 'Payouts are enabled. After the hold, Stripe transfers your share to this account.'
                    : 'Finish Stripe Express setup so sales can be paid to you directly.'}
                </Text>
                {!connect.data?.payoutsEnabled ? (
                  <GlassPressable
                    onPress={() => setFeesAcknowledged((prev) => !prev)}
                    style={[styles.ackRow, feesAcknowledged ? styles.ackRowOn : undefined]}
                    testID="cook-fee-acknowledgement"
                  >
                    <Text style={styles.body}>
                      {feesAcknowledged ? 'Acknowledged. ' : ''}I understand HomeCookedPlate keeps both non-refundable 10% fees.
                    </Text>
                  </GlassPressable>
                ) : null}
                {!connect.data?.payoutsEnabled && feesAcknowledged && user?.email ? (
                  <GlassPressable
                    style={styles.button}
                    onPress={() => startConnect.mutate({ email: user.email })}
                    testID="connect-stripe-payouts"
                  >
                    <Text style={styles.buttonText}>
                      {startConnect.isPending ? 'Opening Stripe' : 'Set up Stripe payouts'}
                    </Text>
                  </GlassPressable>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Last {data.windowDays} days</Text>
                <Text style={styles.row}>Refunds {data.counts.refund}</Text>
                <Text style={styles.row}>Chargebacks {data.counts.chargeback}</Text>
                <Text style={styles.row}>Complaints {data.counts.complaint}</Text>
                <Text style={styles.row}>Government requests {data.counts.governmentRequest}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payouts</Text>
                {data.payouts.length === 0 ? (
                  <Text style={styles.body}>No plate sales are waiting on a payout.</Text>
                ) : (
                  data.payouts.map((payout) => (
                    <View key={payout.id} style={styles.payout}>
                      <Text style={styles.row}>{money(payout.sellerPayout)}</Text>
                      <Text style={styles.meta}>{payoutLabel(payout.status, payout.releaseAt)}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Admins</Text>
                {data.messages.map((message) => (
                  <View key={message.id} style={styles.payout}>
                    <Text style={styles.meta}>{message.senderRole === 'admin' ? 'Admin' : 'You'} · {when(message.createdAt)}</Text>
                    <Text style={styles.body}>{message.body}</Text>
                  </View>
                ))}
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Message an admin about a payout, refund, or chargeback"
                  placeholderTextColor={Colors.gray[400]}
                  style={styles.input}
                  multiline
                  testID="payout-admin-message"
                />
                <GlassPressable
                  style={styles.button}
                  onPress={() => {
                    if (!draft.trim()) return;
                    send.mutate({ body: draft.trim() });
                  }}
                  testID="send-payout-admin-message"
                >
                  <Text style={styles.buttonText}>{send.isPending ? 'Sending' : 'Send to admins'}</Text>
                </GlassPressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </SellerOnly>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: pagePastel.green },
  staticHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  header: { paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.white, opacity: 0.9 },
  scroll: { paddingBottom: 100 },
  card: {
    marginHorizontal: 24,
    marginTop: 12,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, color: Colors.gray[800] },
  reason: { marginTop: 8, fontSize: 14, lineHeight: 20, color: Colors.gray[900], fontWeight: '600' },
  meta: { marginTop: 8, fontSize: 12, lineHeight: 18, color: Colors.gray[600] },
  row: { fontSize: 15, color: Colors.gray[900], marginTop: 4 },
  payout: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.gray[200] },
  input: {
    marginTop: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    fontSize: 15,
    color: Colors.gray[900],
  },
  ackRow: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  ackRowOn: { borderColor: Colors.gradient.green },
  button: {
    marginTop: 12,
    backgroundColor: Colors.gradient.green,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  error: { marginHorizontal: 24, color: Colors.gray[800] },
});
