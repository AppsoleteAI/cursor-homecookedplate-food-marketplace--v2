import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AuthColors, goldButtonColors, preAppFont } from '@/constants/auth-palette';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthBackButton, AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { OrderHoursSlogan } from '@/components/OrderHoursSlogan';
import { useAuth } from '@/hooks/auth-context';
import { SUBSCRIPTION_PRICES } from '@/backend/lib/fees';
import { PLATEMAKER_LOST_DISPUTE_SIGNUP, PLATETAKER_LOST_DISPUTE_SIGNUP } from '@/backend/lib/payout-policy';
import { BUYER_AFTER_NOTE, BUYER_FOOD_NOTE, BUYER_MEETING_NOTE } from '@/lib/buyer-safety';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, GlassTop, glassSurface } from '@/components/glass-surface';

type Role = 'platetaker' | 'platemaker';

const ACCOUNT_KEY = 'hcp_has_account';

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

const MEMBERSHIP_PRICES: { id: string; caption: string; amount: number; label: string }[] = [
  {
    id: 'platemaker-monthly',
    caption: 'PlateMaker · Monthly',
    amount: SUBSCRIPTION_PRICES.PLATEMAKER_MONTHLY,
    label: 'PlateMaker, 4.99 dollars a month',
  },
  {
    id: 'platetaker-monthly',
    caption: 'PlateTaker · Monthly',
    amount: SUBSCRIPTION_PRICES.PLATETAKER_MONTHLY,
    label: 'PlateTaker, 7.99 dollars a month',
  },
  {
    id: 'platemaker-yearly',
    caption: 'PlateMaker · Yearly',
    amount: SUBSCRIPTION_PRICES.PLATEMAKER_ANNUAL,
    label: 'PlateMaker, 39.99 dollars a year',
  },
  {
    id: 'platetaker-yearly',
    caption: 'PlateTaker · Yearly',
    amount: SUBSCRIPTION_PRICES.PLATETAKER_ANNUAL,
    label: 'PlateTaker, 75.99 dollars a year',
  },
];

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
  const { user } = useAuth();
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

  const openMembership = () => {
    markWelcomeSeen();
    AsyncStorage.getItem(ACCOUNT_KEY)
      .then((flag) => {
        if (user || flag === '1') {
          router.push('/(auth)/login');
          return;
        }
        router.push({
          pathname: '/(auth)/onboarding',
          params: role ? { role } : {},
        });
      })
      .catch(() => {
        router.push({
          pathname: '/(auth)/onboarding',
          params: role ? { role } : {},
        });
      });
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

          <AuthBrand />
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
              <GlassTop />
              {step === 0 ? (
                <>
                  <Text style={styles.panelTitle}>Home-Cooked Plates, Near You</Text>
                  <Text style={styles.help}>
                    HomeCookedPlate is a marketplace for meals cooked in home kitchens. Order a plate, or start cooking.
                  </Text>
                  <OrderHoursSlogan style={{ color: AuthColors.ink, marginBottom: 12 }} />
                  {BENEFITS.map((item) => (
                    <View key={item.title} style={styles.benefit}>
                      <Text style={styles.benefitEmoji}>{item.emoji}</Text>
                      <View style={styles.benefitCopy}>
                        <Text style={styles.benefitTitle}>{titleCase(item.title)}</Text>
                        <Text style={styles.benefitBody}>{item.body}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Text style={styles.panelTitle}>Membership</Text>
                  {MEMBERSHIP_PRICES.map((plan) => (
                    <View key={plan.id} style={styles.priceBlock}>
                      <Text style={styles.priceCaption}>{plan.caption}</Text>
                      <GlassPressable
                        style={styles.priceButton}
                        onPress={openMembership}
                        accessibilityRole="button"
                        accessibilityLabel={plan.label}
                        testID={plan.id === 'platemaker-monthly' ? 'membership-price' : `membership-price-${plan.id}`}
                      >
                        <LinearGradient
                          colors={[...goldButtonColors]}
                          locations={[0, 0.42, 1]}
                          style={styles.priceFill}
                        />
                        <Text style={styles.price}>{`$${plan.amount.toFixed(2)}`}</Text>
                      </GlassPressable>
                    </View>
                  ))}
                  <View style={styles.priceNotes}>
                    <Text style={styles.priceNote}>Premium features access</Text>
                    <Text style={styles.priceNote}>Priority support</Text>
                    <Text style={styles.priceNote}>Cancel anytime</Text>
                  </View>
                  <View style={styles.earlyBird}>
                    <Text style={styles.earlyTitle}>Early Bird</Text>
                    <Text style={styles.earlyBody}>
                      PlateMakers get 90 days of Premium at no charge while their metro still has a spot. A valid credit card starts those 90 days. The $4.99 monthly or $39.99 yearly charge begins after they end. Cancel before then and you are not charged.
                    </Text>
                    <Text style={styles.earlyBody}>
                      PlateTakers get free access. Premium is the upgrade that cuts the service fee on the receipt from 10% to 5% on orders of $20 or more.
                    </Text>
                    <Text style={styles.earlyBody}>
                      Outside an active metro, Early Bird is not available.
                    </Text>
                  </View>
                </>
              ) : null}

              {step === 2 && !isMaker ? (
                <>
                  <Text style={styles.panelTitle}>A Few Notes Before You Order</Text>
                  <Text style={styles.help}>
                    You are here to find food and eat it. These notes cover the pickup. Temperatures, leftovers, and containers are on Food handling.
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
                  <Text style={styles.help}>{PLATETAKER_LOST_DISPUTE_SIGNUP}</Text>
                  <FoodHandlingLink color="#3D7EBE" />
                </>
              ) : null}

              {step === 2 && isMaker ? (
                <>
                  <Text style={styles.panelTitle}>Cottage Food Rules</Text>
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
                    <Text style={[styles.checkText, { marginTop: 8 }]}>{PLATEMAKER_LOST_DISPUTE_SIGNUP}</Text>
                  </View>
                  <FoodHandlingLink color="#3D7EBE" label="Food handling temperatures for the kitchen" />
                </>
              ) : null}

              <AuthGoldButton
                title={step === 2 ? 'Continue to your account' : 'Continue'}
                onPress={continueForward}
                testID={step === 2 ? 'welcome-continue-account' : 'welcome-continue'}
                style={styles.action}
              />
              {step === 0 ? (
                <GlassPressable onPress={goToSignIn} testID="welcome-sign-in" style={styles.signIn}>
                  <Text style={styles.signInText}>I Already Have an Account</Text>
                </GlassPressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const cardShadow = {
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
    backgroundColor: 'rgba(20, 16, 12, 0.28)',
  },
  stepDotOn: {
    backgroundColor: AuthColors.gold,
  },
  stepLabel: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  stepLabelOn: {
    color: AuthColors.ink,
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
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.55)',
    ...cardShadow,
  },
  panelTitle: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 14,
  },
  help: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 15,
    fontWeight: '400',
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
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  benefitBody: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  priceBlock: {
    marginBottom: 16,
  },
  priceCaption: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  priceButton: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 24,
    minHeight: 112,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...glassSurface,
  },
  priceFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  price: {
    ...preAppFont,
    color: AuthColors.white,
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '700',
    textShadowColor: 'rgba(70, 28, 6, 0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  priceNotes: {
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  priceNote: {
    ...preAppFont,
    color: '#000000',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  earlyBird: {
    backgroundColor: AuthColors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  earlyTitle: {
    ...preAppFont,
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  earlyBody: {
    ...preAppFont,
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
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
    ...preAppFont,
    color: AuthColors.maroon,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  checkText: {
    ...preAppFont,
    color: AuthColors.ink,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  link: {
    ...preAppFont,
    color: AuthColors.maroon,
    fontWeight: '600',
  },
  noticeNote: {
    ...preAppFont,
    color: AuthColors.muted,
    fontSize: 12,
    fontWeight: '400',
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
    ...preAppFont,
    color: AuthColors.ink,
    fontWeight: '600',
    fontSize: 15,
  },
});
