import React, { useState } from 'react';
import { Text, StyleSheet, TextInput } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { PREP_COOKS, cooksNearZip } from '@/constants/meal-prep-go';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { useAuth } from '@/hooks/auth-context';
import { stateName } from '@/lib/cottage-food';

export default function MealPrepBoardScreen() {
  const params = useLocalSearchParams<{ zip?: string }>();
  const initialZip = typeof params.zip === 'string' ? params.zip : '';
  const [zip, setZip] = useState(initialZip);
  const { kitchen, accepting, listings } = useMealPrep();
  const { user } = useAuth();
  const isMaker = user?.role === 'platemaker' || user?.isAdmin === true;
  const cooks = cooksNearZip(zip);
  const searching = zip.replace(/\D/g, '').length >= 3;
  const visible = (searching ? cooks : PREP_COOKS).filter((cook) => cook.accepting);

  return (
    <MealPrepScreen title="Open this week" subtitle="Accepting means a weekly order can be placed." testID="prep-board">
      <TextInput
        value={zip}
        onChangeText={setZip}
        placeholder="ZIP code"
        placeholderTextColor={Colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
        maxLength={5}
        testID="prep-board-zip"
      />
      <Text style={styles.note}>A cook who is not accepting is still listed under Cooks. This board is only the weeks that can be ordered now.</Text>
      {isMaker && kitchen ? (
        <GlassPressable style={styles.card} onPress={() => router.push('/meal-prep-go/cook/owner-kitchen' as Href)}>
          <Text style={styles.name}>{kitchen.cookName}</Text>
          <Text style={[styles.status, accepting ? styles.open : styles.closed]}>{accepting ? 'Accepting this week' : 'Not accepting'}</Text>
          <Text style={styles.meta}>{kitchen.city}, {stateName(kitchen.stateCode)} · {listings.length} item{listings.length === 1 ? '' : 's'}</Text>
        </GlassPressable>
      ) : null}
      <Text style={styles.section}>{searching ? 'Open cooks in this ZIP area' : 'On the board'}</Text>
      {visible.length === 0 ? <Text style={styles.note}>No cook is open for a week in that area.</Text> : null}
      {visible.map((cook) => (
        <GlassPressable key={cook.id} style={styles.card} onPress={() => router.push(`/meal-prep-go/cook/${cook.id}` as Href)} testID={`board-cook-${cook.id}`}>
          <Text style={styles.name}>{titleCase(cook.name)}</Text>
          <Text style={styles.statusOpen}>Accepting this week</Text>
          <Text style={styles.meta}>{cook.city}, {stateName(cook.stateCode)} · {cook.weekLabel}</Text>
          <Text style={styles.meta}>{cook.windows[0]?.place} · {cook.windows[0]?.hours}</Text>
        </GlassPressable>
      ))}
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  note: { color: Colors.gray[600], marginTop: 10, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: Colors.gray[900] },
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10  },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  status: { marginTop: 6, fontWeight: '700' },
  statusOpen: { marginTop: 6, fontWeight: '700', color: '#166534' },
  open: { color: '#166534' },
  closed: { color: '#9F1239' },
  meta: { color: Colors.gray[600], marginTop: 4 },
});
