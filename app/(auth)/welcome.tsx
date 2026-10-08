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
import { AuthColors, goldButtonColors } from '@/constants/auth-palette';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthBackButton, AuthBackground, AuthBrand, AuthGoldButton } from '@/components/auth/AuthChrome';
import { useAuth } from '@/hooks/auth-context';
import { BUYER_AFTER_NOTE, BUYER_FOOD_NOTE, BUYER_MEETING_NOTE } from '@/lib/buyer-safety';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { titleCase } from '@/lib/title-case';
import { GlassPressable, glassSurface } from '@/components/glass-surface';

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
              {step === 0 ? (
                <>
                  <Text style={styles.panelTitle}>Home-Cooked Plates, Near You</Text>
                  <Text style={styles.help}>
                    HomeCookedPlate is a marketplace for meals cooked in home kitchens. Order a plate, or start cooking.
                  </Text>
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
                  <GlassPressable
                    style={styles.priceButton}
                    onPress={openMembership}
                    accessibilityRole="button"
                    accessibilityLabel="4.99 dollars a month. Create an account, or sign in."
                    testID="membership-price"
                  >
                    <LinearGradient
                      colors={[...goldButtonColors]}
                      locations={[0, 0.42, 1]}
                      style={styles.priceFill}
                    />
                    <Text style={styles.price}>$4.99</Text>
                  </GlassPressable>
                  <View style={styles.priceNotes}>
                    <Text style={styles.priceNote}>Premium is $4.99 a month after any free period.</Text>
                    <Text style={styles.priceNote}>Premium features access</Text>
                    <Text style={styles.priceNote}>Priority support</Text>
                    <Text style={styles.priceNote}>Cancel anytime</Text>
                  </View>
                  <View style={styles.earlyBird}>
                    <Text style={styles.earlyTitle}>Early Bird</Text>
                    <Text style={styles.earlyBody}>
                      Early Bird is 90 days of Premium at no charge. It is free early access, open while your metro still has a spot. Each metro has a limited number of Early Bird places for people ordering plates and for people cooking.
                    </Text>
                    <Text style={styles.earlyBody}>
                      A payment method starts those 90 days. The $4.99 charge begins after they end. Cancel before then and you are not charged.
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
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepDotOn: {
    backgroundColor: AuthColors.brand,
  },
  stepLabel: {
    color: AuthColors.onDark,
    fontSize: 12,
    fontWeight: '600',
  },
  stepLabelOn: {
    color: AuthColors.brand,
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
  priceButton: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 24,
    minHeight: 112,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
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
    color: '#000000',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  earlyBird: {
    backgroundColor: AuthColors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  earlyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  earlyBody: {
    color: '#000000',
    fontSize: 14,
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
