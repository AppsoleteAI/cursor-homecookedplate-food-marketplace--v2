import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BuyerOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/auth-context';
import { Colors, monoGradients } from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { GradientButton } from '@/components/GradientButton';
import { useCart } from '@/hooks/cart-context';
import { CartItem } from '@/types';

import { ScheduleTimePicker } from '@/components/ScheduleTimePicker';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { useStripe } from '@/lib/stripe';
type ConfettiRainProps = { headerOffset: number; onEnd: () => void };

type CornerConfettiProps = { headerOffset: number; onEnd?: () => void };

type CongratsFlashProps = { visible: boolean; footerOffset: number; onEnd?: () => void };

function ConfettiRain({ headerOffset, onEnd }: ConfettiRainProps) {
  const { width, height } = Dimensions.get('window');
  const areaHeight = Math.max(height - headerOffset, 0);
  const count = 180 as const;
  const particles = useMemo(() => {
    const palette = ['#FDE68A', '#F59E0B', '#D97706'];
    return Array.from({ length: count }).map((_, i) => {
      const size = 2 + Math.round(Math.random() * 3);
      const length = 8 + Math.round(Math.random() * 8);
      const left = Math.random() * width;
      const delay = Math.random() * 800;
      const duration = 2500 + Math.random() * 2000;
      const rotate = (Math.random() * 360) + 'deg';
      const color = palette[i % palette.length];
      return { size, length, left, delay, duration, rotate, color };
    });
  }, [width]);

  const anims = useMemo(() => particles.map(() => new Animated.Value(0)), [particles]);

  useEffect(() => {
    const animations = anims.map((val, idx) => (
      Animated.sequence([
        Animated.delay(particles[idx].delay),
        Animated.timing(val, { toValue: 1, duration: particles[idx].duration, useNativeDriver: true }),
      ])
    ));

    Animated.stagger(60, animations).start(({ finished }) => {
      if (finished) onEnd();
    });
  }, [anims, particles, onEnd]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: headerOffset, bottom: 0, zIndex: 9 }} testID="confetti-overlay">
      {particles.map((p, i) => {
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [-40, areaHeight + 40] });
        const sway = Math.sin((i % 10) * Math.PI / 5) * 20;
        const translateX = anims[i].interpolate({ inputRange: [0, 1], outputRange: [p.left, p.left + sway] });
        const opacity = anims[i].interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.6, 0.35, 0] });
        return (
          <Animated.View
            key={`c-${i}`}
            style={{ position: 'absolute', width: p.size, height: p.length, borderRadius: p.size / 2, backgroundColor: p.color, left: 0, transform: [{ translateX }, { translateY }, { rotate: p.rotate }], opacity }}
          />
        );
      })}
    </View>
  );
}

function CornerConfetti({ headerOffset, onEnd }: CornerConfettiProps) {
  const { width, height } = Dimensions.get('window');
  const areaHeight = Math.max(height - headerOffset, 0);
  const countPerCorner = 56 as const;

  const particles = useMemo(() => {
    const total = countPerCorner * 2;
    const darkPalette = ['#B45309', '#92400E', '#78350F', '#A16207'];
    return Array.from({ length: total }).map((_, i) => {
      const fromLeft = i < countPerCorner;
      const size = 3 + Math.round(Math.random() * 3);
      const length = 10 + Math.round(Math.random() * 10);
      const baseX = fromLeft ? 0 : width;
      const spread = Math.min(120, width * 0.25);
      const targetX = fromLeft
        ? baseX + Math.random() * spread + 40
        : baseX - (Math.random() * spread + 40);
      const delay = Math.random() * 220;
      const duration = 1600 + Math.random() * 900;
      const rotate = (Math.random() * 360) + 'deg';
      const color = darkPalette[i % darkPalette.length];
      const peak = headerOffset + Math.random() * (areaHeight * 0.55);
      return { fromLeft, size, length, baseX, targetX, delay, duration, rotate, color, peak };
    });
  }, [width, areaHeight, headerOffset, countPerCorner]);

  const anims = useMemo(() => particles.map(() => new Animated.Value(0)), [particles]);

  useEffect(() => {
    const animsList = anims.map((val, idx) =>
      Animated.sequence([
        Animated.delay(particles[idx].delay),
        Animated.timing(val, { toValue: 1, duration: particles[idx].duration, useNativeDriver: true }),
      ]),
    );
    Animated.stagger(40, animsList).start(({ finished }) => {
      if (finished && onEnd) onEnd();
    });
  }, [anims, particles, onEnd]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: headerOffset, bottom: 0, zIndex: 11 }} testID="corner-confetti">
      {particles.map((p, i) => {
        const translateX = anims[i].interpolate({ inputRange: [0, 1], outputRange: [p.baseX, p.targetX] });
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [height + 20, p.peak] });
        const opacity = anims[i].interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.85, 0.5, 0] });
        return (
          <Animated.View
            key={`cc-${i}`}
            style={{ position: 'absolute', width: p.size, height: p.length, borderRadius: p.size / 2, backgroundColor: p.color, left: 0, transform: [{ translateX }, { translateY }, { rotate: p.rotate }], opacity }}
          />
        );
      })}
    </View>
  );
}

