import React, { useRef } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AdminOnly } from '@/components/RoleGuard';
import { BackCircle } from '@/components/BackCircle';
import { GlassIconButton, GlassPressable } from '@/components/glass-surface';
import { IdleChrome } from '@/components/IdleChrome';
import { CHROME_CHIP_SIZE, CHROME_ICON_SIZE } from '@/lib/chrome-activity';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { Colors, pagePastel } from '@/constants/colors';
import { AuthColors } from '@/constants/auth-palette';
import { trpc } from '@/lib/trpc';

type QueueItem = { id: string; kind: 'message' | 'note' | 'comment' | 'report'; text: string; detail: string };

function QueueCard({ item }: { item: QueueItem }) {
  const utils = trpc.useUtils();
  const decide = trpc.admin.decideModeration.useMutation({
    onSuccess: () => utils.admin.listModerationQueue.invalidate(),
    onError: (error) => Alert.alert('Moderator', error.message),
  });
  const title = item.kind === 'message'
    ? 'Order message'
    : item.kind === 'note'
      ? 'Plate note'
      : item.kind === 'comment'
        ? 'Review comment'
        : 'Report';
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.detail}>{item.detail}</Text>
      <Text style={styles.body}>{item.text}</Text>
      <View style={styles.row}>
        <GlassPressable
          style={styles.allow}
          disabled={decide.isPending}
          onPress={() => decide.mutate({ kind: item.kind, id: item.id, decision: 'allow' })}
        >
          <Text style={styles.allowText}>Allow</Text>
        </GlassPressable>
        <GlassPressable
          style={styles.remove}
          disabled={decide.isPending}
          onPress={() => decide.mutate({ kind: item.kind, id: item.id, decision: 'remove' })}
        >
          <Text style={styles.removeText}>Remove</Text>
        </GlassPressable>
      </View>
    </View>
  );
}

export default function AdminModeratorScreen() {
  const leave = useLeaveScreen('/(tabs)/profile');
  const scrollRef = useRef<ScrollView>(null);
  const queue = trpc.admin.listModerationQueue.useQuery();
  const rescan = trpc.admin.rescanStoredText.useMutation({
    onSuccess: (result) => {
      queue.refetch().catch(() => undefined);
      Alert.alert('Saved text', `${result.removed} item${result.removed === 1 ? '' : 's'} hidden.`);
    },
    onError: (error) => Alert.alert('Saved text', error.message),
  });
  const items: QueueItem[] = [
    ...(queue.data?.messages || []),
    ...(queue.data?.notes || []),
    ...(queue.data?.comments || []),
    ...(queue.data?.reports || []),
  ];

  return (
    <AdminOnly>
      <SafeAreaView style={styles.safe}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <BackCircle onPress={leave} />
          <Text style={styles.title}>Moderator</Text>
          <Text style={styles.note}>
            An order message, a plate note, and a review comment stay hidden from the other person until you allow them. A report stays here until you allow the content or remove it.
          </Text>
          <GlassPressable style={styles.rescan} disabled={rescan.isPending} onPress={() => rescan.mutate()}>
            <Text style={styles.allowText}>{rescan.isPending ? 'Checking saved text' : 'Check saved text'}</Text>
          </GlassPressable>
          {queue.isLoading ? <ActivityIndicator color={Colors.gray[900]} /> : null}
          {queue.error ? <Text style={styles.note}>{queue.error.message}</Text> : null}
          {!queue.isLoading && items.length === 0 ? <Text style={styles.note}>Nothing is waiting.</Text> : null}
          {items.map((item) => <QueueCard key={`${item.kind}-${item.id}`} item={item} />)}
        </ScrollView>
        <IdleChrome>
          <View style={styles.jumps}>
            <GlassIconButton
              onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              accessibilityLabel="Scroll to top"
              size={CHROME_CHIP_SIZE}
              maroon
            >
              <Ionicons name="chevron-up" size={CHROME_ICON_SIZE} color={AuthColors.gold} />
            </GlassIconButton>
          </View>
        </IdleChrome>
      </SafeAreaView>
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pagePastel.purple },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  jumps: { position: 'absolute', right: 16, bottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 8 },
  note: { color: Colors.gray[700], lineHeight: 20, marginTop: 8, marginBottom: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 12 },
  label: { color: Colors.gray[900], fontWeight: '700' },
  detail: { color: Colors.gray[600], marginTop: 4 },
  body: { color: Colors.gray[900], marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  allow: { flex: 1, backgroundColor: Colors.gray[900], borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  allowText: { color: Colors.white, fontWeight: '700' },
  remove: { flex: 1, backgroundColor: Colors.white, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[300] },
  removeText: { color: Colors.gray[900], fontWeight: '700' },
  rescan: { backgroundColor: Colors.gray[900], borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
});
