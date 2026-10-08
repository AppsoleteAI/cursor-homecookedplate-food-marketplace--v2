import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { Colors } from '@/constants/colors';
import { PREP_COOKS } from '@/constants/meal-prep-go';
import { stateName } from '@/lib/cottage-food';

export default function MealPrepCooksScreen() {
  return (
    <MealPrepScreen title="Cooks" subtitle="Each cook publishes one week." testID="prep-cooks">
      {PREP_COOKS.map((cook) => (
        <GlassPressable key={cook.id} style={styles.card} onPress={() => router.push(`/meal-prep-go/cook/${cook.id}` as Href)} testID={`cook-card-${cook.id}`}>
          <Text style={styles.name}>{titleCase(cook.name)}</Text>
          <Text style={[styles.status, cook.accepting ? styles.open : styles.closed]}>
            {cook.accepting ? 'Accepting this week' : 'Not accepting'}
          </Text>
          <Text style={styles.meta}>{cook.city}, {stateName(cook.stateCode)} · {cook.weekLabel}</Text>
          <Text style={styles.summary}>{cook.summary}</Text>
        </GlassPressable>
      ))}
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  card: { ...glassSurface, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10  },
  name: { fontSize: 17, fontWeight: '700', color: Colors.gray[900] },
  status: { marginTop: 6, fontWeight: '700' },
  open: { color: '#166534' },
  closed: { color: '#9F1239' },
  meta: { color: Colors.gray[600], marginTop: 4 },
  summary: { color: Colors.gray[700], marginTop: 8, lineHeight: 20 },
});
