import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import { SellerOnly } from '@/components/RoleGuard';
import { OrderAcceptModal } from '@/components/OrderAcceptModal';
import { OrderRefundModal } from '@/components/OrderRefundModal';
import { calculateOrderSplit } from '@/lib/fees';
import { SkeletonOrdersList } from '@/components/SkeletonOrdersList';

/**
 * Active Orders Screen
 * 
 * Displays incoming orders for platemakers in chronological order (oldest first).
 * Allows platemakers to accept, deny, or refund orders.
 */
export default function ActiveOrdersModal() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // CRITICAL SECURITY: Only fetch orders if user is platemaker
  const { data: orders, isLoading, error, refetch } = trpc.platemaker.getIncomingOrders.useQuery(
    undefined,
    {
      enabled: user?.role === 'platemaker' && !!user?.id,
      refetchOnWindowFocus: true,
    }
  );

  const acceptOrderMutation = trpc.platemaker.acceptOrder.useMutation({
    onSuccess: () => {
      refetch();
      Alert.alert('Success', 'Order accepted successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to accept order');
    },
  });

  const denyOrderMutation = trpc.platemaker.denyOrder.useMutation({
    onSuccess: (data) => {
      refetch();
      Alert.alert(
        'Order Denied',
        data.message || 'Order has been denied and payment refunded if applicable.'
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to deny order');
    },
  });

  const refundOrderMutation = trpc.platemaker.refundOrder.useMutation({
    onSuccess: (data) => {
      refetch();
      Alert.alert('Refund Processed', data.message || 'Order refunded successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to process refund');
    },
  });

  const handleAccept = async (orderId: string, estimatedCompletionTime?: string) => {
    await acceptOrderMutation.mutateAsync({
      orderId,
      estimatedCompletionTime,
    });
  };

  const handleDeny = (order: any) => {
    Alert.alert(
      'Deny Order',
      `Are you sure you want to deny this order? ${order.paid ? 'Payment will be refunded.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny Order',
          style: 'destructive',
          onPress: () => {
            denyOrderMutation.mutate({ orderId: order.id });
          },
        },
      ]
    );
  };

  const handleRefund = (order: any) => {
    // Calculate refund amount (90% of base)
    const baseAmount = order.totalPrice / 1.10;
    const { sellerPayout } = calculateOrderSplit(baseAmount);
    const platformFeeKept = order.totalPrice - sellerPayout;

    setSelectedOrder({
      ...order,
      refundAmount: sellerPayout,
      platformFeeKept,
    });
    setRefundModalVisible(true);
  };

  const handleRefundConfirm = async () => {
    if (!selectedOrder) return;
    await refundOrderMutation.mutateAsync({ orderId: selectedOrder.id });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'accepted':
        return Colors.info;
      case 'preparing':
        return Colors.gradient.orange;
      case 'ready':
        return Colors.gradient.green;
      default:
        return Colors.gray[500];
    }
  };

  // CRITICAL SECURITY: Defensive check
  if (user?.role !== 'platemaker') {
    return null;
  }

  return (
    <SellerOnly>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={monoGradients.green}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Incoming Orders</Text>
            <TouchableOpacity onPress={() => router.back()} testID="close-active-orders">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Manage your orders chronologically</Text>
        </LinearGradient>

        {isLoading ? (
          <SkeletonOrdersList />
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle" size={48} color={Colors.error} />
            <Text style={styles.errorText}>Error loading orders</Text>
            <Text style={styles.errorDetail}>{error.message}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !orders || orders.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="cube-outline" size={64} color={Colors.gray[400]} />
            <Text style={styles.emptyTitle}>No incoming orders</Text>
            <Text style={styles.emptySub}>You&apos;re all caught up!</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={Colors.gradient.green}
              />
            }
          >
            {orders.map((order) => (
              <View key={order.id} style={styles.card}>
                <Image
                  source={{ uri: order.mealImage || 'https://via.placeholder.com/80' }}
                  style={styles.image}
                />
                <View style={styles.content}>
                  <Text style={styles.name}>{order.mealName}</Text>
                  <Text style={styles.buyerName}>From: {order.buyerName}</Text>
                  <Text style={styles.meta}>
                    Qty {order.quantity} • ${order.totalPrice.toFixed(2)}
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}
                    >
                      <Text
                        style={[styles.statusText, { color: getStatusColor(order.status) }]}
                      >
                        {order.status.toUpperCase()}
                      </Text>
                    </View>
                    {order.paid && (
                      <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                        <Text style={[styles.statusText, { color: Colors.success }]}>PAID</Text>
                      </View>
                    )}
                  </View>
                  {order.estimatedCompletionTime && (
                    <Text style={styles.eta}>
                      ETA: {new Date(order.estimatedCompletionTime).toLocaleString()}
                    </Text>
                  )}
                  {order.specialInstructions && (
                    <Text style={styles.instructions} numberOfLines={2}>
                      Note: {order.specialInstructions}
                    </Text>
                  )}
                </View>
                <View style={styles.actions}>
                  {order.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => {
                          setSelectedOrder(order);
                          setAcceptModalVisible(true);
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.denyButton]}
                        onPress={() => handleDeny(order)}
                        disabled={denyOrderMutation.isLoading}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.white} />
                        <Text style={styles.actionButtonText}>Deny</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {['accepted', 'preparing', 'ready'].includes(order.status) && order.paid && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.refundButton]}
                      onPress={() => handleRefund(order)}
                      disabled={refundOrderMutation.isLoading}
                    >
                      <Ionicons name="return-down-back" size={20} color={Colors.white} />
                      <Text style={styles.actionButtonText}>Refund</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* Accept Order Modal */}
        {selectedOrder && (
          <OrderAcceptModal
            visible={acceptModalVisible}
            orderId={selectedOrder.id}
            mealName={selectedOrder.mealName}
            onClose={() => {
              setAcceptModalVisible(false);
              setSelectedOrder(null);
            }}
            onSuccess={() => {
              refetch();
            }}
            acceptOrder={handleAccept}
          />
        )}

        {/* Refund Order Modal */}
        {selectedOrder && (
          <OrderRefundModal
            visible={refundModalVisible}
            orderId={selectedOrder.id}
            mealName={selectedOrder.mealName}
            totalPrice={selectedOrder.totalPrice}
            refundAmount={selectedOrder.refundAmount}
            platformFeeKept={selectedOrder.platformFeeKept}
            onClose={() => {
              setRefundModalVisible(false);
              setSelectedOrder(null);
            }}
            onConfirm={handleRefundConfirm}
            isProcessing={refundOrderMutation.isLoading}
          />
        )}
      </View>
    </SellerOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSubtitle: {
    marginTop: 6,
    color: Colors.white,
    opacity: 0.9,
  },
  closeText: {
    color: Colors.white,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
  errorText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.error,
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.gradient.green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[800],
  },
  emptySub: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.gray[500],
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: Colors.gray[200],
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  buyerName: {
    fontSize: 12,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: Colors.gray[600],
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eta: {
    fontSize: 11,
    color: Colors.gradient.green,
    fontWeight: '600',
    marginTop: 4,
  },
  instructions: {
    fontSize: 11,
    color: Colors.gray[500],
    fontStyle: 'italic',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 80,
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.gradient.green,
  },
  denyButton: {
    backgroundColor: Colors.error,
  },
  refundButton: {
    backgroundColor: Colors.warning,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
