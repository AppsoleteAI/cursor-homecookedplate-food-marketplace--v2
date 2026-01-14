import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useOrders } from '@/hooks/orders-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/auth-context';

export default function OrderDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrder, setOrderStatus, addMessage, getMessages, syncMessages } = useOrders();
  const { user } = useAuth();
  const order = getOrder(String(id));
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const insets = useSafeAreaInsets();

  const isActive = useMemo(() => order && order.status !== 'completed' && order.status !== 'cancelled', [order]);
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
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
        <Text style={styles.error}>Order not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: `Order #${order.id}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mealHeader}>
          <Image source={{ uri: order.mealImage }} style={styles.mealImage} accessibilityLabel="meal-image" />
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
          <Text style={styles.title}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.value}>{order.status}</Text>
            {isActive ? (
              <TouchableOpacity onPress={() => setOrderStatus(order.id, 'completed')} style={styles.completeBtn} testID="complete-order-btn">
                <Text style={styles.completeBtnText}>Order Completed</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Allergies</Text>
          <Text style={styles.value}>{order.allergies?.join(', ') ?? 'None'}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>Preparation Instructions</Text>
          <Text style={styles.value}>{order.specialInstructions ?? '—'}</Text>
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
          <TouchableOpacity 
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
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
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
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
