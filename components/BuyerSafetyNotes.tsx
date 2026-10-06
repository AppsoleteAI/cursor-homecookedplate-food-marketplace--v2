import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { BUYER_AFTER_NOTE, BUYER_FOOD_NOTE, BUYER_MEETING_NOTE } from '@/lib/buyer-safety';

const NOTES = {
  food: { title: 'What’s in the food', body: BUYER_FOOD_NOTE },
  meeting: { title: 'Meeting', body: BUYER_MEETING_NOTE },
  after: { title: 'When you have it', body: BUYER_AFTER_NOTE },
} as const;

type NoteId = keyof typeof NOTES;

export function BuyerSafetyNotes({ which = ['food', 'meeting', 'after'] }: { which?: NoteId[] }) {
  return (
    <View style={styles.wrap} testID="buyer-safety-notes">
      {which.map((id) => (
        <View key={id} style={styles.note}>
          <Text style={styles.title}>{NOTES[id].title}</Text>
          <Text style={styles.body}>{NOTES[id].body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  note: { backgroundColor: '#F8F5EF', borderRadius: 12, padding: 12 },
  title: { color: Colors.gray[900], fontWeight: '700', marginBottom: 4 },
  body: { color: Colors.gray[700], lineHeight: 20 },
});
