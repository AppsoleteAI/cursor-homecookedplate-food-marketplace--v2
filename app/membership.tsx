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
import { useStripe } from '@/lib/stripe';
import * as Location from 'expo-location';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { MembershipPromoBanner } from '@/components/MembershipPromoBanner';
import { finishIAP, IAP_REQUIRED, MEMBERSHIP_MONTHLY_PRODUCT_ID, purchaseIAP, restoreIAPPurchases } from '@/lib/iap';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { GlassPressable } from '@/components/glass-surface';

export default function MembershipScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const stripe = useStripe();
  const initPaymentSheet = stripe?.initPaymentSheet || null;
  const presentPaymentSheet = stripe?.presentPaymentSheet || null;

  const [processing, setProcessing] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [, setLocationPermissionGranted] = useState(false);

  const subscribeMutation = trpc.membership.subscribe.useMutation();
  const confirmAppleMutation = trpc.membership.confirmApple.useMutation();
  const confirmGoogleMutation = trpc.membership.confirmGoogle.useMutation();
  const createSetupIntentMutation = trpc.payments.createSetupIntent.useMutation();
  const getPaymentMethodMutation = trpc.payments.getPaymentMethodFromSetup.useMutation();
  const { refetch: refetchMe } = trpc.auth.me.useQuery(undefined, {
    enabled: !!user,
  });

  const membershipTier = user?.membershipTier || 'free';
  // Use metroArea from profile (locked at signup via PostGIS)
  const userMetro = user?.metroArea || null;
  // PlateTakers join free. Early Bird is 90 days for a PlateMaker in an active metro that still has a spot.
  const isPlateTaker = user?.role !== 'platemaker';
  const earlyBird = membershipTier === 'free' && user?.role === 'platemaker' && !!userMetro && userMetro !== 'Remote/Other';
  const isEligibleForTrial = earlyBird;
  const joinFree = useCallback(() => {
    router.replace(user?.role === 'platemaker' ? '/(tabs)/dashboard' : '/(tabs)/(home)/home');
  }, [router, user?.role]);

  // Request GPS permission and get coordinates
  const requestLocationAndGetCoordinates = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      // Check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus !== 'granted') {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Required',
            'We need your location to check if you qualify for the free trial. You can still subscribe without the trial.'
          );
          return null;
        }
      }

      setLocationPermissionGranted(true);

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      setGpsCoordinates(coords);
      return coords;
    } catch (error) {
      console.error('[Membership] Location error:', error);
      Alert.alert(
        'Location Error',
        'Could not look up your location. A Mac or Windows computer has no GPS, so Location Services must be on and this browser allowed. On iPhone or Android, allow location for the app. An editor preview usually has no position. You can still subscribe without the trial.'
      );
      return null;
    }
  }, []);

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

  const handleSubscribe = useCallback(async () => {
    if (Platform.OS === 'web') {
      setProcessing(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          window.alert('Sign in before paying.');
          return;
        }
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: { returnUrl: 'https://homecookedplate.com/membership' },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (error) {
          window.alert(error instanceof Error ? error.message : 'Payment could not start.');
          return;
        }
        const checkoutUrl = (data as { checkoutUrl?: string } | null)?.checkoutUrl;
        if (checkoutUrl) {
          window.location.assign(checkoutUrl);
          return;
        }
        window.alert('Payment could not start.');
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!user) {
      Alert.alert('Not Signed In', 'Please login to subscribe.');
      return;
    }

    if (IAP_REQUIRED) {
      setProcessing(true);
      try {
        const purchase = await purchaseIAP(MEMBERSHIP_MONTHLY_PRODUCT_ID, user.id);
        await confirmStorePurchase(purchase.receiptData);
        try {
          await finishIAP(purchase.transactionId);
        } catch (finishError) {
          console.error('[Membership] Purchase finish failed after verification:', finishError);
        }
        await refetchMe();
        Alert.alert('Success!', 'Your subscription is now active.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (error: any) {
        if (isPurchaseCancel(error)) return;
        Alert.alert('Error', error?.message || `The ${storeName} purchase could not be completed.`);
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!initPaymentSheet || !presentPaymentSheet) {
      Alert.alert('Error', 'Payment system not available');
      return;
    }

    setProcessing(true);

    try {
      // Request GPS permission and get coordinates if not already available
      let coords = gpsCoordinates;
      if (!coords && isEligibleForTrial) {
        coords = await requestLocationAndGetCoordinates();
      }

      // Determine if we should use trial
      const useTrial = isEligibleForTrial && (userMetro !== null || coords !== null);

      // Create a Setup Intent for collecting payment method for subscription
      const setupIntentResult = await createSetupIntentMutation.mutateAsync({
        customerId: user?.stripeCustomerId || null,
      });

      if (!setupIntentResult.clientSecret) {
        throw new Error('Failed to initialize payment. Please try again.');
      }

      // Initialize Payment Sheet with Setup Intent
      if (!initPaymentSheet || !presentPaymentSheet) {
        Alert.alert('Error', 'Payment system not available');
        setProcessing(false);
        return;
      }

      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: setupIntentResult.clientSecret,
        merchantDisplayName: 'HomeCookedPlate',
        returnURL: 'homecookedplate://membership',
      });

      if (initError) {
        console.error('[Stripe] Init error:', initError);
        Alert.alert('Error', initError.message);
        setProcessing(false);
        return;
      }

      // Present Payment Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          console.error('[Stripe] Payment error:', presentError);
          Alert.alert('Payment failed', presentError.message);
        }
        setProcessing(false);
        return;
      }

      // After successful payment method collection, retrieve the payment method from the setup intent
      const paymentMethodResult = await getPaymentMethodMutation.mutateAsync({
        setupIntentId: setupIntentResult.setupIntentId,
      });

      if (!paymentMethodResult.paymentMethodId) {
        throw new Error('Payment method not found');
      }

      // Call subscription mutation with payment method and GPS coordinates
      const result = await subscribeMutation.mutateAsync({
        paymentMethodId: paymentMethodResult.paymentMethodId,
        useTrial,
        lat: coords?.lat,
        lng: coords?.lng,
        locationText: userMetro || null,
      });

      // Handle success
      await refetchMe();
      
      Alert.alert(
        'Success!',
        result.trialDays > 0
          ? `Your ${result.trialDays}-day free trial has started! You'll be charged after the trial period.`
          : 'Your subscription is now active!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('[Membership] Subscription error:', error);
      
      const errorMessage = error?.message || 'Failed to create subscription. Please try again.';
      
      // Handle specific error cases
      if (errorMessage.includes('already have an active subscription')) {
        Alert.alert('Already Subscribed', 'You already have an active subscription.');
      } else if (errorMessage.includes('already associated with a membership')) {
        Alert.alert(
          'Account Already Linked',
          'This email or username is already associated with a membership. Please contact support if this is an error.'
        );
      } else if (errorMessage.includes('Quota exceeded')) {
        Alert.alert(
          'Limited Availability',
          'The free trial quota for your metro area has been reached. Please check back later or subscribe without the trial.'
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initPaymentSheet, presentPaymentSheet, userMetro, isEligibleForTrial, confirmStorePurchase, refetchMe, router, storeName]);

  const handleRestore = useCallback(async () => {
    if (!user) {
      Alert.alert('Not Signed In', 'Please login to restore purchases.');
      return;
    }
    setProcessing(true);
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
      Alert.alert('Restored', 'Your membership is active.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Restore failed', error?.message || 'Could not restore purchases.');
    } finally {
      setProcessing(false);
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
          headerShown: true,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.content}>
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
              
              {membershipTier === 'free' && earlyBird && (
                <Text style={styles.statusText}>
                  Your metro still has an Early Bird spot. A card on the phone app starts 90 days of Premium.
                </Text>
              )}

              {membershipTier === 'free' && !earlyBird && (
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
                    onPress={async () => {
                      setDetectingLocation(true);
                      const coords = await requestLocationAndGetCoordinates();
                      if (coords) {
                        Alert.alert(
                          'Location Detected',
                          `Coordinates: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}. This will be used to check trial eligibility.`,
                          [{ text: 'OK' }]
                        );
                      }
                      setDetectingLocation(false);
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
                  ? 'Your GPS coordinates will be used to verify trial eligibility. Your metro area was determined at signup.'
                  : 'Your metro area was determined at signup. Get your current GPS location to verify trial eligibility.'}
              </Text>
            </View>
          )}

          {/* Payment Setup Section */}
          {membershipTier === 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscribe</Text>
              <View style={styles.pricingCard}>
                <View style={styles.pricingHeader}>
                  <Text style={styles.price}>$4.99</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
                {isEligibleForTrial && (
                  <View style={styles.trialInfo}>
                    <Ionicons name="gift" size={20} color={Colors.gradient.green} />
                    <Text style={styles.trialText}>
                      Start with {90} days FREE trial
                    </Text>
                  </View>
                )}
                <View style={styles.features}>
                  <View style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.gradient.green} />
                    <Text style={styles.featureText}>Premium features access</Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.gradient.green} />
                    <Text style={styles.featureText}>Priority support</Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.gradient.green} />
                    <Text style={styles.featureText}>Cancel anytime</Text>
                  </View>
                </View>
                <Text style={styles.trialText}>
                  {isPlateTaker
                    ? 'The green button opens payment. Use it only if you want Premium.'
                    : 'The green button opens payment if you choose Premium.'}
                </Text>
                <GradientButton
                  title={Platform.OS === 'web' ? 'Continue to payment' : (Platform.OS === 'android' ? 'Subscribe with Google Play' : (IAP_REQUIRED ? 'Subscribe with Apple' : 'Continue to payment'))}
                  onPress={handleSubscribe}
                  loading={processing}
                  disabled={processing}
                  style={styles.subscribeButton}
                  baseColor="green"
                />
                <GlassPressable onPress={joinFree} style={styles.restoreButton}>
                  <Text style={styles.restoreText}>Use the app</Text>
                </GlassPressable>
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
                  ? '• You already have access to the app\n• Premium is optional and cuts the service fee from 10% to 5% on orders of $20 or more\n• The green button opens card payment. It is not required to look, order, or meet'
                  : '• You already have access to the app\n• A card can start 90 days of Premium while an active metro still has a spot\n• Outside an active metro, those 90 days are not available\n• The green button opens payment only if you choose Premium'}
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
