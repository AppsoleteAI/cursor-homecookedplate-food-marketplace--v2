import React, { useState, useCallback } from 'react';
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
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Location from 'expo-location';
import { SUBSCRIPTION_PRICES } from '@/backend/lib/fees';
import { userNeedsMembership } from '@/backend/lib/trial-access';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { MembershipPromoBanner } from '@/components/MembershipPromoBanner';
import { finishIAP, IAP_REQUIRED, MEMBERSHIP_ANNUAL_PRODUCT_ID, MEMBERSHIP_MONTHLY_PRODUCT_ID, purchaseIAP, restoreIAPPurchases } from '@/lib/iap';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { GlassPressable } from '@/components/glass-surface';
import { BackCircle } from '@/components/BackCircle';
import { useLeaveScreen, usePaidBack, useStayBack } from '@/hooks/use-leave-screen';

export default function MembershipScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [chargeLock, setChargeLock] = useState<'idle' | 'charging' | 'paid'>('idle');
  const [locationVerdict, setLocationVerdict] = useState<'unchecked' | 'outside' | 'inside'>('unchecked');
  const remoteOnFile = !user?.metroArea || user.metroArea === 'Remote/Other';
  const holdForGps = user?.role === 'platemaker' && remoteOnFile && locationVerdict !== 'outside';
  const gated = userNeedsMembership(user) || holdForGps;
  const leave = useLeaveScreen('/(tabs)/profile', chargeLock === 'idle' && !gated);
  useStayBack(chargeLock === 'charging' || (gated && chargeLock !== 'paid'));
  usePaidBack(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/(home)/home', chargeLock === 'paid');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [, setLocationPermissionGranted] = useState(false);

  const claimEarlyBird = trpc.membership.claimEarlyBird.useMutation();
  const locateMembership = trpc.membership.locate.useMutation();
  const createCheckout = trpc.payments.createCheckoutSession.useMutation();
  const earlyBirdOffer = trpc.membership.earlyBirdOffer.useQuery(undefined, {
    enabled: user?.role === 'platemaker',
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
  const userMetro = user?.metroArea || null;
  const remoteMetro = !userMetro || userMetro === 'Remote/Other';
  // PlateTakers join free. Early Bird is 90 days for a PlateMaker in an active metro that still has a spot.
  const isPlateTaker = user?.role !== 'platemaker';
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
    router.replace(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/(home)/home');
  }, [router, user?.role]);

  const tell = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }, []);

  const requestLocationAndGetCoordinates = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        tell('Location', 'This browser cannot read a location. The kitchen stays closed until Get GPS can check a metro.');
        return null;
      }
      try {
        const position = await new Promise<{ coords: { latitude: number; longitude: number } }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          });
        });
        return { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch (error) {
        console.error('[Membership] Web location error:', error);
        const denied = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 1;
        tell(
          'Location',
          denied
            ? 'Location is off for this browser. Allow it for this site, then tap Get GPS again. The kitchen stays closed until that check finishes.'
            : 'This browser could not read a location. The kitchen stays closed until Get GPS can check a metro.',
        );
        return null;
      }
    }

    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      if (existingStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          tell(
            'Location',
            'Location is off for this app. Allow it, then tap Get GPS again. The kitchen stays closed until that check finishes.',
          );
          return null;
        }
      }

      setLocationPermissionGranted(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { lat: location.coords.latitude, lng: location.coords.longitude };
    } catch (error) {
      console.error('[Membership] Location error:', error);
      tell('Location', 'This device could not read a location. The kitchen stays closed until Get GPS can check a metro.');
      return null;
    }
  }, [tell]);

  const handleGetGps = useCallback(async () => {
    setDetectingLocation(true);
    try {
      const coords = await requestLocationAndGetCoordinates();
      if (!coords) return;
      setGpsCoordinates(coords);
      const found = await locateMembership.mutateAsync(coords);
      await refetchMe();
      await earlyBirdOffer.refetch();
      if (found.reason === 'eligible') {
        setLocationVerdict('inside');
        tell('Location', `You are in ${found.metroArea}. Early Bird is ${found.trialDays} days at no charge.`);
        return;
      }
      if (found.reason === 'in_metro') {
        setLocationVerdict('inside');
        tell('Location', `You are in ${found.metroArea}. Early Bird is not available for this metro. Choose monthly or yearly before the kitchen opens.`);
        return;
      }
      if (found.reason === 'paused') {
        setLocationVerdict('outside');
        tell('Location', 'That metro is paused. The kitchen stays open without a charge.');
        return;
      }
      if (found.reason === 'lookup_failed') {
        tell('Location', 'The metro check did not finish. Tap Get GPS again. The kitchen stays closed until it does.');
        return;
      }
      setLocationVerdict('outside');
      const point = `${found.lat.toFixed(4)}, ${found.lng.toFixed(4)}`;
      tell('Location', `Checked ${point}. That point is outside the 50-mile radius of all 50 metros. The kitchen is open, and a paid plan is optional.`);
    } catch (error: any) {
      tell('Location', error?.message || 'Location could not be checked. The kitchen stays closed until Get GPS finishes.');
    } finally {
      setDetectingLocation(false);
    }
  }, [earlyBirdOffer, locateMembership, refetchMe, requestLocationAndGetCoordinates, tell]);

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

  const membershipBadgeColor: readonly [string, string] = membershipTier === 'premium'
    ? monoGradients.gold
    : [Colors.gray[400], Colors.gray[500]];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Membership',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
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
                  {offerDays > 0
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
                  You have access to the app. Premium is only if you choose it.
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
                onPress={() => router.push('/membership-access')}
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
                {!gpsCoordinates && (
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
                )}
              </View>
              <Text style={styles.locationHint}>
                {gpsCoordinates
                  ? 'This location was checked against an active metro. Early Bird is offered only inside one.'
                  : 'Get GPS checks this device against the saved metros. Each metro has a 50 mile radius. The kitchen stays closed until that check finishes.'}
              </Text>
            </View>
          )}

          {/* Payment Setup Section */}
          {membershipTier === 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isPlateTaker ? 'Premium' : remoteMetro && !holdForGps && offerDays === 0 ? 'Paid plans' : 'Choose one'}</Text>
              <View style={styles.pricingCard}>
                {!isPlateTaker && (offerDays > 0 || holdForGps) ? (
                  <>
                    <View style={styles.trialInfo}>
                      <Ionicons name="gift" size={20} color={Colors.gradient.green} />
                      <Text style={styles.trialText}>
                        {`Early Bird · ${offerDays > 0 ? offerDays : 90} days free`}
                      </Text>
                    </View>
                    <Text style={styles.trialText}>
                      {offerDays > 0
                        ? 'No card. The start date and the end date are saved on your account.'
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
                {isPlateTaker ? (
                  <GlassPressable onPress={joinFree} style={styles.restoreButton}>
                    <Text style={styles.restoreText}>Use the app</Text>
                  </GlassPressable>
                ) : null}
                {!isPlateTaker && locationVerdict === 'outside' && remoteMetro ? (
                  <GlassPressable onPress={joinFree} style={styles.restoreButton} testID="membership-open-kitchen">
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
