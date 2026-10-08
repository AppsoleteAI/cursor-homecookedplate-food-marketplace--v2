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
import { AdminOnly } from '@/components/RoleGuard';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminPayoutReviewScreen() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [platemakerId, setPlatemakerId] = useState('');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const review = trpc.admin.getPayoutReview.useQuery();
  const record = trpc.admin.recordResponsibility.useMutation({
    onSuccess: () => {
      setNote('');
      review.refetch();
      Alert.alert('Saved', 'The event is on the cook record. Thresholds can remove selling.');
    },
    onError: (error) => Alert.alert('Not saved', error.message),
  });
  const sendReply = trpc.admin.replyPayoutMessage.useMutation({
    onSuccess: () => {
      setReply('');
      review.refetch();
    },
    onError: (error) => Alert.alert('Not sent', error.message),
  });
  const restore = trpc.admin.restorePlatemakerSelling.useMutation({
    onSuccess: () => {
      review.refetch();
      Alert.alert('Restored', 'This cook can sell again. Turn availability back on from their dashboard.');
    },
    onError: (error) => Alert.alert('Not restored', error.message),
  });

  const messages = (review.data?.messages ?? []).filter((message) => message.platemakerId === platemakerId);

  return (
    <AdminOnly>
      <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.purple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerGradient, { paddingTop: insets.top }]}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height ?? 0;
              if (height !== headerHeight) setHeaderHeight(height);
            }}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Payout review</Text>
              <Text style={styles.subtitle}>Complaints, government requests, and cook messages</Text>
            </View>
          </LinearGradient>
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: headerHeight + 12 }]}>
          {review.isLoading ? <ActivityIndicator color={Colors.gradient.purple} /> : null}
          {review.error ? <Text style={styles.body}>{review.error.message}</Text> : null}

          {(review.data?.cooks ?? []).map((cook) => (
            <GlassPressable
              key={cook.id}
              style={styles.card}
              onPress={() => setPlatemakerId(cook.id)}
              testID={`payout-review-${cook.id}`}
            >
              <Text style={styles.cardTitle}>{cook.username || cook.email || cook.id}</Text>
              <Text style={styles.body}>
                {cook.sellingRemoved ? 'Selling removed' : 'Still allowed to sell'}
              </Text>
              {cook.sellingRemovedReason ? <Text style={styles.body}>{cook.sellingRemovedReason}</Text> : null}
              {cook.events.map((event) => (
                <Text key={event.id} style={styles.meta}>
                  {event.kind} · {event.note || 'No note'}
                </Text>
              ))}
            </GlassPressable>
          ))}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Record or reply</Text>
            <TextInput
              value={platemakerId}
              onChangeText={setPlatemakerId}
              placeholder="Platemaker id"
              placeholderTextColor={Colors.gray[400]}
              style={styles.input}
              autoCapitalize="none"
              testID="payout-review-platemaker-id"
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Complaint or government request note"
              placeholderTextColor={Colors.gray[400]}
              style={[styles.input, styles.tall]}
              multiline
              testID="payout-review-note"
            />
            <GlassPressable
              style={styles.button}
              onPress={() => record.mutate({ platemakerId, kind: 'complaint', note })}
              testID="record-complaint"
            >
              <Text style={styles.buttonText}>Record complaint</Text>
            </GlassPressable>
            <GlassPressable
              style={styles.button}
              onPress={() => record.mutate({ platemakerId, kind: 'government_request', note })}
              testID="record-government-request"
            >
              <Text style={styles.buttonText}>Record government request</Text>
            </GlassPressable>
            <GlassPressable
              style={styles.secondary}
              onPress={() => restore.mutate({ platemakerId })}
              testID="restore-selling"
            >
              <Text style={styles.secondaryText}>Restore selling</Text>
            </GlassPressable>

            {messages.map((message) => (
              <Text key={message.id} style={styles.meta}>
                {message.senderRole}: {message.body}
              </Text>
            ))}
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Reply to this cook"
              placeholderTextColor={Colors.gray[400]}
              style={[styles.input, styles.tall]}
              multiline
              testID="payout-review-reply"
            />
            <GlassPressable
              style={styles.button}
              onPress={() => sendReply.mutate({ platemakerId, body: reply })}
              testID="send-payout-reply"
            >
              <Text style={styles.buttonText}>Send reply</Text>
            </GlassPressable>
          </View>
        </ScrollView>
      </View>
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: pagePastel.purple },
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 20, color: Colors.gray[800] },
  meta: { marginTop: 6, fontSize: 12, lineHeight: 18, color: Colors.gray[600] },
  input: {
    marginTop: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.gray[900],
  },
  tall: { minHeight: 80 },
  button: {
    marginTop: 12,
    backgroundColor: Colors.gradient.purple,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: Colors.white, fontWeight: '700' },
  secondary: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  secondaryText: { color: Colors.gray[900], fontWeight: '700' },
});
