import React from 'react';
import { Alert, Text, StyleSheet } from 'react-native';
import { GlassPressable } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
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
  const updateOrder = trpc.payments.updateShopOrder.useMutation({
    onSuccess: (result) => {
      utils.payments.listShopOrders.invalidate({ shop }).catch(() => undefined);
      Alert.alert('Order', result.status === 'cancelled' ? 'The refund was sent.' : `This order is ${result.status}.`);
    },
    onError: (error) => {
      Alert.alert('Order', error.message || 'Could not update this order.');
    },
  });

  if (!orderStatus) return null;
  const status = orderStatus;
  const mine = Boolean(user && sellerId && user.id === sellerId && paid);
  const run = (action: 'accept' | 'refund' | 'complete') => {
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
      {mine && status === 'accepted' ? (
        <GlassPressable style={styles.button} onPress={() => run('complete')} disabled={updateOrder.isPending}>
          <Text style={styles.buttonText}>Order completed</Text>
        </GlassPressable>
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
});
