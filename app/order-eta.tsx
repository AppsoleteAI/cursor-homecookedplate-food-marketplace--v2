import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { ScreenBack } from '@/components/BackCircle';
import { GlassPressable } from '@/components/glass-surface';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';

export default function OrderEtaScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const send = trpc.messages.send.useMutation();
  const [minutes, setMinutes] = useState('25');
  const isCook = user?.role === 'platemaker';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: 'Order ETA', headerShown: false }} />
      <View style={styles.backRow}>
        <ScreenBack fallback="/(tabs)/orders" testID="order-eta-back" />
      </View>
      <Text style={styles.title}>ETA for the PlateTaker</Text>
      {isCook ? (
        <>
          <Text style={styles.line}>Minutes until this paid order is ready. 5 to 240.</Text>
          <TextInput
            style={styles.input}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            testID="order-eta-minutes"
          />
          <GlassPressable
            style={styles.button}
            disabled={send.isPending}
            testID="order-eta-send"
            onPress={() => {
              const etaMinutes = Number(minutes);
              send.mutate(
                { orderId: String(orderId || ''), text: '', etaMinutes },
                {
                  onSuccess: () => {
                    Alert.alert('ETA', 'The PlateTaker is told after a moderator allows this message.');
                    if (orderId) router.replace(`/order/${orderId}` as Href);
                  },
                  onError: (error) => Alert.alert('ETA', error.message),
                },
              );
            }}
          >
            {send.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Send ETA</Text>}
          </GlassPressable>
        </>
      ) : (
        <Text style={styles.line} testID="order-eta-buyer">Only the PlateMaker can send an ETA.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 16 },
  backRow: { paddingTop: 16, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  line: { fontSize: 15, color: Colors.gray[700], marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 12,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gradient.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
