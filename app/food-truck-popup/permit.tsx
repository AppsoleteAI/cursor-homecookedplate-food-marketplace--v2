import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { FoodTruckScreen } from '@/components/food-truck/FoodTruckScreen';
import { SectionAgreementFields } from '@/components/SectionAgreementFields';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useFoodTruck } from '@/hooks/food-truck-store';
import { evaluateTruckPermit } from '@/lib/food-truck-permit';
import { EMPTY_SECTION_AGREEMENT, sectionAgreementFromUnknown, sectionAgreementReady } from '@/lib/section-agreement';

export default function TruckPermitScreen() {
  const sellerGate = useSellerGate();
  const { permit, savePermit } = useFoodTruck();
  const [draft, setDraft] = useState(sectionAgreementFromUnknown(permit) ?? EMPTY_SECTION_AGREEMENT);
  const [blocks, setBlocks] = useState<string[]>([]);

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const check = evaluateTruckPermit(next);
    if (!check.ok) {
      setBlocks(check.blocks);
      return;
    }
    savePermit(next);
    router.replace('/food-truck-popup/seller' as Href);
  };

  if (sellerGate) return sellerGate;

  return (
    <FoodTruckScreen title="Truck agreement" subtitle="The food rules for this window belong to the cook." testID="truck-permit">
      <SectionAgreementFields value={draft} onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))} testID="truck-agreement" />
      {blocks.map((block) => <Text key={block} style={styles.block}>{block}</Text>)}
      <GlassPressable style={[styles.button, !sectionAgreementReady(draft) && styles.buttonOff]} disabled={!sectionAgreementReady(draft)} onPress={save} testID="truck-agreement-save">
        <Text style={styles.buttonText}>Save agreement</Text>
      </GlassPressable>
    </FoodTruckScreen>
  );
}

const styles = StyleSheet.create({
  block: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  button: { ...glassSurface, backgroundColor: '#C2410C', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
