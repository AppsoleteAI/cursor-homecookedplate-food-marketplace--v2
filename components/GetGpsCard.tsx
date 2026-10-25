import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { readDeviceCoordinates } from '@/lib/device-coordinates';
import { nearestMetro } from '@/backend/lib/metro-radius';
import { trpc } from '@/lib/trpc';

function tell(message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert('Get GPS', message);
}

/** Cook tap. Saves this metro now. A background visit still waits 30 minutes. */
export function GetGpsCard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const locate = trpc.membership.locate.useMutation();
  const [busy, setBusy] = useState(false);
  const [seenMetro, setSeenMetro] = useState<string | null>(null);
  if (user?.role !== 'platemaker') return null;

  const onPress = async () => {
    setBusy(true);
    let city: string | null = null;
    try {
      const read = await readDeviceCoordinates(true);
      if (read.status === 'denied') {
        tell('Location is off. Allow it, then tap Get GPS again. The saved metro stays until that check finishes.');
        return;
      }
      if (read.status === 'imprecise') {
        tell('This reading is not precise enough. Allow precise location, then tap Get GPS again. The saved metro stays.');
        return;
      }
      if (read.status !== 'ready') {
        tell('This device could not read a location. Tap Get GPS again. The saved metro stays.');
        return;
      }
      city = nearestMetro(read.point.lat, read.point.lng)?.name ?? null;
      if (city) setSeenMetro(city);
      const found = await locate.mutateAsync({ ...read.point, mode: 'commit' });
      await utils.auth.me.invalidate();
      const named = found.metroArea && found.metroArea !== 'Remote/Other' ? found.metroArea : city;
      if (named) setSeenMetro(named);
      if (found.reason === 'outside' && !named) {
        tell('That point is outside every 50-mile metro. The saved metro stays.');
        return;
      }
      if (found.reason === 'paused') {
        tell('That metro is paused. The saved metro stays.');
        return;
      }
      if (!named) {
        tell('The metro check did not finish. Tap Get GPS again.');
        return;
      }
      tell(`This kitchen is in ${named}.`);
    } catch {
      tell(city
        ? `You are in ${city}. Tap Get GPS again to save it on this account.`
        : 'The metro check did not finish. Tap Get GPS again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => {
        onPress().catch(() => undefined);
      }}
      disabled={busy}
      testID="get-gps"
      accessibilityRole="button"
      style={styles.card}
    >
      <View style={styles.titleRow}>
        <Ionicons name="locate" size={20} color={Colors.gradient.green} />
        <Text style={styles.title}>{busy ? 'Checking this metro' : 'Get GPS'}</Text>
      </View>
      <Text style={styles.body}>
        {seenMetro || (user?.metroArea && user.metroArea !== 'Remote/Other' ? user.metroArea : null) || 'Not set'}. Each metro has a 50 mile radius. This tap saves the metro. A drive-through waits 30 minutes.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.gray[900],
    fontWeight: '600',
  },
  body: {
    color: Colors.gray[600],
    paddingTop: 14,
    paddingBottom: 14,
  },
});
