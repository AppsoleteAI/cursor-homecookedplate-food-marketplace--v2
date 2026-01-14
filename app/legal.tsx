import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function LegalScreen() {
  return (
    <SafeAreaView style={styles.container} testID="legal-safe-area">
      <Stack.Screen
        options={{
          title: 'Legal & Safety',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} testID="legal-scroll">
        <View style={styles.content} testID="legal-content">
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={24} color={Colors.gradient.orange} />
            <Text style={styles.warningTitle}>Important Legal Information</Text>
            <Text style={styles.warningText}>
              Please read and understand all legal disclaimers before using HomeCookedPlate
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.gradient.green} />
              <Text style={styles.sectionTitle}>Jurisdictional Law</Text>
            </View>
            <Text style={styles.sectionText}>
              WARNING: Check your local jurisdictions for all laws and regulations related to food service, meal safety, commercial-grade commissary kitchens and cottage food operations. HomeCookedPlate does not verify compliance with local laws.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.gradient.yellow} />
              <Text style={styles.sectionTitle}>Delivery & Safety</Text>
            </View>
            <Text style={styles.sectionText}>
              STRICT POLICY: Hand-crafted meals should be exchanged in a public setting during daylight hours. If offering prepaid deliveries, a chaperone must accompany the PlateMaker, strictly.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={20} color={Colors.gradient.red} />
              <Text style={styles.sectionTitle}>Liability Waiver</Text>
            </View>
            <Text style={styles.sectionText}>
              By utilizing, ordering and consuming items from our PlateMakers on HomeCookedPlate, you waive your right to any legal action against the owner of HomeCookedPlate, as is allowed by law. Furthermore, you waive any right to hold HomeCookedPlate app or any other AppsoleteAI affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any in-person or online / virtual meeting exchanges that you conduct while utilizing this app.
            </Text>
          </View>

          <View style={styles.section} testID="personal-info-waiver-section">
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.gradient.green} />
              <Text style={styles.sectionTitle}>Legal, Safety, and Financial Integration (UPDATED)</Text>
            </View>
            <View style={styles.noticeBox} accessibilityRole="text" testID="personal-info-waiver-text">
              <Text style={styles.noticeText}>
                {`"By utilizing, ordering and consuming items from our PlateMakers on HomeCookedPlate, you agree to not exchange phone numbers or personal information via online food exchanges or during app ordering / communications. You personally accept all responsibility if you give any other person your personal information through the HomeCookedPlate app or any other Appsolete affiliated portal. You waive any right to hold HomeCookedPlate app or any other Appsolete affiliated business entity, investor or individual associated with HomeCookedPlate, liable for any in-person or online / virtual meeting exchanges that you conduct while utilizing this app."`}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.gradient.orange} />
              <Text style={styles.sectionTitle}>Allergy & Food Safety</Text>
            </View>
            <Text style={styles.sectionText}>
              DISCLAIMER: HomeCookedPlate is a marketplace. PlateMakers are solely responsible for listing accurate ingredients for allergy awareness and the PlateMakers are solely responsible for ensuring food safety, proper temperature, expiration dates and prep time documentation, as well as compliance with all local, county, state and federal laws. NO ALCOHOLIC meals, pastries or beverages are permitted to be offered, sold or in any way distributed through the HomeCookedPlate app, including any illicit or illegal items. Any and all violations will result in a permanently banned account.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fee Structure</Text>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Platform Commission:</Text>
              <Text style={styles.feeValue}>15% of transaction</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Processing Fees:</Text>
              <Text style={styles.feeValue}>Paid by PlateTakers</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Delivery Fees:</Text>
              <Text style={styles.feeValue}>Set by PlateMaker*</Text>
            </View>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>PlateMaker Payout:</Text>
              <Text style={styles.feeValue}>85% of meal price**</Text>
            </View>
            <Text style={{ fontSize: 12, color: Colors.gray[600], marginTop: 8 }}>*or Delivery Service, **minus taxes and/or other fees</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Termination</Text>
            <Text style={[styles.sectionText, { marginTop: 8 }]}>
              PlateTakers can be removed following multiple bans, chargebacks, or complaints. PlateMakers can be removed for multiple complaints, chargebacks, or failure to list ingredients, allergy information, or other health related information, accurately.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 24,
  },
  warningCard: {
    backgroundColor: Colors.gradient.orange + '10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: Colors.gray[700],
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  sectionText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 22,
  },
  feeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  feeLabel: {
    fontSize: 14,
    color: Colors.gray[700],
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  noticeBox: {
    backgroundColor: Colors.gray[50],
    borderColor: Colors.gray[200],
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  noticeText: {
    fontSize: 14,
    color: Colors.gray[800],
    lineHeight: 22,
  },
});