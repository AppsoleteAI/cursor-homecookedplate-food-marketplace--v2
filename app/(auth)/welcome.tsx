import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AuthColors } from '@/constants/auth-palette';
import { AuthBackButton, AuthBackground, AuthGoldButton } from '@/components/auth/AuthChrome';
import { BUYER_AFTER_NOTE, BUYER_FOOD_NOTE, BUYER_MEETING_NOTE } from '@/lib/buyer-safety';

type Role = 'platetaker' | 'platemaker';

const HOUSE_MARK = require('../../assets/house-mark.png');

const BENEFITS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: '🍽️',
    title: 'Plates from home kitchens',
    body: 'Order meals cooked by people in your metro, not from a restaurant chain.',
  },
  {
    emoji: '🔥',
    title: 'Cook on your schedule',
    body: 'PlateMakers set their own prices and the hours they are available.',
  },
  {
    emoji: '💳',
    title: 'Pay in the app',
    body: 'Orders and payouts stay on HomeCookedPlate.',
  },
  {
    emoji: '📍',
    title: 'Stay local',
    body: 'Your metro decides which plates you can order and where you can cook.',
  },
];

const WELCOME_SEEN_KEY = 'hcp_welcome_seen_v1';

function roleParam(value: string | string[] | undefined): Role | undefined {
  const raw = typeof value === 'string' ? value : undefined;
  return raw === 'platetaker' || raw === 'platemaker' ? raw : undefined;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function markWelcomeSeen() {
  AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => undefined);
}

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ role?: string | string[]; entry?: string | string[] }>();
  const role = roleParam(params.role);
  const isGate = firstParam(params.entry) === 'gate';
  const isMaker = role === 'platemaker';
  const stepLabels = ['Benefits', 'Membership', isMaker ? 'Cottage food' : 'Safety'];
  const [step, setStep] = useState(0);
  const [gate, setGate] = useState<'checking' | 'show' | 'login'>(isGate ? 'checking' : 'show');

  useEffect(() => {
    if (!isGate) return;
    let cancelled = false;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((value) => {
        if (!cancelled) setGate(value === '1' ? 'login' : 'show');
      })
      .catch(() => {
        if (!cancelled) setGate('show');
      });
    return () => {
      cancelled = true;
    };
  }, [isGate]);

  const goToSignIn = () => {
    markWelcomeSeen();
    router.replace('/(auth)/login');
  };

  const continueForward = () => {
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    markWelcomeSeen();
    router.push({
      pathname: '/(auth)/onboarding',
      params: role ? { role } : {},
    });
  };

  if (gate === 'checking') return null;
  if (gate === 'login') return <Redirect href="/(auth)/login" />;

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AuthBackButton
            onPress={() => {
              if (step > 0) {
                setStep((current) => current - 1);
                return;
              }
              if (router.canGoBack()) {
                router.back();
                return;
              }
              goToSignIn();
            }}
          />

          <View style={styles.brandRow}>
            <Image
              source={HOUSE_MARK}
              style={styles.brandMark}
              resizeMode="contain"
              tintColor={AuthColors.brand}
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.brand}>HomeCookedPlate</Text>
          </View>
          <View style={styles.steps}>
            {stepLabels.map((label, index) => (
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
                      <Text style={styles.benefitEmoji}>{item.emoji}</Text>
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

              {step === 2 && !isMaker ? (
                <>
                  <Text style={styles.panelTitle}>A few notes before you order</Text>
                  <Text style={styles.help}>
                    You are here to find food and eat it. These are the only safety notes on the ordering side.
                  </Text>
                  <View style={styles.benefit}>
                    <Text style={styles.benefitEmoji}>🥣</Text>
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>What’s in the food</Text>
                      <Text style={styles.benefitBody}>{BUYER_FOOD_NOTE}</Text>
                    </View>
                  </View>
                  <View style={styles.benefit}>
                    <Text style={styles.benefitEmoji}>👥</Text>
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>Meeting</Text>
                      <Text style={styles.benefitBody}>{BUYER_MEETING_NOTE}</Text>
                    </View>
                  </View>
                  <View style={styles.benefit}>
                    <Text style={styles.benefitEmoji}>⏱️</Text>
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>After you have it</Text>
                      <Text style={styles.benefitBody}>{BUYER_AFTER_NOTE}</Text>
                    </View>
                  </View>
                </>
              ) : null}

              {step === 2 && isMaker ? (
                <>
                  <Text style={styles.panelTitle}>Cottage food rules</Text>
                  <Text style={styles.help}>
                    What a home kitchen may sell is not the same in every state.
                  </Text>
                  <View style={styles.benefit}>
                    <Text style={styles.benefitEmoji}>🗺️</Text>
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>State by state</Text>
                      <Text style={styles.benefitBody}>
                        Each state sets its own cottage food rules. A county or city can add permits, a food-handler card, sales limits, and labeling rules on top of the state law.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.benefit}>
                    <Text style={styles.benefitEmoji}>👤</Text>
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
              {step === 0 ? (
                <TouchableOpacity onPress={goToSignIn} testID="welcome-sign-in" style={styles.signIn}>
                  <Text style={styles.signInText}>I already have an account</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const cardShadow = {
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.36)',
  shadowColor: '#461C06',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.22,
  shadowRadius: 14,
  elevation: 5,
} as const;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brandMark: {
    width: 46,
    height: 38,
  },
  brand: {
    color: AuthColors.brand,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    textShadowColor: 'rgba(70, 16, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
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
    backgroundColor: 'rgba(20,16,12,0.28)',
  },
  stepDotOn: {
    backgroundColor: AuthColors.brand,
  },
  stepLabel: {
    color: AuthColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  stepLabelOn: {
    color: AuthColors.white,
  },
  sheet: {
    backgroundColor: 'transparent',
  },
  panel: {
    backgroundColor: AuthColors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    ...cardShadow,
  },
  panelTitle: {
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  help: {
    color: AuthColors.muted,
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
  benefitEmoji: {
    width: 28,
    fontSize: 22,
    lineHeight: 26,
  },
  benefitCopy: {
    flex: 1,
  },
  benefitTitle: {
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  benefitBody: {
    color: AuthColors.muted,
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
    color: AuthColors.ink,
    fontSize: 40,
    fontWeight: '700',
  },
  pricePeriod: {
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 6,
  },
  notice: {
    borderWidth: 1,
    borderColor: 'rgba(72, 16, 30, 0.35)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  noticeTitle: {
    color: AuthColors.maroon,
    fontSize: 16,
    fontWeight: '700',
  },
  checkText: {
    color: AuthColors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: AuthColors.maroon,
    fontWeight: '700',
  },
  noticeNote: {
    color: AuthColors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  action: {
    marginTop: 8,
  },
  signIn: {
    marginTop: 14,
    alignItems: 'center',
  },
  signInText: {
    color: AuthColors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
});
