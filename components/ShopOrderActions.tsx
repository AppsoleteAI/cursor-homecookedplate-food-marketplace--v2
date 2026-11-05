import React from 'react';
import { Alert, Text, StyleSheet } from 'react-native';
import { GlassPressable } from '@/components/glass-surface';
import { ReceiptAck } from '@/components/ReceiptAck';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { RECEIPT_ACK_COPY } from '@/lib/order-closeout';
import { trpc } from '@/lib/trpc';
import type { ShopName } from '@/backend/lib/shop-catalog';

type Props = {
  orderId: string;
  shop: ShopName;
  orderStatus?: string;
  sellerId?: string | null;
  paid?: boolean;
};

export function ShopOrderActions({ orderId, shop, orderStatus, sellerId, paid }: Props) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const receipt = trpc.payments.shopReceipt.useQuery(
    { orderId },
    { enabled: paid === true && Boolean(orderId) },
  );
  const updateOrder = trpc.payments.updateShopOrder.useMutation({
    onSuccess: (result) => {
      utils.payments.listShopOrders.invalidate({ shop }).catch(() => undefined);
      receipt.refetch().catch(() => undefined);
      if ('acknowledged' in result && result.acknowledged) {
        Alert.alert('Receipt', 'The PlateMaker can clear this order after this acknowledgment.');
        return;
      }
      Alert.alert('Order', result.status === 'cancelled' ? 'The refund was sent.' : `This order is ${result.status}.`);
    },
    onError: (error) => {
      Alert.alert('Order', error.message || 'Could not update this order.');
    },
  });

  if (!orderStatus) return null;
  const status = orderStatus;
  const mine = Boolean(user && sellerId && user.id === sellerId && paid);
  const buyer = Boolean(user && paid && !mine);
  const roles = receipt.data?.roles ?? [];
  const buyerAccepted = roles.includes('buyer');
  const run = (action: 'accept' | 'refund' | 'complete' | 'acknowledge') => {
    updateOrder.mutate({ orderId, action });
  };

  return (
    <>
      <Text style={styles.status}>{status}</Text>
      {mine && status === 'pending' ? (
        <GlassPressable style={styles.button} onPress={() => run('accept')} disabled={updateOrder.isPending}>
          <Text style={styles.buttonText}>Accept</Text>
        </GlassPressable>
      ) : null}
      {mine && (status === 'pending' || status === 'accepted') ? (
        <GlassPressable style={styles.secondary} onPress={() => run('refund')} disabled={updateOrder.isPending}>
          <Text style={styles.secondaryText}>Refund</Text>
        </GlassPressable>
      ) : null}
      {buyer && status === 'accepted' && !buyerAccepted ? (
        <ReceiptAck role="platetaker" busy={updateOrder.isPending} onSend={() => run('acknowledge')} />
      ) : null}
      {mine && status === 'accepted' && !buyerAccepted ? (
        <Text style={styles.note}>{RECEIPT_ACK_COPY} Waiting for the PlateTaker to acknowledge receipt.</Text>
      ) : null}
      {mine && status === 'accepted' && buyerAccepted && !roles.includes('seller') ? (
        <ReceiptAck role="platemaker" busy={updateOrder.isPending} onSend={() => run('complete')} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  status: { marginTop: 8, color: Colors.gray[700], fontWeight: '700', textTransform: 'capitalize' },
  button: { marginTop: 8, backgroundColor: '#166534', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: { marginTop: 8, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[300] },
  secondaryText: { color: Colors.gray[900], fontWeight: '700' },
  note: { marginTop: 8, color: Colors.gray[700], lineHeight: 20 },
});
