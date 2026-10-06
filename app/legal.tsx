import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router , type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthGreen } from '@/constants/auth-palette';
import { AuthBackButton, AuthGoldButton } from '@/components/auth/AuthChrome';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import {
  allSectionsAgreed,
  emptyLegalSections,
  parseEnteredDate,
  readLegalAgreement,
  todayDisplay,
  todayStamp,
  toCompletedLegalAgreement,
  writeLegalAgreement,
  type LegalSectionId,
} from '@/lib/legal-agreement';

const FINAL_AGREEMENT =
  'By entering today\'s date below, I acknowledge that I have read this Legal & Safety page in full. I confirm that I have checked each section above as my separate agreement to that section. I agree to be bound by the jurisdictional notices, delivery and safety rules, liability waivers, personal-information terms, allergy and food-safety disclaimers, fee terms, and account-termination rules stated on this page. I understand that the date I enter is my signed record of this agreement with HomeCookedPlate and its Appsolete affiliates, and that I may not use the app until this acknowledgment is complete.';

export default function LegalScreen() {
  const { session } = useAuth();
  const saveAgreement = trpc.auth.updateProfile.useMutation();
  const [sections, setSections] = useState(emptyLegalSections);
  const [dateText, setDateText] = useState('');
  const [recordedOn, setRecordedOn] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    readLegalAgreement().then((record) => {
      if (!record) return;
      setSections({ ...emptyLegalSections(), ...record.sections });
      const [year, month, day] = record.acknowledgedOn.split('-');
      if (year && month && day) setDateText(`${month}/${day}/${year}`);
      setRecordedOn(record.acknowledgedOn);
    });
  }, []);

  const toggle = (id: LegalSectionId) => {
    if (recordedOn) return;
    setSections((current) => ({ ...current, [id]: !current[id] }));
    setNotice(null);
  };

  const confirmAcknowledgment = async () => {
    if (!allSectionsAgreed(sections)) {
      setNotice('Check every section on this page before confirming.');
      return;
    }
    const acknowledgedOn = parseEnteredDate(dateText);
    if (!acknowledgedOn || acknowledgedOn !== todayStamp()) {
      setNotice(`Enter today's date, ${todayDisplay()}, to confirm this acknowledgment.`);
      return;
    }

    const record = toCompletedLegalAgreement({
      sections,
      acknowledgedOn,
      acknowledgedAt: new Date().toISOString(),
    });
    if (!record) {
      setNotice('Check every section and enter today\'s date before confirming.');
      return;
    }
    await writeLegalAgreement(record);
    setRecordedOn(acknowledgedOn);

    if (session) {
      try {
        await saveAgreement.mutateAsync({ legalSafetyAgreement: record });
        setNotice('Your acknowledgment is recorded on your account.');
      } catch (error) {
        console.error('[Legal] Failed to store agreement', error);
        setNotice('Your acknowledgment is saved on this device. It will be added to your account when you sign in.');
      }
    } else {
      setNotice('Your acknowledgment is saved on this device. It will be added to your account when you sign in.');
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="legal-safe-area">
      <Stack.Screen
        options={{
          title: 'Legal & Safety',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} testID="legal-scroll" keyboardShouldPersistTaps="handled">
        <View style={styles.content} testID="legal-content">
          <AuthBackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} />
          <Text style={styles.brand}>Legal & Safety</Text>
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={24} color={AuthGreen.goldDeep} />
            <Text style={styles.warningTitle}>Important Legal Information</Text>
            <Text style={styles.warningText}>
              Check each section, then enter today&apos;s date to acknowledge this page.
            </Text>
          </View>

          <LegalSection id="jurisdictional_law" checked={sections.jurisdictional_law} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color={AuthGreen.goldDeep} />
              <Text style={styles.sectionTitle}>Jurisdictional Law</Text>
            </View>
            <Text style={styles.sectionText}>
              WARNING: Check your local jurisdictions for all laws and regulations related to food service, meal safety, commercial-grade commissary kitchens and cottage food operations. HomeCookedPlate does not verify compliance with local laws.
            </Text>
          </LegalSection>

          <LegalSection id="delivery_safety" checked={sections.delivery_safety} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color={AuthGreen.goldDeep} />
              <Text style={styles.sectionTitle}>Delivery & Safety</Text>
            </View>
            <Text style={styles.sectionText}>
              STRICT POLICY: Hand-crafted meals should be exchanged in a public setting during daylight hours. If offering prepaid deliveries, a chaperone must accompany the PlateMaker, strictly.
            </Text>
          </LegalSection>

          <LegalSection id="liability_waiver" checked={sections.liability_waiver} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={20} color={AuthGreen.goldDeep} />
              <Text style={styles.sectionTitle}>Liability Waiver</Text>
            </View>
            <Text style={styles.sectionText}>
              By utilizing, ordering and consuming items from our PlateMakers on HomeCookedPlate, you waive your right to any legal action against the owner of HomeCookedPlate, as is allowed by law. Furthermore, you waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any in-person or online / virtual meeting exchanges that you conduct while utilizing this app.
            </Text>
          </LegalSection>

          <LegalSection id="legal_safety_financial" checked={sections.legal_safety_financial} onToggle={toggle}>
            <View style={styles.sectionHeader} testID="personal-info-waiver-section">
              <Ionicons name="shield-checkmark" size={20} color={AuthGreen.goldDeep} />
              <Text style={styles.sectionTitle}>Legal, Safety, and Financial Integration</Text>
            </View>
            <View style={styles.noticeBox} accessibilityRole="text" testID="personal-info-waiver-text">
              <Text style={styles.noticeText}>
                {`"By utilizing, ordering and consuming items from our PlateMakers on HomeCookedPlate, you agree to not exchange phone numbers or personal information via online food exchanges or during app ordering / communications. You personally accept all responsibility if you give any other person your personal information through the HomeCookedPlate app or any other Appsolete affiliated portal. You waive any right to hold HomeCookedPlate app or any other Appsolete affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any in-person or online / virtual meeting exchanges that you conduct while utilizing this app."`}
              </Text>
            </View>
          </LegalSection>

          <LegalSection id="allergy_food_safety" checked={sections.allergy_food_safety} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color={AuthGreen.goldDeep} />
              <Text style={styles.sectionTitle}>Allergy & Food Safety</Text>
            </View>
            <Text style={styles.sectionText}>
              DISCLAIMER: HomeCookedPlate is a marketplace. PlateMakers are solely responsible for listing accurate ingredients for allergy awareness and the PlateMakers are solely responsible for ensuring food safety, proper temperature, expiration dates and prep time documentation, as well as compliance with all local, county, state and federal laws. NO ALCOHOLIC meals, pastries or beverages are permitted to be offered, sold or in any way distributed through the HomeCookedPlate app, including any illicit or illegal items. Any and all violations will result in a permanently banned account.
            </Text>
            <Text style={styles.sectionText}>
              Cottage food laws apply to homemade, non-TCS, shelf-stable foods sold by the maker directly to the consumer. A cooked plate that must be kept hot or cold is not a cottage food. Whole produce is a farm product, not a cottage food. Eggs, meat, and dairy follow their own licenses. FarmGrownBasket is the section for farm, garden, and co-op goods. Before any of those goods are listed, the seller records the state and county rule, the testing protocol, and the permit fee from their own agency. HomeCookedPlate does not verify those three.
            </Text>
            <TouchableOpacity onPress={() => router.push('/farm-grown-basket/cottage-law' as Href)} testID="legal-cottage-law">
              <Text style={styles.sectionText}>Open the FarmGrownBasket cottage food checklist.</Text>
            </TouchableOpacity>
            <Text style={styles.sectionText}>
              A food truck is a licensed mobile food unit. Cottage food law does not cover it. FoodTruckPopup orders are picked up at the service window. Before a truck menu goes live, the owner records the health permit for the city where the window opens, the commissary answer, and the permit fee from that agency.
            </Text>
            <TouchableOpacity onPress={() => router.push('/food-truck-popup/permit' as Href)} testID="legal-food-truck">
              <Text style={styles.sectionText}>Open the FoodTruckPopup mobile permit checklist.</Text>
            </TouchableOpacity>
            <Text style={styles.sectionText}>
              SitDownDelicious is for fully licensed, independently owned restaurants and small food shops, including coffee, yogurt, ice cream, and diners. Franchises and corporate chains are not listed. Cottage food law and a mobile-unit permit do not cover this kitchen. Before a menu goes live, the owner records the retail food permit for the street address, the inspection note, and the permit fee from that agency.
            </Text>
            <TouchableOpacity onPress={() => router.push('/sit-down-delicious/license' as Href)} testID="legal-sit-down">
              <Text style={styles.sectionText}>Open the SitDownDelicious retail food license checklist.</Text>
            </TouchableOpacity>
          </LegalSection>

          <LegalSection id="fee_structure" checked={sections.fee_structure} onToggle={toggle}>
            <Text style={styles.sectionTitle}>Fee Structure</Text>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Service Fee (PlateTaker):</Text>
              <Text style={styles.feeValue}>+10% on top of meal price</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Platform Rake (PlateMaker):</Text>
              <Text style={styles.feeValue}>–10% deducted from payout</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Total Platform Revenue:</Text>
              <Text style={styles.feeValue}>~20% of transaction value</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>PlateMaker Payout:</Text>
              <Text style={styles.feeValue}>90% of listed meal price*</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Processing Fees:</Text>
              <Text style={styles.feeValue}>Included in buyer total</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Delivery Fees:</Text>
              <Text style={styles.feeValue}>Set by PlateMaker**</Text>
            </View>
            <Text style={styles.feeNote}>
              Example: $20 meal → PlateTaker pays $22.00 (+ 10%); PlateMaker receives $18.00 (– 10%). Platform retains $4.00 (~20%).{'\n'}
              *Before applicable taxes. **Or Delivery Service.
            </Text>
          </LegalSection>

          <LegalSection id="account_termination" checked={sections.account_termination} onToggle={toggle}>
            <Text style={styles.sectionTitle}>Account Termination</Text>
            <Text style={[styles.sectionText, { marginTop: 8 }]}>
              PlateTakers can be removed following multiple bans, chargebacks, or complaints. PlateMakers can be removed for multiple complaints, chargebacks, or failure to list ingredients, allergy information, or other health related information, accurately.
            </Text>
          </LegalSection>

          <View style={styles.finalCard}>
            <Text style={styles.finalTitle}>Final agreement and acknowledgment</Text>
            <Text style={styles.finalText}>{FINAL_AGREEMENT}</Text>
            <TextInput
              style={styles.dateInput}
              value={dateText}
              onChangeText={(value) => {
                setDateText(value);
                setNotice(null);
              }}
              editable={!recordedOn}
              placeholder={todayDisplay()}
              placeholderTextColor={AuthGreen.muted}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              testID="legal-acknowledgment-date"
            />
            {recordedOn ? null : (
              <AuthGoldButton
                title="Confirm acknowledgment"
                onPress={() => {
                  confirmAcknowledgment().catch(() => {
                    Alert.alert('Legal & Safety', 'The acknowledgment could not be saved. Try again.');
                  });
                }}
                loading={saveAgreement.isPending}
                testID="legal-confirm"
                style={styles.confirmButton}
              />
            )}
            {recordedOn ? (
              <Text style={styles.recorded}>Acknowledgment recorded for {dateText || recordedOn}.</Text>
            ) : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalSection({
  id,
  checked,
  onToggle,
  children,
}: {
  id: LegalSectionId;
  checked: boolean;
  onToggle: (id: LegalSectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionCheck}
        onPress={() => onToggle(id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`Agree to ${id.replace(/_/g, ' ')}`}
        testID={`legal-check-${id}`}
      >
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <Ionicons name="checkmark" size={14} color={AuthGreen.ink} /> : null}
        </View>
      </TouchableOpacity>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthGreen.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  brand: {
    color: AuthGreen.gold,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  warningCard: {
    backgroundColor: AuthGreen.panel,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthGreen.gold,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: AuthGreen.cream,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: AuthGreen.cream,
    borderRadius: 18,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 48,
    marginBottom: 12,
    position: 'relative',
  },
  sectionCheck: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AuthGreen.goldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthGreen.cream,
  },
  checkboxOn: {
    backgroundColor: AuthGreen.gold,
    borderColor: AuthGreen.goldDeep,
  },
  sectionBody: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthGreen.ink,
    flex: 1,
  },
  sectionText: {
    fontSize: 14,
    color: AuthGreen.ink,
    lineHeight: 22,
  },
  feeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4D8C4',
    gap: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: AuthGreen.ink,
    flex: 1,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: AuthGreen.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  feeNote: {
    fontSize: 12,
    color: AuthGreen.ink,
    marginTop: 8,
    lineHeight: 18,
  },
  noticeBox: {
    backgroundColor: '#E7DFD2',
    borderColor: AuthGreen.goldDeep,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  noticeText: {
    fontSize: 14,
    color: AuthGreen.ink,
    lineHeight: 22,
  },
  finalCard: {
    backgroundColor: AuthGreen.panel,
    borderRadius: 22,
    padding: 18,
    marginTop: 8,
  },
  finalTitle: {
    color: AuthGreen.gold,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  finalText: {
    color: AuthGreen.cream,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: AuthGreen.fieldLine,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 14,
    color: AuthGreen.white,
    fontSize: 16,
    marginBottom: 12,
  },
  confirmButton: {
    marginTop: 4,
  },
  recorded: {
    color: AuthGreen.gold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  notice: {
    color: AuthGreen.white,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
});
