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
import { nearestMetro } from '@/backend/lib/metro-radius';
import { SUBSCRIPTION_PRICES } from '@/backend/lib/fees';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { MembershipPromoBanner } from '@/components/MembershipPromoBanner';
import { finishIAP, IAP_REQUIRED, MEMBERSHIP_ANNUAL_PRODUCT_ID, MEMBERSHIP_MONTHLY_PRODUCT_ID, purchaseIAP, restoreIAPPurchases } from '@/lib/iap';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { MaroonButtonFill } from '@/components/auth/AuthChrome';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { BackCircle } from '@/components/BackCircle';
import { ScrollJumps } from '@/components/ScrollJumps';
import { useLeaveScreen, usePaidBack, useStayBack } from '@/hooks/use-leave-screen';

function plateTakerFreeEntry(signedIn: boolean): string {
  const month = SUBSCRIPTION_PRICES.PLATETAKER_MONTHLY.toFixed(2);
  const year = SUBSCRIPTION_PRICES.PLATETAKER_ANNUAL.toFixed(2);
  const entry = signedIn
    ? 'The app is free. Use the app to enter.'
    : 'The app is free. Click the maroon PlateTaker button to sign in, then use the app.';
  return `${entry} Premium is optional at $${month} a month or $${year} a year.`;
}

function askedRole(value: string | string[] | undefined): 'platemaker' | 'platetaker' | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'platemaker' || raw === 'platetaker' ? raw : undefined;
}

