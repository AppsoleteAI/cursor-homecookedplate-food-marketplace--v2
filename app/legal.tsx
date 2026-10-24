import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors } from '@/constants/auth-palette';
import { calculateDeliveryLevy, calculateOrderSplit, DELIVERY_PLATFORM_RATE } from '@/lib/fees';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { BUYER_AFTER_NOTE } from '@/lib/buyer-safety';
import { AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { BackCircle } from '@/components/BackCircle';
import { useLeaveScreen } from '@/hooks/use-leave-screen';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import { GlassTop } from '@/components/glass-surface';
import { ScrollJumps } from '@/components/ScrollJumps';
import {
  agreementFromUnknown,
  allSectionsAgreed,
  emptyLegalSections,
  parseEnteredDate,
  readLegalAgreement,
  todayDisplay,
  todayStamp,
  toCompletedLegalAgreement,
  writeLegalAgreement,
  type LegalAgreementRecord,
  type LegalSectionId,
} from '@/lib/legal-agreement';

const MEAL_EXAMPLE = calculateOrderSplit(20);
const DELIVERY_EXAMPLE = calculateDeliveryLevy(10);
const DELIVERY_PERCENT = Math.round(DELIVERY_PLATFORM_RATE * 100);

const FINAL_AGREEMENT =
  'By entering today\'s date below, I acknowledge that I have read this Legal & Safety page in full. I confirm that I have checked each section above as my separate agreement to that section. I agree to be bound by the jurisdictional notices, delivery and safety rules, liability waivers, personal-information terms, allergy and food-safety disclaimers, fee terms, and account-termination rules stated on this page. I understand that the date I enter is my signed record of this agreement with HomeCookedPlate and its Appsolete affiliates, and that I may not use the app until this acknowledgment is complete.';

export default function LegalScreen() {
  const leave = useLeaveScreen('/(auth)/login');
  const { session } = useAuth();
  const saveAgreement = trpc.auth.updateProfile.useMutation();
  const [sections, setSections] = useState(emptyLegalSections);
  const [dateText, setDateText] = useState('');
  const [recordedOn, setRecordedOn] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const accountAgreement = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(session),
    retry: false,
  });

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const applyRecord = (record: LegalAgreementRecord) => {
    setSections({ ...emptyLegalSections(), ...record.sections });
    const [year, month, day] = record.acknowledgedOn.split('-');
    if (year && month && day) setDateText(`${month}/${day}/${year}`);
    setRecordedOn(record.acknowledgedOn);
  };

  useEffect(() => {
    let active = true;
    readLegalAgreement().then(async (record) => {
      if (!active) return;
      if (toCompletedLegalAgreement(record) && record) {
        applyRecord(record);
        return;
      }
      const fromAccount = agreementFromUnknown(accountAgreement.data?.legalSafetyAgreement);
      if (!fromAccount) return;
      try {
        await writeLegalAgreement(fromAccount);
      } catch (error) {
        console.error('[Legal] Could not save the account agreement on this device', error);
      }
      if (!active) return;
      applyRecord(fromAccount);
    });
    return () => {
      active = false;
    };
  }, [accountAgreement.data]);

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
        setNotice('Your acknowledgment is recorded on your account. Returning to sign in.');
      } catch (error) {
        console.error('[Legal] Failed to store agreement', error);
        setNotice('Your acknowledgment is saved on this device. Returning to sign in.');
      }
    } else {
      setNotice('Your acknowledgment is saved on this device. Returning to sign in.');
    }
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      leave();
    }, 2000);
  };

  return (
    <AuthBackground>
    <SafeAreaView style={styles.container} testID="legal-safe-area">
      <Stack.Screen
        options={{
          title: 'Legal & Safety',
          headerShown: false,
        }}
      />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} testID="legal-scroll" keyboardShouldPersistTaps="handled">
        <View style={styles.content} testID="legal-content">
          <BackCircle tone="honey" onPress={leave} testID="legal-back" />
          <AuthBrand />
          <Text style={styles.brand}>Legal & Safety</Text>
          <View style={styles.warningCard}>
            <GlassTop />
            <Ionicons name="warning" size={24} color={AuthColors.maroon} />
            <Text style={styles.warningTitle}>Important Legal Information</Text>
            <Text style={styles.warningText}>
              Check each section, then enter today&apos;s date to acknowledge this page.
            </Text>
          </View>

          <LegalSection id="jurisdictional_law" checked={sections.jurisdictional_law} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color={AuthColors.maroon} />
              <Text style={styles.sectionTitle}>Jurisdictional Law</Text>
            </View>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                The cook is responsible for how the food is made. You are responsible for reading the ingredients, meeting safely, and deciding whether to eat what you pick up.
              </Text>
            </View>
          </LegalSection>

          <LegalSection id="delivery_safety" checked={sections.delivery_safety} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color={AuthColors.maroon} />
              <Text style={styles.sectionTitle}>Delivery & Safety</Text>
            </View>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                Meet in a public place during daylight. Do not exchange phone numbers in the app. If a prepaid delivery is agreed upon, we suggest the cook brings someone else along, for safety.
              </Text>
            </View>
          </LegalSection>

          <LegalSection id="liability_waiver" checked={sections.liability_waiver} onToggle={toggle}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={20} color={AuthColors.maroon} />
              <Text style={styles.sectionTitle}>Liability Waiver</Text>
            </View>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                By utilizing, ordering and consuming items from our PlateMakers on HomeCookedPlate, you waive your right to any legal action against the owner of HomeCookedPlate, as is allowed by law. Furthermore, you waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any in-person or online / virtual meeting exchanges that you conduct while utilizing this app.
              </Text>
            </View>
          </LegalSection>

          <LegalSection id="legal_safety_financial" checked={sections.legal_safety_financial} onToggle={toggle}>
            <View style={styles.sectionHeader} testID="personal-info-waiver-section">
              <Ionicons name="shield-checkmark" size={20} color={AuthColors.maroon} />
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
              <Ionicons name="information-circle" size={20} color={AuthColors.maroon} />
              <Text style={styles.sectionTitle}>Allergy & Food Safety</Text>
            </View>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                Ingredients and allergens are listed by the cook. Tell them about your allergies before you order. If something looks or smells wrong at pickup, do not eat it. Alcohol is not sold on HomeCookedPlate.
              </Text>
              <Text style={[styles.noticeText, styles.noticeFollow]}>
                {BUYER_AFTER_NOTE}
              </Text>
              <FoodHandlingLink color={AuthColors.maroon} />
            </View>
          </LegalSection>

          <LegalSection id="fee_structure" checked={sections.fee_structure} onToggle={toggle}>
            <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>Fee Structure</Text>
            <View style={styles.noticeBox}>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Service Fee (PlateTaker):</Text>
              <Text style={styles.feeValue}>+10% on top of the meal price. A Premium PlateTaker pays 5% on an order of $20 or more.</Text>
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
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Delivery platform fee:</Text>
              <Text style={styles.feeValue}>+{DELIVERY_PERCENT}% on the delivery amount</Text>
            </View>
            <Text style={styles.feeNote}>
              Example: $20 meal → PlateTaker pays ${MEAL_EXAMPLE.totalCaptured.toFixed(2)} (+ 10%). A Premium PlateTaker pays $21.00 on that $20 meal. PlateMaker receives ${MEAL_EXAMPLE.sellerPayout.toFixed(2)} (– 10%). Platform retains ${MEAL_EXAMPLE.appRevenue.toFixed(2)} (~20%).{'\n'}
              A $10 delivery → PlateTaker pays ${DELIVERY_EXAMPLE.buyerPays.toFixed(2)} (+ {DELIVERY_PERCENT}%); PlateMaker receives ${DELIVERY_EXAMPLE.sellerReceives.toFixed(2)}. Platform keeps ${DELIVERY_EXAMPLE.platformFee.toFixed(2)}.{'\n'}
              *Before applicable taxes. **The PlateMaker sets the delivery amount and receives it. Or a delivery service.
            </Text>
            </View>
          </LegalSection>

          <LegalSection id="account_termination" checked={sections.account_termination} onToggle={toggle}>
            <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>Account Termination</Text>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                PlateTakers can be removed following multiple bans, chargebacks, or complaints. PlateMakers can be removed for multiple complaints, chargebacks, or failure to list ingredients, allergy information, or other health related information, accurately.
              </Text>
            </View>
          </LegalSection>

          <View style={styles.finalCard}>
            <GlassTop />
            <Text style={styles.finalTitle}>Final agreement and acknowledgment</Text>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{FINAL_AGREEMENT}</Text>
            </View>
            <TextInput
              style={styles.dateInput}
              value={dateText}
              onChangeText={(value) => {
                setDateText(value);
                setNotice(null);
              }}
              editable={!recordedOn}
              placeholder={todayDisplay()}
              placeholderTextColor={AuthColors.placeholder}
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
      <ScrollJumps scrollRef={scrollRef} testID="legal" />
    </SafeAreaView>
    </AuthBackground>
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
      <GlassTop />
      <Pressable
        style={styles.sectionCheck}
        onPress={() => onToggle(id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`Agree to ${id.replace(/_/g, ' ')}`}
        testID={`legal-check-${id}`}
      >
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <Ionicons name="checkmark" size={14} color={AuthColors.ink} /> : null}
        </View>
      </Pressable>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 108,
  },
  brand: {
    color: AuthColors.ink,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'left',
    marginBottom: 16,
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  warningCard: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuthColors.maroon,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: AuthColors.ink,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: AuthColors.card,
    borderRadius: 18,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 48,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
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
    borderColor: AuthColors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxOn: {
    backgroundColor: AuthColors.button,
    borderColor: AuthColors.maroon,
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
    color: AuthColors.ink,
    flex: 1,
  },
  sectionTitleGap: {
    marginBottom: 12,
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
    color: AuthColors.ink,
    flex: 1,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: AuthColors.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  feeNote: {
    fontSize: 12,
    color: AuthColors.ink,
    marginTop: 8,
    lineHeight: 18,
  },
  noticeBox: {
    backgroundColor: AuthColors.field,
    borderColor: AuthColors.maroon,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
  },
  noticeText: {
    fontSize: 14,
    color: AuthColors.ink,
    lineHeight: 22,
  },
  noticeFollow: {
    marginTop: 8,
  },
  finalCard: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    padding: 18,
    marginTop: 8,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  finalTitle: {
    color: AuthColors.maroon,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  dateInput: {
    backgroundColor: AuthColors.field,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 14,
    color: AuthColors.ink,
    fontSize: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  confirmButton: {
    marginTop: 4,
  },
  recorded: {
    color: AuthColors.maroon,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  notice: {
    color: AuthColors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
});
