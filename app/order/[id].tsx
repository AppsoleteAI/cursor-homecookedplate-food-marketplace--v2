import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { FoodImage } from '@/components/FoodImage';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import { useOrders } from '@/hooks/orders-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/auth-context';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { BUYER_AFTER_NOTE } from '@/lib/buyer-safety';
import { GlassPressable } from '@/components/glass-surface';
import { ScreenBack } from '@/components/BackCircle';
import { orderCloseout } from '@/lib/order-closeout';
import { formatPickupTime } from '@/lib/pickup-time';
import { trpc } from '@/lib/trpc';
import { ReviewCommentActions } from '@/components/ReviewCommentActions';
import StarRating from '@/components/StarRating';

export default function OrderDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrder, setOrderStatus, addMessage, getMessages, syncMessages, refresh } = useOrders();
  const { user } = useAuth();
  const blockCook = trpc.orders.blockCook.useMutation();
  const reportMessage = trpc.messages.report.useMutation();
  const order = getOrder(String(id));
  useFocusEffect(useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]));
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const insets = useSafeAreaInsets();

  const isActive = useMemo(() => order && order.status !== 'completed' && order.status !== 'cancelled', [order]);
  const plateReviews = trpc.reviews.list.useQuery(
    { mealId: order?.mealId ?? '' },
    { enabled: !!order?.mealId && order.status === 'completed' },
  );
  const orderReview = (plateReviews.data || []).find((review) => review.orderId === order?.id);
  const isCook = !!user && !!order && user.id === order.plateMakerId;
  const isBuyer = !!user && !!order && user.id === order.plateTakerId && !isCook;
  const messages = useMemo(() => (order ? getMessages(order.id) : []), [order, getMessages]);

  useEffect(() => {
    if (!order || !user) return;
    syncMessages(order.id);
    const interval = setInterval(() => {
      syncMessages(order.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [order, user, syncMessages]);

  const onSend = useCallback(async () => {
    if (!order || !input.trim() || !isActive || !user || sending) return;
    const role = user.role;
    const senderId = user.id;
    setSending(true);
    try {
      await addMessage(order.id, { orderId: order.id, senderId, senderRole: role, text: input.trim() });
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [order, input, isActive, addMessage, user, sending]);

  if (!order) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.backRow}>
          <ScreenBack fallback="/(tabs)/orders" testID="order-back" />
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>Order not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: `Order #${order.id}`, headerShown: false }} />
      <View style={styles.backRow}>
        <ScreenBack fallback="/(tabs)/orders" testID="order-back" />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mealHeader}>
          <FoodImage source={{ uri: order.mealImage }} style={styles.mealImage} accessibilityLabel="meal-image" />
          <View style={{ flex: 1 }}>
            <Text style={styles.mealName}>{order.mealName}</Text>
            <Text style={styles.mealMeta}>{`Qty ${order.quantity} • ${order.totalPrice.toFixed(2)}`}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>PlateTaker</Text>
          <Text style={styles.value}>{order.plateTakerName ?? order.plateTakerId}</Text>
        </View>
        <View style={styles.sectionRow}>
          <View style={styles.sectionHalf}>
            <Text style={styles.title}>Quantity</Text>
            <Text style={styles.value}>{order.quantity}</Text>
          </View>
          <View style={styles.sectionHalf}>
            <Text style={styles.title}>Paid</Text>
            <Text style={[styles.badge, { backgroundColor: (order.paid ? Colors.success : Colors.error) + '20', color: order.paid ? Colors.success : Colors.error }]}>{order.paid ? 'Yes' : 'No'}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>Pickup</Text>
          <Text style={styles.value}>
            {formatPickupTime(order.pickupTime, order.pickupTimeZone)}
          </Text>
          {order.deliveryAddress ? (
            <Text style={styles.value}>Delivery to {order.deliveryAddress}</Text>
          ) : null}
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>Status</Text>
          {order.status === 'cancelled' ? (
            <Text style={[styles.value, { color: Colors.error }]}>Cancelled</Text>
          ) : (
            <View style={styles.stageRow}>
              {(['pending', 'accepted', 'preparing', 'ready', 'completed'] as const).map((stage, index, stages) => {
                const current = stages.indexOf(order.status as typeof stage);
                const reached = current >= index;
                const labels: Record<typeof stage, string> = {
                  pending: 'Confirming',
                  accepted: 'Accepted',
                  preparing: 'Preparing',
                  ready: 'Ready',
                  completed: 'Done',
                };
                return (
                  <View key={stage} style={styles.stageItem}>
                    <View style={[styles.stageDot, reached && styles.stageDotReached]} />
                    <Text style={[styles.stageLabel, reached && styles.stageLabelReached]}>{labels[stage]}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.statusRow}>
            <Text style={styles.value}>{order.status}</Text>
            {(() => {
              const confirmedRole = user?.role === 'platemaker' ? 'seller' : 'buyer';
              const alreadyConfirmed = (order.pickupConfirmedBy ?? []).includes(confirmedRole);
              const closeout = orderCloseout(user?.role, order.status, alreadyConfirmed);
              const canCancel = user?.role === 'platetaker' && order.status === 'pending';
              if (!closeout && !canCancel) return null;
              return (
                <GlassPressable
                  onPress={() => {
                    const next = canCancel && !closeout ? 'cancelled' : closeout?.next;
                    if (!next) return;
                    setOrderStatus(order.id, next).then((result) => {
                      if (result?.waiting) {
                        Alert.alert('Pickup', 'Waiting for the other person to confirm pickup.');
                      }
                    }).catch((error: unknown) => {
                      const message = error instanceof Error ? error.message : 'Could not update this order.';
                      Alert.alert('Order', message);
                    });
                  }}
                  style={styles.completeBtn}
                  testID={canCancel && !closeout ? 'cancel-order-btn' : 'complete-order-btn'}
                >
                  <Text style={styles.completeBtnText}>{canCancel && !closeout ? 'Cancel order' : closeout?.label}</Text>
                </GlassPressable>
              );
            })()}
          </View>
          {order.status === 'ready' ? (
            <Text style={styles.value}>
              {(order.pickupConfirmedBy ?? []).includes(user?.role === 'platemaker' ? 'seller' : 'buyer')
                ? 'You confirmed pickup. Waiting for the other person.'
                : 'Both people confirm pickup before this order closes.'}
            </Text>
          ) : null}
        </View>

        {user?.role === 'platetaker' && order.plateMakerId ? (
          <View style={styles.statusRow}>
            <GlassPressable
              onPress={() => {
                blockCook.mutate({ orderId: order.id, action: order.cookBlocked ? 'unblock' : 'block' }, {
                  onSuccess: () => {
                    refresh().catch(() => undefined);
                    Alert.alert(
                      order.cookBlocked ? 'Unblocked' : 'Blocked',
                      order.cookBlocked
                        ? 'This cook can take a new order from this account. They were told.'
                        : 'This cook cannot take a new order from this account. They were told.',
                    );
                  },
                  onError: (error) => Alert.alert('Block', error.message),
                });
              }}
              style={styles.completeBtn}
              testID="block-cook-btn"
            >
              <Text style={styles.completeBtnText}>{order.cookBlocked ? 'Unblock this cook' : 'Block this cook'}</Text>
            </GlassPressable>
            <GlassPressable
              onPress={() => {
                blockCook.mutate({ orderId: order.id, action: 'report' }, {
                  onSuccess: () => Alert.alert('Report', 'This report was saved, and the cook was told.'),
                  onError: (error) => Alert.alert('Report', error.message),
                });
              }}
              style={styles.completeBtn}
              testID="report-cook-btn"
            >
              <Text style={styles.completeBtnText}>Report this cook</Text>
            </GlassPressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.title}>{user?.role === 'platemaker' ? 'Until Pickup' : 'When You Have It'}</Text>
          <Text style={styles.value}>
            {user?.role === 'platemaker'
              ? 'Keep cold food at or below 41°F and hot food at or above 135°F until it is handed over.'
              : `${BUYER_AFTER_NOTE} Meet in a public place during daylight.`}
          </Text>
          <FoodHandlingLink />
        </View>
        {order.status === 'completed' && (isBuyer || isCook || user?.isAdmin) ? (
          <View style={styles.section}>
            <Text style={styles.title}>Review</Text>
            {orderReview ? (
              <>
                <StarRating value={orderReview.rating} baseColor="yellow" size={16} disabled />
                {orderReview.comment ? <Text style={styles.value}>{orderReview.comment}</Text> : orderReview.commentStatus === 'pending' ? (
                  <Text style={styles.value}>A moderator has not released this comment.</Text>
                ) : (
                  <Text style={styles.value}>Stars only. This review has no comment.</Text>
                )}
                <ReviewCommentActions
                  reviewId={orderReview.id}
                  authorId={orderReview.authorId}
                  comment={orderReview.comment || ''}
                  onChanged={() => plateReviews.refetch()}
                />
              </>
            ) : isBuyer ? (
              <GlassPressable
                onPress={() => router.push({ pathname: '/reviews/[mealId]', params: { mealId: order.mealId, next: `/order/${order.id}` } })}
                style={styles.completeBtn}
                testID="order-write-review"
              >
                <Text style={styles.completeBtnText}>Review this plate</Text>
              </GlassPressable>
            ) : (
              <Text style={styles.value}>No review on this order yet.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.title}>Allergies</Text>
          <Text style={styles.value}>{order.allergies?.join(', ') ?? 'None'}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>Preparation Instructions</Text>
          <Text style={styles.value}>{order.specialInstructions ?? '—'}</Text>
          {order.instructionsStatus === 'pending' ? (
            <Text style={styles.value}>
              {isCook
                ? 'A moderator has not released this note.'
                : 'A moderator has not released this note to the cook.'}
            </Text>
          ) : null}
          {order.instructionsStatus === 'removed' ? (
            <Text style={styles.value}>A moderator removed this note.</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.messagesBox} testID="order-messages-box">
            {messages.length === 0 ? (
              <Text style={styles.emptyMsg}>No messages yet</Text>
            ) : (
              messages.map((m) => {
                const label = m.senderRole === 'platemaker' ? (order.plateMakerName ?? m.senderId) : (order.plateTakerName ?? m.senderId);
                return (
                  <View key={m.id} style={styles.messageItem}>
                    <Text style={styles.messageLine} accessibilityLabel={`message-${m.id}`}>{`${label}: ${m.text}`}</Text>
                    {m.moderationStatus === 'pending' ? (
                      <Text style={styles.emptyMsg}>Waiting for a moderator. The other person has not been told.</Text>
                    ) : null}
                    {m.senderId !== user?.id ? (
                      <GlassPressable
                        onPress={() => {
                          reportMessage.mutate({ messageId: m.id }, {
                            onSuccess: () => {
                              syncMessages(order.id).catch(() => undefined);
                              Alert.alert('Report', 'A moderator has this message. The other person cannot see it until it is allowed.');
                            },
                            onError: (error) => Alert.alert('Report', error.message),
                          });
                        }}
                        testID={`report-message-${m.id}`}
                      >
                        <Text style={styles.completeBtnText}>
                          {m.senderRole === 'platemaker' ? 'Report this cook message' : 'Report this buyer message'}
                        </Text>
                      </GlassPressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <View style={[styles.inputRow, { opacity: isActive ? 1 : 0.5 }]}>
          <TextInput
            style={styles.input}
            placeholder={isActive ? 'Type a message' : 'Messaging closed for completed orders'}
            value={input}
            onChangeText={setInput}
            editable={isActive}
            testID="order-message-input"
          />
          <GlassPressable 
            onPress={onSend} 
            disabled={!isActive || !input.trim() || sending} 
            style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]} 
            testID="order-send-btn"
          >
            {sending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>Send</Text>
            )}
          </GlassPressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  backRow: { paddingTop: 16, paddingLeft: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: Colors.error, fontWeight: '700' as const },
  content: { padding: 16, paddingBottom: 100 },
  mealHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  mealImage: { width: 68, height: 68, borderRadius: 10, backgroundColor: Colors.gray[100] },
  mealName: { fontSize: 18, fontWeight: '700' as const, color: Colors.gray[900] },
  mealMeta: { fontSize: 13, color: Colors.gray[600], marginTop: 2 },
  section: { marginBottom: 16 },
  sectionRow: { flexDirection: 'row', gap: 16 },
  sectionHalf: { flex: 1 },
  title: { fontSize: 12, color: Colors.gray[500], textTransform: 'uppercase' as const, fontWeight: '700' as const },
  value: { fontSize: 16, color: Colors.gray[900], marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stageItem: { alignItems: 'center', flex: 1 },
  stageDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.gray[300], marginBottom: 6 },
  stageDotReached: { backgroundColor: Colors.gradient.green },
  stageLabel: { fontSize: 10, color: Colors.gray[500], textAlign: 'center' },
  stageLabelReached: { color: Colors.gray[900], fontWeight: '700' },
  completeBtn: { backgroundColor: Colors.gradient.green, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  completeBtnText: { color: Colors.white, fontWeight: '700' as const },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' as const },
  messagesBox: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 12, padding: 12, minHeight: 80 },
  emptyMsg: { color: Colors.gray[500] },
  messageItem: { marginBottom: 10 },
  messageLine: { fontSize: 15, color: Colors.gray[900] },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: Colors.gray[200], backgroundColor: Colors.white },
  input: { flex: 1, height: 44, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 8, paddingHorizontal: 12 },
  sendBtn: { backgroundColor: Colors.gradient.green, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, minWidth: 60, alignItems: 'center' as const, justifyContent: 'center' as const },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontWeight: '700' as const },
});
