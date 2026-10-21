import React, { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { GlassPressable } from '@/components/glass-surface';
import { useAuth } from '@/hooks/auth-context';
import { readDeviceCoordinates } from '@/lib/device-coordinates';
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
  if (user?.role !== 'platemaker') return null;

  const onPress = async () => {
    setBusy(true);
    try {
      const coords = await readDeviceCoordinates(true);
      if (!coords) {
        tell('Location is off. Allow it, then tap Get GPS again. The saved metro stays until that check finishes.');
        return;
      }
      const found = await locate.mutateAsync({ ...coords, mode: 'commit' });
      await utils.auth.me.invalidate();
      if (found.reason === 'outside') {
        tell('That point is outside every 50-mile metro. The saved metro stays.');
        return;
      }
      if (found.reason === 'paused') {
        tell('That metro is paused. The saved metro stays.');
        return;
      }
      if (found.reason === 'lookup_failed') {
        tell('The metro check did not finish. Tap Get GPS again.');
        return;
      }
      tell(`This kitchen is in ${found.metroArea}.`);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '';
      tell(message || 'The metro check did not finish. Tap Get GPS again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassPressable onPress={onPress} disabled={busy} testID="get-gps" style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="navigate-outline" size={20} color={Colors.gradient.green} />
        <Text style={{ color: Colors.gray[900], fontWeight: '600' }}>{busy ? 'Checking this metro' : 'Get GPS'}</Text>
      </View>
      <Text style={{ color: Colors.gray[600], marginTop: 4 }}>
        {user?.metroArea || 'Remote/Other'}. Each metro has a 50 mile radius. This tap saves the metro. A drive-through waits 30 minutes.
      </Text>
    </GlassPressable>
  );
}
