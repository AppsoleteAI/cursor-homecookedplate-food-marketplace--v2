import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdminOnly } from '@/components/RoleGuard';
import { BackCircle } from '@/components/BackCircle';
import { GlassIconButton, GlassPressable } from '@/components/glass-surface';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { Colors, pagePastel } from '@/constants/colors';
import { trpc } from '@/lib/trpc';

type Plate = { id: string; name: string; description: string; image: string | null };
type ScreenName = { id: string; username: string };

function PlateEditor({ plate }: { plate: Plate }) {
  const [name, setName] = useState(plate.name);
  const [description, setDescription] = useState(plate.description);
  const save = trpc.admin.updateMonitorPlate.useMutation({
    onSuccess: () => Alert.alert('Saved', 'The plate text was updated.'),
    onError: (error) => Alert.alert('Plate', error.message),
  });

  return (
    <View style={styles.card}>
      {plate.image ? <Image source={{ uri: plate.image }} style={styles.photo} /> : null}
      <Text style={styles.label}>Plate name</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
      <Text style={styles.label}>Plate text</Text>
      <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} multiline />
      <GlassPressable
        style={styles.save}
        disabled={save.isPending}
        onPress={() => save.mutate({ mealId: plate.id, name, description })}
      >
        <Text style={styles.saveText}>{save.isPending ? 'Saving' : 'Save plate text'}</Text>
      </GlassPressable>
    </View>
  );
}

function NameEditor({ account }: { account: ScreenName }) {
  const [username, setUsername] = useState(account.username);
  const save = trpc.admin.updateScreenName.useMutation({
    onSuccess: () => Alert.alert('Saved', 'The screen name was updated.'),
    onError: (error) => Alert.alert('Screen name', error.message),
  });

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Screen name</Text>
      <TextInput value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />
      <GlassPressable
        style={styles.save}
        disabled={save.isPending}
        onPress={() => save.mutate({ userId: account.id, username })}
      >
        <Text style={styles.saveText}>{save.isPending ? 'Saving' : 'Save screen name'}</Text>
      </GlassPressable>
    </View>
  );
}

export default function AdminMonitorScreen() {
  const leave = useLeaveScreen('/(tabs)/profile');
  const scrollRef = useRef<ScrollView>(null);
  const plates = trpc.admin.listMonitorPlates.useQuery();
  const names = trpc.admin.listScreenNames.useQuery();

  return (
    <AdminOnly>
      <SafeAreaView style={styles.safe} testID="admin-monitor">
        <Stack.Screen options={{ title: 'Monitor admin', headerShown: false }} />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BackCircle tone="honey" onPress={leave} testID="admin-monitor-back" />
          <Text style={styles.title}>Monitor admin</Text>
          <Text style={styles.note}>
            Review plate images and edit screen names and plate text. Price and published stay as they are. The cook is told. Prices, payouts, and personal account details stay with the main admin.
          </Text>
          {plates.isLoading || names.isLoading ? <ActivityIndicator color={Colors.gray[700]} /> : null}
          <Text style={styles.section}>Plate images and text</Text>
          {(plates.data ?? []).map((plate) => <PlateEditor key={plate.id} plate={plate} />)}
          <Text style={styles.section}>Screen names</Text>
          {(names.data ?? []).map((account) => <NameEditor key={account.id} account={account} />)}
        </ScrollView>
        <View style={styles.jumps} pointerEvents="box-none">
          <GlassIconButton
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            accessibilityLabel="Scroll to top"
            tint="rgba(232, 176, 22, 0.92)"
          >
            <Ionicons name="chevron-up" size={22} color={Colors.gray[900]} />
          </GlassIconButton>
          <GlassIconButton
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            accessibilityLabel="Scroll to bottom"
            tint="rgba(232, 176, 22, 0.92)"
          >
            <Ionicons name="chevron-down" size={22} color={Colors.gray[900]} />
          </GlassIconButton>
        </View>
      </SafeAreaView>
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pagePastel.purple },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  jumps: { position: 'absolute', right: 16, bottom: 16, gap: 10 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginTop: 8 },
  note: { color: Colors.gray[700], lineHeight: 20, marginTop: 8, marginBottom: 16 },
  section: { fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 12 },
  photo: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  label: { color: Colors.gray[600], marginBottom: 4 },
  input: { backgroundColor: Colors.gray[50], borderRadius: 10, padding: 10, color: Colors.gray[900], marginBottom: 8 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  save: { backgroundColor: Colors.gray[900], borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveText: { color: Colors.white, fontWeight: '700' },
});
