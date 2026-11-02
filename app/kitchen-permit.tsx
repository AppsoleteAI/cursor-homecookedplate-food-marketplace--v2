import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SellerOnly } from '@/components/RoleGuard';
import { BackCircle } from '@/components/BackCircle';
import { GradientButton } from '@/components/GradientButton';
import { SectionAgreementFields } from '@/components/SectionAgreementFields';
import { Colors, pagePastel } from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { EMPTY_SECTION_AGREEMENT, sectionAgreementFromUnknown, sectionAgreementReady, type SectionAgreement } from '@/lib/section-agreement';

export default function KitchenPermitScreen() {
  const current = trpc.meals.kitchenPermit.useQuery();
  const savePermit = trpc.meals.saveKitchenPermit.useMutation();
  const [draft, setDraft] = useState<SectionAgreement>(EMPTY_SECTION_AGREEMENT);

  useEffect(() => {
    const saved = sectionAgreementFromUnknown(current.data?.permit);
    if (saved) setDraft(saved);
  }, [current.data?.permit]);

  const save = async () => {
    try {
      await savePermit.mutateAsync({
        readFoodInformation: draft.readFoodInformation,
        readStateInformation: draft.readStateInformation,
        acceptsLocalRules: draft.acceptsLocalRules,
        acceptsAllLiability: draft.acceptsAllLiability,
        waivesPlatformLiability: draft.waivesPlatformLiability,
        maintainsCommissaryAccess: draft.maintainsCommissaryAccess,
      });
      await current.refetch();
      Alert.alert('Agreement saved', 'Cooked plates can go on the menu after the rest of the plate is saved.');
      router.replace('/(tabs)/dashboard' as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The agreement was not saved.';
      Alert.alert('Home kitchen', message);
    }
  };

  return (
    <SellerOnly>
      <SafeAreaView style={styles.screen} testID="kitchen-permit">
        <Stack.Screen options={{ headerShown: false, title: 'Home kitchen agreement' }} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackCircle tone="honey" onPress={() => router.back()} testID="kitchen-permit-back" />
          <Text style={styles.title}>Home kitchen agreement</Text>
          <SectionAgreementFields value={draft} onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))} testID="permit" />
          {current.data && !current.data.saved ? <Text style={styles.block}>{current.data.blocks[0]}</Text> : null}
          <GradientButton
            title={savePermit.isPending ? 'Saving…' : 'Save agreement'}
            onPress={save}
            disabled={savePermit.isPending || !sectionAgreementReady(draft)}
            loading={savePermit.isPending}
            testID="permit-save"
          />
        </ScrollView>
      </SafeAreaView>
    </SellerOnly>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pagePastel.red },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  block: { color: Colors.gradient.red, marginBottom: 12 },
});