export default function MembershipScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { user } = useAuth();
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
  const leave = useLeaveScreen(isPlateTaker ? '/(tabs)/(home)/home' : '/(tabs)/dashboard', chargeLock === 'idle');
  useStayBack(chargeLock === 'charging');
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
  const matchedCity = gpsCoordinates ? nearestMetro(gpsCoordinates.lat, gpsCoordinates.lng)?.name ?? null : null;
  const savedMetro = user?.metroArea && user.metroArea !== 'Remote/Other' ? user.metroArea : null;
  const userMetro = checkedMetro || savedMetro || matchedCity;
  const locationConfirmed = locationVerdict === 'inside' || locationVerdict === 'outside';
  const remoteMetro = !!user && (!userMetro || userMetro === 'Remote/Other');
  // PlateTakers join free. Early Bird is 90 days for a PlateMaker in an active metro that still has a spot.
  const offerDays = earlyBirdOffer.data?.eligible ? earlyBirdOffer.data.trialDays : 0;
  const remoteKitchen = earlyBirdOffer.data?.remoteKitchen === true;
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


  const tell = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }, []);

  const handleGetGps = useCallback(async () => {
    setDetectingLocation(true);
    let city: string | null = null;
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
      city = nearestMetro(read.point.lat, read.point.lng)?.name ?? null;
      if (city) {
        setCheckedMetro(city);
        setLocationVerdict('inside');
      } else {
        setCheckedMetro(null);
        setLocationVerdict('outside');
      }
      if (!user) {
        tell(
          'Location',
          city
            ? isPlateTaker
              ? `You are in ${city}. ${plateTakerFreeEntry(false)}`
              : `You are in ${city}. Click the maroon PlateMaker button to sign in. Early Bird is 90 days at no charge.`
            : isPlateTaker
              ? `That point is outside every metro. ${plateTakerFreeEntry(false)}`
              : 'That point is outside every metro. This account is Remote. You get 120 days at no charge, then a monthly or yearly plan. Plates are shown only to buyers within 20 miles of your kitchen.',
        );
        return;
      }
      const found = await locateMembership.mutateAsync({ ...read.point, mode: 'commit' });
      await refetchMe();
      if (!isPlateTaker) await earlyBirdOffer.refetch();
      const savedName = found.metroArea && found.metroArea !== 'Remote/Other' ? found.metroArea : city;
      if (savedName && found.reason !== 'paused' && found.reason !== 'outside') {
        setLocationVerdict('inside');
        setCheckedMetro(savedName);
        tell(
          'Location',
          isPlateTaker
            ? `You are in ${savedName}. ${plateTakerFreeEntry(true)}`
            : found.reason === 'eligible'
              ? `You are in ${savedName}. Early Bird is ${found.trialDays} days at no charge.`
              : `You are in ${savedName}. Early Bird is not available for this metro. Choose monthly or yearly before the kitchen opens.`,
        );
        return;
      }
      if (found.reason === 'paused') {
        setLocationVerdict('outside');
        setCheckedMetro(null);
        tell('Location', isPlateTaker ? `That metro is paused. ${plateTakerFreeEntry(true)}` : 'That metro is paused. Choose Early Bird or a paid plan before the kitchen opens.');
        return;
      }
      if (!city) {
        setLocationVerdict('outside');
        const point = `${found.lat.toFixed(4)}, ${found.lng.toFixed(4)}`;
        tell(
          'Location',
          isPlateTaker
            ? `Checked ${point}. That point is outside every metro. ${plateTakerFreeEntry(true)}`
            : `Checked ${point}. You are outside every metro. This account is Remote. You get 120 days at no charge, then a monthly or yearly plan. Plates are shown only to buyers within 20 miles of your kitchen.`,
        );
        return;
      }
      tell(
        'Location',
        isPlateTaker
          ? `You are in ${city}. Tap Get GPS again to save it on this account. ${plateTakerFreeEntry(true)}`
          : `You are in ${city}. Tap Get GPS again to save it, then Early Bird can start. It is 90 days at no charge.`,
      );
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : '';
      const signedOut = !user || /no id card|unauthorized|not signed in|please log in/i.test(raw);
      tell(
        'Location',
        city
          ? signedOut
            ? isPlateTaker
              ? `You are in ${city}. ${plateTakerFreeEntry(false)} Tap Get GPS again after that.`
              : `You are in ${city}. Click the maroon PlateMaker button to sign in. Early Bird is 90 days at no charge.`
            : isPlateTaker
              ? `You are in ${city}. Tap Get GPS again to save it on this account. ${plateTakerFreeEntry(true)}`
              : `You are in ${city}. Tap Get GPS again to save it, then Early Bird can start. It is 90 days at no charge.`
          : signedOut
            ? isPlateTaker
              ? `${plateTakerFreeEntry(false)} Then tap Get GPS again.`
              : 'Click the maroon PlateMaker button to sign in, then tap Get GPS. The kitchen stays closed until that check finishes.'
            : isPlateTaker
              ? `The metro check did not finish. Tap Get GPS again. ${plateTakerFreeEntry(true)}`
              : 'The metro check did not finish. Tap Get GPS again. The kitchen stays closed until it does.',
      );
    } finally {
      setDetectingLocation(false);
    }
  }, [earlyBirdOffer, isPlateTaker, locateMembership, refetchMe, tell, user]);

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
        result.remoteKitchen ? '120 days started' : 'Early Bird started',
        result.remoteKitchen
          ? `Started ${started}. The kitchen stays open until ${ends}. No card was charged. Buyers must be within 20 miles.`
          : `Started ${started}. Premium runs until ${ends}. No card was charged.`,
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

  const openSignIn = useCallback(() => {
    if (user) {
      router.replace(isPlateTaker ? '/(tabs)/(home)/home' : '/(tabs)/dashboard');
      return;
    }
    router.push('/(auth)/login');
  }, [isPlateTaker, router, user]);

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
          {chargeLock === 'idle' ? (
            <BackCircle tone="honey" onPress={leave} testID="membership-back" />
          ) : null}
          {/* Status Header */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Your Membership</Text>
            <View style={styles.statusCard}>
              {membershipTier === 'premium' ? (
                <LinearGradient
                  colors={monoGradients.gold}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.badge}
                >
                  <Ionicons name="diamond" size={24} color={Colors.white} />
                  <Text style={styles.badgeText}>Premium Member</Text>
                </LinearGradient>
              ) : (
                <GlassPressable
                  style={styles.roleButton}
                  onPress={openSignIn}
                  accessibilityRole="button"
                  accessibilityLabel={isPlateTaker ? 'PlateTaker, sign in' : 'PlateMaker, sign in'}
                  testID={isPlateTaker ? 'membership-platetaker-sign-in' : 'membership-platemaker-sign-in'}
                >
                  <MaroonButtonFill />
                  <Ionicons name="person" size={24} color={Colors.white} />
                  <Text style={styles.badgeText}>{isPlateTaker ? 'PlateTaker' : 'PlateMaker'}</Text>
                </GlassPressable>
              )}
              
              {membershipTier === 'premium' && (
                <Text style={styles.statusText}>
                  Thank you for being a premium member!
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
                {userMetro
                  ? isPlateTaker
                    ? `You are in ${userMetro}. ${user ? 'The app is free. Use the app to enter.' : 'The app is free. Click the maroon PlateTaker button to sign in, then use the app.'} This metro covers a 50 mile radius around downtown.`
                    : `You are in ${userMetro}. Early Bird is 90 days at no charge inside this metro.`
                  : isPlateTaker
                  ? 'Get GPS reads this device and saves the nearest metro inside a 50 mile radius. Tap it again to refresh.'
                  : gpsCoordinates
                    ? 'These coordinates are outside every metro. This account is Remote. You get 120 days at no charge, then a monthly or yearly plan. Plates are shown only to buyers within 20 miles of your kitchen.'
                    : 'Get GPS checks this device against the saved metros. Each metro has a 50 mile radius. The kitchen stays closed until that check finishes.'}
              </Text>
            </View>
          )}

          {/* Payment Setup Section */}
          {membershipTier === 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isPlateTaker ? 'Choose one' : remoteKitchen ? 'Remote · 120 days free' : remoteMetro && !holdForGps && offerDays === 0 ? 'Paid plans' : 'Choose one'}</Text>
              <View style={styles.pricingCard}>
                {isPlateTaker ? (
                  <>
                    {locationConfirmed ? (
                      <>
                        <View style={styles.trialInfo}>
                          <Ionicons name="gift" size={20} color={Colors.gradient.green} />
                          <Text style={styles.trialText}>The app is free</Text>
                        </View>
                        <Text style={[styles.trialText, styles.trialNote]}>
                          {user
                            ? userMetro
                              ? `You are in ${userMetro}. Use the app to enter. Premium is optional.`
                              : 'Use the app to enter. Premium is optional.'
                            : userMetro
                              ? `You are in ${userMetro}. Click the maroon PlateTaker button to sign in, then use the app. Premium is optional.`
                              : 'Confirm your email. Click the maroon PlateTaker button to sign in. The app is free. Premium is optional.'}
                        </Text>
                      </>
                    ) : null}
                    {user ? (
                      <GradientButton
                        title="Use the app"
                        onPress={joinFree}
                        loading={processing}
                        disabled={processing}
                        style={styles.subscribeButton}
                        baseColor="green"
                      />
                    ) : null}
                  </>
                ) : null}
                {!isPlateTaker && (offerDays > 0 || holdForGps || earlyBirdOffer.isLoading || earlyBirdOffer.isError || (!user && !!userMetro)) ? (
                  <>
                    {locationConfirmed ? (
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
                    ) : null}
                    {locationConfirmed ? (
                      <Text style={[styles.trialText, styles.trialNote]}>
                        {offerDays > 0
                          ? 'No card. The start date and the end date are saved on your account.'
                          : !user && userMetro
                            ? `You are in ${userMetro}. Click the maroon PlateMaker button to sign in. Early Bird is 90 days at no charge.`
                            : earlyBirdOffer.isError
                            ? 'Click the maroon PlateMaker button to sign in, then tap Get GPS. Early Bird starts when this kitchen is inside an active metro.'
                            : 'No card. Get GPS first. Early Bird starts when this kitchen is inside an active metro.'}
                      </Text>
                    ) : null}
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
                {!isPlateTaker && remoteKitchen ? (
                  <>
                    <View style={styles.trialInfo}>
                      <Ionicons name="gift" size={20} color={Colors.gradient.green} />
                      <Text style={styles.trialText}>Remote · 120 days free</Text>
                    </View>
                    <Text style={[styles.trialText, styles.trialNote]}>
                      No card. The start date and the end date are saved on your account. Buyers must be within 20 miles.
                    </Text>
                    <GradientButton
                      title="Start 120 days free"
                      onPress={handleEarlyBird}
                      loading={processing}
                      disabled={processing}
                      style={styles.subscribeButton}
                      baseColor="green"
                    />
                  </>
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
                    ? '• This location is outside every saved metro\n• Remote kitchens get 120 days at no charge. No card. The start date and the end date are saved\n• The kitchen closes when those days end until a paid plan\n• A plate is offered only inside 20 miles of the kitchen\n• Monthly is $4.99. Yearly is $39.99'
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
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    ...glassSurface,
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
    borderWidth: 2,
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
  trialNote: {
    marginBottom: 24,
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
