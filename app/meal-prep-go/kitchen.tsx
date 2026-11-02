import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Redirect, router, type Href } from 'expo-router';
import { MealPrepScreen } from '@/components/meal-prep/MealPrepScreen';
import { SectionAgreementFields } from '@/components/SectionAgreementFields';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { useMealPrep } from '@/hooks/meal-prep-store';
import { evaluatePrepKitchen } from '@/lib/meal-prep-go';
import { EMPTY_SECTION_AGREEMENT, sectionAgreementFromUnknown, sectionAgreementReady } from '@/lib/section-agreement';

export default function MealPrepKitchenScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { kitchen, saveKitchen } = useMealPrep();
  const [draft, setDraft] = useState(sectionAgreementFromUnknown(kitchen) ?? EMPTY_SECTION_AGREEMENT);
  const [blocks, setBlocks] = useState<string[]>([]);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isLoading && user?.role !== 'platemaker' && user?.isAdmin !== true) {
    return <Redirect href="/meal-prep-go" />;
  }

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const check = evaluatePrepKitchen(next);
    if (!check.ok) {
      setBlocks(check.blocks);
      return;
    }
    saveKitchen(next);
    router.replace('/meal-prep-go/seller' as Href);
  };

  return (
    <MealPrepScreen title="Weekly kitchen agreement" subtitle="The food rules for this week belong to the cook." testID="prep-kitchen">
      <SectionAgreementFields value={draft} onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))} testID="prep-agreement" />
      {blocks.map((block) => <Text key={block} style={styles.block}>{block}</Text>)}
      <GlassPressable style={[styles.button, !sectionAgreementReady(draft) && styles.buttonOff]} disabled={!sectionAgreementReady(draft)} onPress={save} testID="prep-agreement-save">
        <Text style={styles.buttonText}>Save agreement</Text>
      </GlassPressable>
    </MealPrepScreen>
  );
}

const styles = StyleSheet.create({
  block: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  button: { ...glassSurface, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