function CongratsFlash({ visible, footerOffset, onEnd }: CongratsFlashProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);

    const oneCycle = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.delay(100),
    ]);

    const animation = Animated.loop(oneCycle, { iterations: 3 });

    const sub = animation.start(({ finished }) => {
      if (finished && onEnd) onEnd();
    });

    return () => {
      // @ts-expect-error web compat
      if (typeof sub?.stop === 'function') sub.stop();
      opacity.stopAnimation();
    };
  }, [visible, opacity, onEnd]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.congratsWrap, { bottom: footerOffset + 8, opacity }]} testID="congrats-flash">
      <LinearGradient
        colors={monoGradients.yellow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.congratsBadge}
      >
        <Text style={styles.congratsText}>CONGRATULATIONS</Text>
      </LinearGradient>
    </Animated.View>
  );
}

export default function CheckoutScreen() {
  const { items, clearCart, totalPrice, updatePickupTime, updateSpecialInstructions, updateAllergies, updateCookingTemperature } = useCart();
  const { user } = useAuth();
  const [accepted, setAccepted] = useState<boolean>(false);
  const [showThankYou, setShowThankYou] = useState<boolean>(false);
  const [playConfetti, setPlayConfetti] = useState<boolean>(false);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [footerHeight, setFooterHeight] = useState<number>(0);
  const [playCorners, setPlayCorners] = useState<boolean>(false);
  const [showCongrats, setShowCongrats] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const stripe = useStripe();
  const initPaymentSheet = stripe?.initPaymentSheet || null;
  const presentPaymentSheet = stripe?.presentPaymentSheet || null;
  
  const createPaymentIntent = trpc.payments.createPaymentIntent.useMutation();
  const createOrder = trpc.orders.create.useMutation();

  const confettiKey = useRef<number>(0);

  const handlePayment = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Not Available', 'Payment is only available on mobile devices. Please use the mobile app.');
        return;
      }

      if (!user) {
        Alert.alert('Not signed in', 'Please login first.');
        return;
      }
      if (items.length === 0) {
        Alert.alert('Cart is empty', 'Add items to cart before checkout.');
        return;
      }

      setProcessing(true);

      const itemsBySeller = items.reduce((acc, item) => {
        const sellerId = item.meal.plateMakerId;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }
        acc[sellerId].push(item);
        return acc;
      }, {} as Record<string, CartItem[]>);

      const sellerIds = Object.keys(itemsBySeller);
      if (sellerIds.length === 0) {
        Alert.alert('Error', 'No items in cart');
        setProcessing(false);
        return;
      }

      const firstSellerId = sellerIds[0];
      const sellerItems = itemsBySeller[firstSellerId];
      const sellerTotal = sellerItems.reduce((sum, item) => sum + item.meal.price * item.quantity, 0);

      if (sellerIds.length > 1) {
        Alert.alert(
          'Multiple Sellers',
          'Your cart contains items from multiple sellers. Please checkout items from one seller at a time.',
          [{ text: 'OK' }]
        );
        setProcessing(false);
        return;
      }

      const createdOrderIds: string[] = [];

      for (const item of sellerItems) {
        const orderResult = await createOrder.mutateAsync({
          mealId: item.meal.id,
          sellerId: firstSellerId,
          quantity: item.quantity,
          totalPrice: item.meal.price * item.quantity,
          specialInstructions: item.specialInstructions,
          cookingTemperature: item.cookingTemperature,
          allergies: item.allergies,
          pickupTime: item.pickupTime?.toISOString(),
        });
        createdOrderIds.push(orderResult.id);
      }

      const paymentIntentResult = await createPaymentIntent.mutateAsync({
        amount: sellerTotal,
        currency: 'usd',
        sellerId: firstSellerId,
        platformFeePercent: 10,
        orderIds: createdOrderIds,
      });



      if (!initPaymentSheet || !presentPaymentSheet) {
        Alert.alert('Error', 'Payment system not available');
        setProcessing(false);
        return;
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentResult.clientSecret,
        merchantDisplayName: 'HomeCookedPlate',
        returnURL: 'homecookedplate://checkout',
      });

      if (initError) {
        console.error('[Stripe] Init error:', initError);
        Alert.alert('Error', initError.message);
        setProcessing(false);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          console.error('[Stripe] Payment error:', presentError);
          Alert.alert('Payment failed', presentError.message);
        }
        setProcessing(false);
        return;
      }

      clearCart();
      setShowThankYou(true);
      setPlayConfetti(true);
      setPlayCorners(true);
      setShowCongrats(true);
      setProcessing(false);
      confettiKey.current += 1;

      setTimeout(() => {
        setPlayConfetti(true);
        setPlayCorners(true);
        confettiKey.current += 1;
      }, 3200);

      setTimeout(() => {
        setPlayConfetti(true);
        setPlayCorners(true);
        confettiKey.current += 1;
      }, 6400);
    } catch (e) {
      console.error('[Checkout] payment error', e);
      Alert.alert('Error', 'Failed to process payment.');
      setProcessing(false);
    }
  };

  if (user?.role === 'platemaker') {
    return <BuyerOnly />;
  }

  return (
    <BuyerOnly>
      <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.green}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerCard, { paddingTop: insets.top }]}
	            onLayout={(e) => {
	              const h = e.nativeEvent.layout.height;
	              if (h !== headerHeight) {
	                setHeaderHeight(h);
	              }
	            }}>
            <View style={styles.headerTop}>
              <View style={styles.thankYouSection}>
                <Text style={styles.thankYouMessage}>Thank You. Enjoy Your Plate</Text>
                <TouchableOpacity
                  onPress={() => router.replace('/(tabs)/cart')}
                  style={styles.backToCartButton}
                  testID="back-to-cart"
                >
                  <Text style={styles.backToCartText}>Back To Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
        {playConfetti && (
          <ConfettiRain key={`confetti-${confettiKey.current}`} headerOffset={Math.max(headerHeight, 0) || 0} onEnd={() => setPlayConfetti(false)} />
        )}
        {playCorners && (
          <CornerConfetti headerOffset={Math.max(headerHeight, 0) || 0} onEnd={() => setPlayCorners(false)} />
        )}
        <CongratsFlash visible={showCongrats} footerOffset={footerHeight} onEnd={() => setShowCongrats(false)} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(headerHeight, 0) || 0 }]}>
          <View style={styles.content}>


            <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentCard}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Total Amount:</Text>
                <LinearGradient
                  colors={monoGradients.gold}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.priceGradient}
                >
                  <Text style={styles.paymentAmount}>${totalPrice.toFixed(2)}</Text>
                </LinearGradient>
              </View>
              <Text style={styles.paymentInfo}>Payment will be processed securely via Stripe</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Items & Details</Text>
            {items.map((item, idx) => (
              <View key={item.meal.id} style={styles.itemScheduleCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.meal.name}</Text>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
                <ScheduleTimePicker
                  value={item.pickupTime}
                  onChange={(date) => updatePickupTime(item.meal.id, date)}
                  availabilityWindows={item.meal.availabilityWindows}
                  label="Pickup Time"
                  testID={`schedule-${idx}`}
                />
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Special Instructions</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Any special requests or instructions..."
                    placeholderTextColor={Colors.gray[400]}
                    value={item.specialInstructions || ''}
                    onChangeText={(text) => updateSpecialInstructions(item.meal.id, text)}
                    multiline
                    numberOfLines={3}
                    testID={`special-instructions-${idx}`}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Cooking Temperature</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Medium rare, Well done..."
                    placeholderTextColor={Colors.gray[400]}
                    value={item.cookingTemperature || ''}
                    onChangeText={(text) => updateCookingTemperature(item.meal.id, text)}
                    testID={`cooking-temperature-${idx}`}
                  />
                </View>
              </View>
            ))}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Allergies (comma-separated)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Peanuts, Shellfish, Dairy..."
                placeholderTextColor={Colors.gray[400]}
                value={items.length > 0 && items[0].allergies ? items[0].allergies.join(', ') : ''}
                onChangeText={(text) => {
                  const allergies = text.split(',').map(a => a.trim()).filter(a => a.length > 0);
                  items.forEach(item => updateAllergies(item.meal.id, allergies));
                }}
                testID="allergies-input"
              />
              <Text style={styles.inputHint}>This will apply to all items in your order</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
            <Text style={styles.placeholder}>Address and delivery options would go here</Text>
          </View>

          <View style={styles.section} testID="liability-waiver">
            <Text style={styles.sectionTitle}>Liability Waiver</Text>
            <Text style={styles.waiverText}>
              By using and ordering from our PlateMakers on HomeCookedPlate, you agree to not exchange phone numbers or personal information via online food exchanges or during app ordering / communications. You personally accept all responsibility if you give any other person your personal information through the HomeCookedPlate app or any other Appsolete affiliated portal. You waive any right to hold HomeCookedPlate app or any other Appsolete affiliated portal liable for any in-person meetings you conduct while utilizing this app.
            </Text>
            <TouchableOpacity
              onPress={() => setAccepted(prev => !prev)}
              style={[styles.checkboxRow, accepted ? styles.checkboxRowActive : undefined]}
              testID="waiver-accept"
            >
              <View style={[styles.checkbox, accepted ? styles.checkboxChecked : undefined]} />
              <Text style={styles.checkboxLabel}>I have read and accept the liability waiver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

        <View style={styles.footer} onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          <TouchableOpacity
            onPress={handlePayment}
            disabled={!accepted || showThankYou || processing}
            style={[styles.placeOrderButton, (!accepted || showThankYou || processing) && styles.placeOrderButtonDisabled]}
            testID="place-order"
          >
            <LinearGradient
              colors={monoGradients.green}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.placeOrderGradient}
            >
              <Text style={styles.placeOrderText}>
                {showThankYou ? 'Order Placed' : processing ? 'Processing...' : 'Place Order'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </BuyerOnly>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.gray[500],
    fontStyle: 'italic',
  },
  waiverText: {
    fontSize: 13,
    color: Colors.gray[600],
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.gray[50],
  },
  checkboxRowActive: {
    borderColor: Colors.gradient.green,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: Colors.gray[400],
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  checkboxChecked: {
    backgroundColor: Colors.gradient.green,
    borderColor: Colors.gradient.green,
  },
  checkboxLabel: {
    color: Colors.gray[800],
    fontSize: 14,
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 16,
    color: Colors.gray[700],
    fontWeight: '600',
  },
  paymentAmount: {
    fontSize: 24,
    color: Colors.gradient.green,
    fontWeight: '700',
  },
  paymentInfo: {
    fontSize: 12,
    color: Colors.gray[500],
    fontStyle: 'italic',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  staticHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerCard: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTop: {
    minHeight: 96,
    paddingTop: 16,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thankYouSection: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flex: 1,
  },
  thankYouMessage: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  thanksContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  thanksCard: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  thanksInner: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  thanksTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  thanksInline: {
    backgroundColor: Colors.gray[50],
    borderColor: Colors.gray[200],
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  inlineThanksTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gradient.green,
    marginBottom: 4,
  },
  backToCartButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  backToCartText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  backToCheckoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  
  scrollContent: {
    paddingTop: 140,
  },

  congratsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  congratsBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  congratsText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  itemScheduleCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gradient.green,
    marginLeft: 8,
  },
  inputGroup: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.gray[100],
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.gray[900],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    minHeight: 44,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 4,
    fontStyle: 'italic',
  },
  priceGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  placeOrderButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  placeOrderButtonDisabled: {
    opacity: 0.5,
  },
  placeOrderGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
});


