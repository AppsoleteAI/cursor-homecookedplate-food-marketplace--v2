import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { FarmScreen } from '@/components/farm/FarmScreen';
import { SectionAgreementFields } from '@/components/SectionAgreementFields';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useFarmBasket } from '@/hooks/farm-basket-store';
import { evaluateListing } from '@/lib/cottage-food';
import { EMPTY_SECTION_AGREEMENT, sectionAgreementFromUnknown, sectionAgreementReady } from '@/lib/section-agreement';

export default function CottageLawScreen() {
  const sellerGate = useSellerGate();
  const { compliance, saveCompliance } = useFarmBasket();
  const [draft, setDraft] = useState(sectionAgreementFromUnknown(compliance) ?? EMPTY_SECTION_AGREEMENT);
  const [blocks, setBlocks] = useState<string[]>([]);

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const check = evaluateListing(next);
    if (!check.ok) {
      setBlocks(check.blocks);
      return;
    }
    saveCompliance(next);
    router.replace('/farm-grown-basket/seller' as Href);
  };

  if (sellerGate) return sellerGate;

  return (
    <FarmScreen title="Farm agreement" subtitle="The food rules for these goods belong to the cook." testID="farm-cottage-law">
      <SectionAgreementFields value={draft} onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))} testID="farm-agreement" />
      {blocks.map((block) => <Text key={block} style={styles.block}>{block}</Text>)}
      <GlassPressable style={[styles.button, !sectionAgreementReady(draft) && styles.buttonOff]} disabled={!sectionAgreementReady(draft)} onPress={save} testID="farm-agreement-save">
        <Text style={styles.buttonText}>Save agreement</Text>
      </GlassPressable>
    </FarmScreen>
  );
}

const styles = StyleSheet.create({
  block: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  button: { ...glassSurface, backgroundColor: '#166534', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
