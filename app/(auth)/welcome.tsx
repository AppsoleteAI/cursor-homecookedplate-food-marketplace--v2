import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthGreen } from '@/constants/auth-palette';
import { AuthBackButton, AuthGoldButton } from '@/components/auth/AuthChrome';

type Role = 'platetaker' | 'platemaker';

const STEPS = ['Benefits', 'Membership', 'Cottage food'];

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'restaurant-outline',
    title: 'Plates from home kitchens',
    body: 'Order meals cooked by people in your metro, not from a restaurant chain.',
  },
  {
    icon: 'flame-outline',
    title: 'Cook on your schedule',
    body: 'PlateMakers set their own prices and the hours they are available.',
  },
  {
    icon: 'card-outline',
    title: 'Pay in the app',
    body: 'Orders and payouts stay on HomeCookedPlate.',
  },
  {
    icon: 'location-outline',
    title: 'Stay local',
    body: 'Your metro decides which plates you can order and where you can cook.',
  },
];

function roleParam(value: string | string[] | undefined): Role | undefined {
  const raw = typeof value === 'string' ? value : undefined;
  return raw === 'platetaker' || raw === 'platemaker' ? raw : undefined;
}

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const role = roleParam(params.role);
  const [step, setStep] = useState(0);

  const continueForward = () => {
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    router.push({
      pathname: '/(auth)/onboarding',
      params: role ? { role } : {},
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AuthBackButton
            onPress={() => {
              if (step === 0) {
                router.back();
                return;
              }
              setStep((current) => current - 1);
            }}
          />

          <Text style={styles.brand}>HomeCookedPlate</Text>
          <View style={styles.steps}>
            {STEPS.map((label, index) => (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, index <= step && styles.stepDotOn]} />
                <Text style={[styles.stepLabel, index === step && styles.stepLabelOn]}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sheet}>
            <View style={styles.panel}>
              {step === 0 ? (
                <>
                  <Text style={styles.panelTitle}>Home-cooked plates, near you</Text>
                  <Text style={styles.help}>
                    HomeCookedPlate is a marketplace for meals cooked in home kitchens. Order a plate, or start cooking.
                  </Text>
                  {BENEFITS.map((item) => (
                    <View key={item.title} style={styles.benefit}>
                      <Ionicons name={item.icon} size={22} color={AuthGreen.gold} />
                      <View style={styles.benefitCopy}>
                        <Text style={styles.benefitTitle}>{item.title}</Text>
                        <Text style={styles.benefitBody}>{item.body}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Text style={styles.panelTitle}>Membership</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>$4.99</Text>
                    <Text style={styles.pricePeriod}>/ month</Text>
                  </View>
                  <Text style={styles.help}>
                    Premium is $4.99 a month after any free period.
                  </Text>
                  <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>Early Bird</Text>
                    <Text style={styles.checkText}>
                      Early Bird is 90 days of Premium at no charge. It is free early access, open while your metro still has a spot. Each metro has a limited number of Early Bird places for people ordering plates and for people cooking.
                    </Text>
                    <Text style={styles.checkText}>
                      A payment method starts those 90 days. The $4.99 charge begins after they end. Cancel before then and you are not charged.
                    </Text>
                    <Text style={styles.checkText}>
                      Outside an active metro, Early Bird is not available.
                    </Text>
                  </View>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Text style={styles.panelTitle}>Cottage food rules</Text>
                  <Text style={styles.help}>
                    What a home kitchen may sell is not the same in every state.
                  </Text>
                  <View style={styles.benefit}>
                    <Ionicons name="map-outline" size={22} color={AuthGreen.gold} />
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>State by state</Text>
                      <Text style={styles.benefitBody}>
                        Each state sets its own cottage food rules. A county or city can add permits, a food-handler card, sales limits, and labeling rules on top of the state law.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.benefit}>
                    <Ionicons name="person-outline" size={22} color={AuthGreen.gold} />
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>You check your own rules</Text>
                      <Text style={styles.benefitBody}>
                        HomeCookedPlate does not verify compliance. PlateMakers are responsible for the local, county, state, and federal food laws where they cook.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.notice}>
                    <Text style={styles.checkText}>
                      Review the rules for your state at{' '}
                      <Text
                        style={styles.link}
                        onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
                      >
                        cottagefoodlaws.com
                      </Text>
                      .
                    </Text>
                    <Text style={styles.noticeNote}>
                      HomeCookedPlate is not affiliated or in partnership with cottagefoodlaws.com.
                    </Text>
                    <Text style={styles.checkText}>
                      Alcoholic meals, pastries, and drinks are not allowed on this app.
                    </Text>
                  </View>
                </>
              ) : null}

              <AuthGoldButton
                title={step === 2 ? 'Continue to your account' : 'Continue'}
                onPress={continueForward}
                testID={step === 2 ? 'welcome-continue-account' : 'welcome-continue'}
                style={styles.action}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthGreen.bg,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  brand: {
    color: AuthGreen.gold,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginBottom: 16,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginBottom: 16,
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3D5C52',
  },
  stepDotOn: {
    backgroundColor: AuthGreen.gold,
  },
  stepLabel: {
    color: AuthGreen.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  stepLabelOn: {
    color: AuthGreen.gold,
  },
  sheet: {
    backgroundColor: AuthGreen.cream,
    borderRadius: 28,
    padding: 14,
  },
  panel: {
    backgroundColor: AuthGreen.panel,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  panelTitle: {
    color: AuthGreen.white,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  help: {
    color: AuthGreen.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  benefitCopy: {
    flex: 1,
  },
  benefitTitle: {
    color: AuthGreen.cream,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  benefitBody: {
    color: AuthGreen.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 8,
  },
  price: {
    color: AuthGreen.gold,
    fontSize: 40,
    fontWeight: '700',
  },
  pricePeriod: {
    color: AuthGreen.cream,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 6,
  },
  notice: {
    borderWidth: 1,
    borderColor: AuthGreen.fieldLine,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  noticeTitle: {
    color: AuthGreen.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  checkText: {
    color: AuthGreen.cream,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: AuthGreen.gold,
    fontWeight: '700',
  },
  noticeNote: {
    color: AuthGreen.muted,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  action: {
    marginTop: 8,
  },
});
