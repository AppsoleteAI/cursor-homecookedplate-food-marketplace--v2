import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { CaterEventScreen } from '@/components/cater-event/CaterEventScreen';
import { SectionAgreementFields } from '@/components/SectionAgreementFields';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useCaterEvent } from '@/hooks/cater-event-store';
import { evaluateCaterLicense } from '@/lib/cater-event-license';
import { EMPTY_SECTION_AGREEMENT, sectionAgreementFromUnknown, sectionAgreementReady } from '@/lib/section-agreement';

export default function CaterLicenseScreen() {
  const sellerGate = useSellerGate();
  const { license, saveLicense } = useCaterEvent();
  const [draft, setDraft] = useState(sectionAgreementFromUnknown(license) ?? EMPTY_SECTION_AGREEMENT);
  const [blocks, setBlocks] = useState<string[]>([]);

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const check = evaluateCaterLicense(next);
    if (!check.ok) {
      setBlocks(check.blocks);
      return;
    }
    saveLicense(next);
    router.replace('/cater-event-deliver/seller' as Href);
  };

  if (sellerGate) return sellerGate;

  return (
    <CaterEventScreen title="Catering agreement" subtitle="The food rules for this kitchen belong to the cook." testID="cater-license">
      <SectionAgreementFields value={draft} onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))} testID="cater-agreement" />
      {blocks.map((block) => <Text key={block} style={styles.block}>{block}</Text>)}
      <GlassPressable style={[styles.button, !sectionAgreementReady(draft) && styles.buttonOff]} disabled={!sectionAgreementReady(draft)} onPress={save} testID="cater-agreement-save">
        <Text style={styles.buttonText}>Save agreement</Text>
      </GlassPressable>
    </CaterEventScreen>
  );
}

const styles = StyleSheet.create({
  block: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  button: { ...glassSurface, backgroundColor: '#7C2D12', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
