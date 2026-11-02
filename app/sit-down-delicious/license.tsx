import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { router, type Href } from 'expo-router';
import { SitDownScreen } from '@/components/sit-down/SitDownScreen';
import { SectionAgreementFields } from '@/components/SectionAgreementFields';
import { useSellerGate } from '@/components/RoleGuard';
import { Colors } from '@/constants/colors';
import { useSitDown } from '@/hooks/sit-down-store';
import { evaluateSitDownLicense } from '@/lib/sit-down-license';
import { EMPTY_SECTION_AGREEMENT, sectionAgreementFromUnknown, sectionAgreementReady } from '@/lib/section-agreement';

export default function SitLicenseScreen() {
  const sellerGate = useSellerGate();
  const { license, saveLicense } = useSitDown();
  const [draft, setDraft] = useState(sectionAgreementFromUnknown(license) ?? EMPTY_SECTION_AGREEMENT);
  const [blocks, setBlocks] = useState<string[]>([]);

  const save = () => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const check = evaluateSitDownLicense(next);
    if (!check.ok) {
      setBlocks(check.blocks);
      return;
    }
    saveLicense(next);
    router.replace('/sit-down-delicious/seller' as Href);
  };

  if (sellerGate) return sellerGate;

  return (
    <SitDownScreen title="Restaurant agreement" subtitle="The food rules for this kitchen belong to the cook." testID="sit-license">
      <SectionAgreementFields value={draft} onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))} testID="sit-agreement" />
      {blocks.map((block) => <Text key={block} style={styles.block}>{block}</Text>)}
      <GlassPressable style={[styles.button, !sectionAgreementReady(draft) && styles.buttonOff]} disabled={!sectionAgreementReady(draft)} onPress={save} testID="sit-agreement-save">
        <Text style={styles.buttonText}>Save agreement</Text>
      </GlassPressable>
    </SitDownScreen>
  );
}

const styles = StyleSheet.create({
  block: { color: '#9A3412', marginBottom: 8, lineHeight: 20 },
  button: { ...glassSurface, backgroundColor: '#9F1239', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
