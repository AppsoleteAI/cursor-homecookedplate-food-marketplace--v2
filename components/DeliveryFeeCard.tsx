import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { calculateDeliveryLevy } from '@/lib/fees';
import { trpc } from '@/lib/trpc';

export function DeliveryFeeCard() {
  const { user } = useAuth();
  const saved = trpc.platemaker.getDeliveryFee.useQuery(
    { sellerId: user?.id ?? '' },
    { enabled: Boolean(user?.id) },
  );
  const save = trpc.platemaker.setDeliveryFee.useMutation({
    onSuccess: (result) => {
      setDraft(result.deliveryFee.toFixed(2));
      saved.refetch();
    },
  });
  const [draft, setDraft] = useState('');
  const shown = draft.length > 0 ? draft : (saved.data ? saved.data.deliveryFee.toFixed(2) : '');
  const amount = Number(shown);
  const preview = Number.isFinite(amount) && amount >= 0 && amount <= 50 ? calculateDeliveryLevy(amount) : null;

  const onSave = async () => {
    if (!preview) {
      Alert.alert('Delivery fee', 'Enter an amount from $0 to $50.');
      return;
    }
    try {
      await save.mutateAsync({ amount: preview.deliveryFee });
    } catch (error) {
      Alert.alert('Delivery fee', error instanceof Error ? error.message : 'That fee was not saved.');
    }
  };

  return (
    <View style={styles.card} testID="delivery-fee-card">
      <Text style={styles.title}>Delivery fee</Text>
      <Text style={styles.body}>You set this amount and you receive it. The PlateTaker pays it plus 5%.</Text>
      <TextInput
        value={shown}
        onChangeText={setDraft}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={Colors.gray[400]}
        style={styles.input}
        testID="delivery-fee-input"
      />
      {preview ? (
        <Text style={styles.meta}>PlateTaker pays ${preview.buyerPays.toFixed(2)} · Platform keeps ${preview.platformFee.toFixed(2)}</Text>
      ) : null}
      <GlassPressable style={styles.button} onPress={onSave} disabled={save.isPending} testID="delivery-fee-save">
        <Text style={styles.buttonText}>{save.isPending ? 'Saving…' : 'Save delivery fee'}</Text>
      </GlassPressable>
    </View>
  );
}

const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useDeliveryQuote(sellerId: string | undefined, active: boolean) {
  const known = Boolean(sellerId && SELLER_ID.test(sellerId));
  const query = trpc.platemaker.getDeliveryFee.useQuery(
    { sellerId: sellerId ?? '' },
    { enabled: active && known },
  );
  return {
    deliveryFee: active && query.data ? query.data.deliveryFee : 0,
    loading: active && known && query.isLoading,
  };
}

export function DeliveryLevyLines({ deliveryFee, active }: { deliveryFee: number; active: boolean }) {
  if (!active || deliveryFee <= 0) return null;
  const total = calculateDeliveryLevy(deliveryFee);
  return (
    <View testID="delivery-levy">
      <Text style={styles.meta}>Delivery ${total.deliveryFee.toFixed(2)}, set by the PlateMaker</Text>
      <Text style={styles.meta}>Delivery platform fee 5% ${total.platformFee.toFixed(2)}</Text>
      <Text style={styles.meta}>Delivery you pay ${total.buyerPays.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginHorizontal: 24, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  body: { color: Colors.gray[600], marginTop: 6, lineHeight: 20 },
  input: { marginTop: 10, backgroundColor: Colors.gray[50], borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  meta: { color: Colors.gray[700], marginTop: 6, lineHeight: 20 },
  button: { marginTop: 12, backgroundColor: Colors.gray[900], borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
