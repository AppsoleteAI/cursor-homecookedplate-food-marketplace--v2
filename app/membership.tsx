import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { readDeviceCoordinates } from '@/lib/device-coordinates';
import { SUBSCRIPTION_PRICES } from '@/backend/lib/fees';
import { userNeedsMembership } from '@/backend/lib/trial-access';
import { Colors, monoGradients } from '@/constants/colors';
import { maroonButtonColors } from '@/constants/auth-palette';
import { GradientButton } from '@/components/GradientButton';
import { MembershipPromoBanner } from '@/components/MembershipPromoBanner';
import { finishIAP, IAP_REQUIRED, MEMBERSHIP_ANNUAL_PRODUCT_ID, MEMBERSHIP_MONTHLY_PRODUCT_ID, purchaseIAP, restoreIAPPurchases } from '@/lib/iap';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { GlassPressable } from '@/components/glass-surface';
import { BackCircle } from '@/components/BackCircle';
import { ScrollJumps } from '@/components/ScrollJumps';
import { useLeaveScreen, usePaidBack, useStayBack } from '@/hooks/use-leave-screen';

function askedRole(value: string | string[] | undefined): 'platemaker' | 'platetaker' | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'platemaker' || raw === 'platetaker' ? raw : undefined;
}

export default function MembershipScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { user, openKitchen } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const accountRole = user?.accountRole ?? user?.role;
  const routeRole = askedRole(params.role);
  const isPlateTaker = accountRole ? accountRole !== 'platemaker' : routeRole !== 'platemaker';
  const [processing, setProcessing] = useState(false);
  const [chargeLock, setChargeLock] = useState<'idle' | 'charging' | 'paid'>('idle');
  const [locationVerdict, setLocationVerdict] = useState<'unchecked' | 'outside' | 'inside'>('unchecked');
  const remoteOnFile = !!user && (!user.metroArea || user.metroArea === 'Remote/Other');
  const holdForGps = !isPlateTaker && !!user && remoteOnFile && locationVerdict !== 'outside';
  const gated = userNeedsMembership(user) || holdForGps;
  const leave = useLeaveScreen('/(tabs)/profile', chargeLock === 'idle' && !gated);
  useStayBack(chargeLock === 'charging' || (gated && chargeLock !== 'paid'));
  usePaidBack(isPlateTaker ? '/(tabs)/(home)/home' : '/(tabs)/dashboard', chargeLock === 'paid');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [checkedMetro, setCheckedMetro] = useState<string | null>(null);

  const claimEarlyBird = trpc.membership.claimEarlyBird.useMutation();
  const locateMembership = trpc.membership.locate.useMutation();
  const createCheckout = trpc.payments.createCheckoutSession.useMutation();
  const earlyBirdOffer = trpc.membership.earlyBirdOffer.useQuery(undefined, {
    enabled: accountRole === 'platemaker',
    retry: false,
  });
  const confirmAppleMutation = trpc.membership.confirmApple.useMutation();
  const confirmGoogleMutation = trpc.membership.confirmGoogle.useMutation();
  const { refetch: refetchMe } = trpc.auth.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const membershipTier = user?.membershipTier || 'free';
  // Use metroArea from profile (locked at signup via PostGIS)
  const userMetro = checkedMetro || user?.metroArea || null;
  const remoteMetro = !!user && (!userMetro || userMetro === 'Remote/Other');
  // PlateTakers join free. Early Bird is 90 days for a PlateMaker in an active metro that still has a spot.
  const offerDays = earlyBirdOffer.data?.eligible ? earlyBirdOffer.data.trialDays : 0;
  const plans = isPlateTaker
    ? [
        { interval: 'month' as const, amount: SUBSCRIPTION_PRICES.PLATETAKER_MONTHLY, caption: 'Monthly' },
        { interval: 'year' as const, amount: SUBSCRIPTION_PRICES.PLATETAKER_ANNUAL, caption: 'Yearly' },
      ]
    : [
        { interval: 'month' as const, amount: SUBSCRIPTION_PRICES.PLATEMAKER_MONTHLY, caption: 'Monthly' },
        { interval: 'year' as const, amount: SUBSCRIPTION_PRICES.PLATEMAKER_ANNUAL, caption: 'Yearly' },
      ];
  const joinFree = useCallback(() => {
    router.replace(isPlateTaker ? '/(tabs)/(home)/home' : '/(tabs)/dashboard');
  }, [isPlateTaker, router]);

  const openTheKitchen = useCallback(async () => {
    await openKitchen();
    router.replace('/(tabs)/dashboard');
  }, [openKitchen, router]);

  const tell = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }, []);

  const handleGetGps = useCallback(async () => {
    setDetectingLocation(true);
    try {
      const read = await readDeviceCoordinates(true);
      if (read.status !== 'ready') {
        const closed = isPlateTaker ? '' : ' The kitchen stays closed until that check finishes.';
        const message = read.status === 'denied'
          ? `Location is off. Allow it, then tap Get GPS again.${closed}`
          : read.status === 'imprecise'
            ? `This reading is not precise enough. Allow precise location, then tap Get GPS again.${closed}`
            : isPlateTaker
              ? 'This device could not read a location. Tap Get GPS again.'
              : 'This device could not read a location. The kitchen stays closed until Get GPS can check a metro.';
        tell('Location', message);
        return;
      }
      setGpsCoordinates(read.point);
      const found = await locateMembership.mutateAsync(read.point);
      await refetchMe();
      if (!isPlateTaker) await earlyBirdOffer.refetch();
      if (found.reason === 'eligible' || found.reason === 'in_metro') {
        setLocationVerdict('inside');
        setCheckedMetro(found.metroArea);
        if (isPlateTaker || found.reason !== 'eligible') {
          tell(
            'Location',
            isPlateTaker
              ? `You are in ${found.metroArea}.`
              : `You are in ${found.metroArea}. Early Bird is not available for this metro. Choose monthly or yearly before the kitchen opens.`,
          );
        } else {
          tell('Location', `You are in ${found.metroArea}. Early Bird is ${found.trialDays} days at no charge.`);
        }
        return;
      }
      if (found.reason === 'paused') {
        setLocationVerdict('outside');
        tell('Location', isPlateTaker ? 'That metro is paused.' : 'That metro is paused. The kitchen stays open without a charge.');
        return;
      }
      if (found.reason === 'lookup_failed') {
        tell(
          'Location',
          isPlateTaker
            ? 'The metro check did not finish. Tap Get GPS again.'
            : 'The metro check did not finish. Tap Get GPS again. The kitchen stays closed until it does.',
        );
        return;
      }
      setLocationVerdict('outside');
      const point = `${found.lat.toFixed(4)}, ${found.lng.toFixed(4)}`;
      tell(
        'Location',
        isPlateTaker
          ? `Checked ${point}. That point is outside the 50-mile radius of all 50 metros.`
          : `Checked ${point}. That point is outside the 50-mile radius of all 50 metros. The kitchen is open, and a paid plan is optional.`,
      );
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : '';
      const signedOut = /no id card|unauthorized|not signed in|please log in/i.test(raw);
      tell(
        'Location',
        signedOut
          ? isPlateTaker
            ? 'Sign in again, then tap Get GPS.'
            : 'Sign in again, then tap Get GPS. The kitchen stays closed until that check finishes.'
          : isPlateTaker
            ? 'The metro check did not finish. Tap Get GPS again.'
            : 'The metro check did not finish. Tap Get GPS again. The kitchen stays closed until it does.',
      );
    } finally {
      setDetectingLocation(false);
    }
  }, [earlyBirdOffer, isPlateTaker, locateMembership, refetchMe, tell]);

  const isPurchaseCancel = (error: unknown) => (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'user-cancelled'
  );

  const confirmStorePurchase = useCallback(async (receiptData: string) => {
    if (Platform.OS === 'android') {
      await confirmGoogleMutation.mutateAsync({ purchaseToken: receiptData });
      return;
    }
    await confirmAppleMutation.mutateAsync({ signedTransaction: receiptData });
  }, [confirmAppleMutation, confirmGoogleMutation]);

  const storeName = Platform.OS === 'android' ? 'Google Play' : 'the App Store';

  const handleSubscribe = useCallback(async (interval: 'month' | 'year' = 'month') => {
    if (Platform.OS === 'web') {
      setProcessing(true);
      setChargeLock('charging');
      let opened = false;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          window.alert('Sign in before paying.');
          return;
        }
        const created = await createCheckout.mutateAsync({
          returnUrl: 'https://homecookedplate.com/membership',
          interval,
        });
        if (created.checkoutUrl) {
          opened = true;
          window.location.assign(created.checkoutUrl);
          return;
        }
        window.alert('Payment could not start.');
      } finally {
        setProcessing(false);
        if (!opened) setChargeLock('idle');
      }
      return;
    }

    if (!user) {
      Alert.alert('Not Signed In', 'Please login to subscribe.');
      return;
    }

    if (IAP_REQUIRED) {
      setProcessing(true);
      setChargeLock('charging');
      let paid = false;
      try {
        const productId = interval === 'year' ? MEMBERSHIP_ANNUAL_PRODUCT_ID : MEMBERSHIP_MONTHLY_PRODUCT_ID;
        const purchase = await purchaseIAP(productId, user.id);
        await confirmStorePurchase(purchase.receiptData);
        try {
          await finishIAP(purchase.transactionId);
        } catch (finishError) {
          console.error('[Membership] Purchase finish failed after verification:', finishError);
        }
        await refetchMe();
        paid = true;
        setChargeLock('paid');
        Alert.alert('Success!', 'Your subscription is now active.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (error: any) {
        if (isPurchaseCancel(error)) return;
        Alert.alert('Error', error?.message || `The ${storeName} purchase could not be completed.`);
      } finally {
        setProcessing(false);
        if (!paid) setChargeLock('idle');
      }
      return;
    }

    setProcessing(true);
    setChargeLock('charging');
    let opened = false;
    try {
      const created = await createCheckout.mutateAsync({
        returnUrl: 'https://homecookedplate.com/membership',
        interval,
      });
      if (!created.checkoutUrl) {
        Alert.alert('Error', 'Payment could not start.');
        return;
      }
      opened = true;
      await WebBrowser.openBrowserAsync(created.checkoutUrl);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Payment could not start.');
    } finally {
      setProcessing(false);
      if (!opened) setChargeLock('idle');
    }
  }, [user, confirmStorePurchase, refetchMe, router, storeName, createCheckout]);

  const handleEarlyBird = useCallback(async () => {
    setProcessing(true);
    try {
      const result = await claimEarlyBird.mutateAsync();
      await refetchMe();
      const started = result.trialStartedAt ? new Date(result.trialStartedAt).toLocaleDateString() : 'today';
      const ends = result.trialEndsAt ? new Date(result.trialEndsAt).toLocaleDateString() : '';
      Alert.alert(
        'Early Bird started',
        `Started ${started}. Premium runs until ${ends}. No card was charged.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }],
      );
    } catch (error: any) {
      Alert.alert('Early Bird', error?.message || 'Early Bird could not be started.');
    } finally {
      setProcessing(false);
    }
  }, [claimEarlyBird, refetchMe, router]);

  const handleRestore = useCallback(async () => {
    if (!user) {
      Alert.alert('Not Signed In', 'Please login to restore purchases.');
      return;
    }
    setProcessing(true);
    setChargeLock('charging');
    let paid = false;
    try {
      const purchases = await restoreIAPPurchases();
      const purchase = purchases[0];
      if (!purchase) {
        Alert.alert('No Subscription Found', `${storeName} has no active HomeCookedPlate membership for this account.`);
        return;
      }
      await confirmStorePurchase(purchase.receiptData);
      try {
        await finishIAP(purchase.transactionId);
      } catch (finishError) {
        console.error('[Membership] Purchase finish failed after restore:', finishError);
      }
      await refetchMe();
      paid = true;
      setChargeLock('paid');
      Alert.alert('Restored', 'Your membership is active.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Restore failed', error?.message || 'Could not restore purchases.');
    } finally {
      setProcessing(false);
      if (!paid) setChargeLock('idle');
    }
  }, [user, confirmStorePurchase, refetchMe, router, storeName]);

  const membershipBadgeColor: readonly [string, string, ...string[]] = membershipTier === 'premium'
    ? monoGradients.gold
    : isPlateTaker
      ? maroonButtonColors
      : [Colors.gray[400], Colors.gray[500]];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Membership',
          headerShown: false,
        }}
      />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.content}>
          {chargeLock === 'idle' && !gated ? (
            <BackCircle tone="honey" onPress={leave} testID="membership-back" />
          ) : null}
          {/* Status Header */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Your Membership</Text>
            <View style={styles.statusCard}>
              <LinearGradient
                colors={membershipBadgeColor}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badge}
              >
                <Ionicons
                  name={membershipTier === 'premium' ? 'diamond' : 'person'}
                  size={24}
                  color={Colors.white}
                />
                <Text style={styles.badgeText}>
                  {membershipTier === 'premium' ? 'Premium Member' : (isPlateTaker ? 'PlateTaker' : 'PlateMaker')}
                </Text>
              </LinearGradient>
              
              {membershipTier === 'premium' && (
                <Text style={styles.statusText}>
                  Thank you for being a premium member!
                </Text>
              )}
              
              {membershipTier === 'free' && !isPlateTaker && (
                <Text style={styles.statusText}>
                  {!user
                    ? 'Confirm your email and sign in. Then choose Early Bird or a paid plan before the kitchen opens.'
                    : earlyBirdOffer.isError
                    ? 'Early Bird could not be checked. Tap Get GPS again once you are signed in.'
                    : earlyBirdOffer.isLoading
                      ? 'Checking Early Bird for this kitchen.'
                      : offerDays > 0
                        ? `Early Bird is ${offerDays} days of Premium at no charge. Or choose monthly or yearly.`
                        : holdForGps
                          ? 'Get GPS before the kitchen opens. Every saved metro covers a 50-mile radius. Early Bird is offered when this location is inside one.'
                          : remoteMetro
                            ? 'This location is outside every saved metro. The kitchen is open without a charge.'
                            : 'Choose monthly or yearly before the kitchen opens. Early Bird is not available for this metro.'}
                </Text>
              )}

              {membershipTier === 'free' && isPlateTaker && (
                <Text style={styles.statusText}>
                  {user
                    ? 'You have access to the app. Premium is only if you choose it.'
                    : 'Confirm your email and sign in. The app is free. Premium is optional.'}
                </Text>
              )}
            </View>
          </View>

          {/* Promo Banner */}
          {membershipTier === 'free' && (
            <View style={styles.bannerSection}>
              <MembershipPromoBanner
                userLocation={userMetro}
                membershipTier={membershipTier}
                audience={isPlateTaker ? 'platetaker' : 'platemaker'}
                onPress={() => router.replace({
                  pathname: '/membership-access',
                  params: { role: isPlateTaker ? 'platetaker' : 'platemaker' },
                })}
              />
            </View>
          )}

          {/* Location Section */}
          {membershipTier === 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationCard}>
                <View style={styles.locationInfo}>
                  <Ionicons name="location" size={24} color={Colors.gradient.green} />
                  <View style={styles.locationText}>
                    <Text style={styles.locationLabel}>Metro Area</Text>
                    <Text style={styles.locationValue}>
                      {userMetro || 'Not set'}
                    </Text>
                    {gpsCoordinates && (
                      <Text style={styles.coordinatesText}>
                        GPS: {gpsCoordinates.lat.toFixed(4)}, {gpsCoordinates.lng.toFixed(4)}
                      </Text>
                    )}
                  </View>
                </View>
                <GlassPressable
                  onPress={() => {
                    handleGetGps().catch(() => undefined);
                  }}
                  disabled={detectingLocation}
                  style={styles.detectButton}
                >
                  {detectingLocation ? (
                    <ActivityIndicator color={Colors.gradient.green} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={20} color={Colors.gradient.green} />
                      <Text style={styles.detectButtonText}>Get GPS</Text>
                    </>
                  )}
                </GlassPressable>
              </View>
              <Text style={styles.locationHint}>
                {isPlateTaker
                  ? 'Get GPS reads this device and saves the nearest metro inside a 50 mile radius. Tap it again to refresh.'
                  : gpsCoordinates
                    ? 'This location was checked against an active metro. Early Bird is offered only inside one. Tap Get GPS again to refresh.'
                    : 'Get GPS checks this device against the saved metros. Each metro has a 50 mile radius. The kitchen stays closed until that check finishes.'}
              </Text>
            </View>
          )}

          {/* Payment Setup Section */}
          {membershipTier === 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isPlateTaker ? 'Premium' : remoteMetro && !holdForGps && offerDays === 0 ? 'Paid plans' : 'Choose one'}</Text>
              <View style={styles.pricingCard}>
                {!isPlateTaker && (offerDays > 0 || holdForGps || earlyBirdOffer.isLoading || earlyBirdOffer.isError) ? (
                  <>
                    <View style={styles.trialInfo}>
                      <Ionicons name="gift" size={20} color={Colors.gradient.green} />
                      <Text style={styles.trialText}>
                        {earlyBirdOffer.isLoading
                          ? 'Checking Early Bird'
                          : earlyBirdOffer.isError
                            ? 'Early Bird could not be checked'
                            : `Early Bird · ${offerDays > 0 ? offerDays : 90} days free`}
                      </Text>
                    </View>
                    <Text style={styles.trialText}>
                      {offerDays > 0
                        ? 'No card. The start date and the end date are saved on your account.'
                        : earlyBirdOffer.isError
                          ? 'Sign in, then tap Get GPS. Early Bird starts when this kitchen is inside an active metro.'
                          : 'No card. Get GPS first. Early Bird starts when this kitchen is inside an active metro.'}
                    </Text>
                    {offerDays > 0 ? (
                      <GradientButton
                        title={`Start ${offerDays} days free`}
                        onPress={handleEarlyBird}
                        loading={processing}
                        disabled={processing}
                        style={styles.subscribeButton}
                        baseColor="green"
                      />
                    ) : earlyBirdOffer.isError ? (
                      <GradientButton
                        title="Check Early Bird again"
                        onPress={() => { earlyBirdOffer.refetch().catch(() => undefined); }}
                        loading={earlyBirdOffer.isRefetching}
                        disabled={earlyBirdOffer.isRefetching}
                        style={styles.subscribeButton}
                        baseColor="green"
                      />
                    ) : null}
                  </>
                ) : null}
                {plans.map((plan) => (
                  <View key={plan.interval}>
                    <View style={styles.pricingHeader}>
                      <Text style={styles.price}>{`$${plan.amount.toFixed(2)}`}</Text>
                      <Text style={styles.pricePeriod}>{plan.interval === 'year' ? '/year' : '/month'}</Text>
                    </View>
                    <GradientButton
                      title={plan.caption}
                      onPress={() => handleSubscribe(plan.interval)}
                      loading={processing}
                      disabled={processing}
                      style={styles.subscribeButton}
                      baseColor={plan.interval === 'year' ? 'gold' : 'green'}
                    />
                  </View>
                ))}
                {isPlateTaker && user ? (
                  <GlassPressable onPress={joinFree} style={styles.restoreButton}>
                    <Text style={styles.restoreText}>Use the app</Text>
                  </GlassPressable>
                ) : null}
                {!isPlateTaker && locationVerdict === 'outside' && remoteMetro ? (
                  <GlassPressable onPress={openTheKitchen} style={styles.restoreButton} testID="membership-open-kitchen">
                    <Text style={styles.restoreText}>Open the kitchen</Text>
                  </GlassPressable>
                ) : null}
                {IAP_REQUIRED && (
                  <GlassPressable
                    onPress={handleRestore}
                    disabled={processing}
                    style={styles.restoreButton}
                  >
                    <Text style={styles.restoreText}>Restore purchases</Text>
                  </GlassPressable>
                )}
              </View>
            </View>
          )}

          {/* Terms & Pricing Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <View style={styles.termsCard}>
              <Text style={styles.termsText}>
                {isPlateTaker
                  ? '• You already have access to the app\n• Premium is optional: $7.99 a month or $75.99 a year\n• Premium cuts the service fee from 10% to 5% on orders of $20 or more'
                  : holdForGps
                    ? '• Get GPS runs before the kitchen opens\n• A saved metro is a 50-mile radius around downtown.\n• Early Bird is offered when this location is inside an active metro\n• Monthly is $4.99. Yearly is $39.99 if you choose a paid plan'
                    : remoteMetro
                    ? '• This location is outside every saved metro\n• The kitchen is open without a charge\n• Monthly is $4.99. Yearly is $39.99 if you choose a paid plan'
                    : '• The kitchen stays closed until you choose Early Bird or a paid plan\n• Early Bird is free and records the start and end dates\n• Monthly is $4.99. Yearly is $39.99\n• Outside an active metro, or when the metro cap is full, Early Bird is not offered'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <ScrollJumps scrollRef={scrollRef} testID="membership" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 108,
  },
  statusSection: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  statusText: {
    fontSize: 15,
    color: Colors.gray[700],
    textAlign: 'center',
  },
  bannerSection: {
    marginBottom: 24,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 13,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  coordinatesText: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 4,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gradient.green,
  },
  detectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gradient.green,
  },
  locationHint: {
    fontSize: 13,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  pricingCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 20,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  pricePeriod: {
    fontSize: 18,
    color: Colors.gray[600],
    marginLeft: 4,
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gradient.green + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  trialText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gradient.green,
  },
  features: {
    gap: 12,
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: Colors.gray[700],
  },
  subscribeButton: {
    marginTop: 8,
  },
  restoreButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  termsCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 16,
  },
  termsText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 22,
  },
});
