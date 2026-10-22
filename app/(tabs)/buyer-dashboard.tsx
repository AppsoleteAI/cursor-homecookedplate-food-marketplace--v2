import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BuyerOnly } from '@/components/RoleGuard';
import { AppState, View, Text, StyleSheet, ScrollView, Image, Alert, ActivityIndicator, Pressable } from 'react-native';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StarRating from '@/components/StarRating';
import { useFavorites } from '@/hooks/favorites-context';
import { useCart } from '@/hooks/cart-context';
import { useOrders } from '@/hooks/orders-context';
import { router, useFocusEffect, usePathname, type Href } from 'expo-router';
import { openFoodHandling } from '@/components/FoodHandlingLink';
import { trpc, trpcProxyClient } from '@/lib/trpc';
import { reorderPickup } from '@/lib/pickup-time';
import { savedFavoriteStaysOnDashboard } from '@/lib/cart-line';
import HorizontalCarousel from '@/components/HorizontalCarousel';

export default function BuyerDashboardScreen() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { favorites } = useFavorites();
  const favoriteIds = favorites.map((meal) => meal.id).join(',');
  const [openFavoriteIds, setOpenFavoriteIds] = useState<string[]>([]);
  const [favoritesChecked, setFavoritesChecked] = useState(false);
  const { addToCart } = useCart();
  const { refresh: refreshOrders } = useOrders();
  const [reorderingMealId, setReorderingMealId] = useState<string | null>(null);

  const orderList = trpc.orders.list.useQuery({ role: 'buyer' });
  const orders = orderList.data;
  const cancelOrder = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      orderList.refetch();
      refreshOrders();
    },
    onError: (error) => Alert.alert('Order', error.message),
  });

  const refetchOrders = orderList.refetch;
  useFocusEffect(useCallback(() => {
    refetchOrders();
  }, [refetchOrders]));

  useEffect(() => {
    if (!favoriteIds) {
      setOpenFavoriteIds([]);
      setFavoritesChecked(true);
      return;
    }
    let cancelled = false;
    const ids = favoriteIds.split(',');
    const check = async () => {
      const open: string[] = [];
      for (const id of ids) {
        try {
          const plate = await trpcProxyClient.meals.get.query({ id });
          if (savedFavoriteStaysOnDashboard(plate.acceptingOrders, false)) open.push(id);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!savedFavoriteStaysOnDashboard(undefined, /not on the menu|Meal not found/i.test(message))) {
            open.push(id);
          }
        }
      }
      if (!cancelled) {
        setOpenFavoriteIds(open);
        setFavoritesChecked(true);
      }
    };
    setFavoritesChecked(false);
    void check();
    const timer = setInterval(() => { void check(); }, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [favoriteIds]);

  const shownFavorites = favorites.filter((meal) => openFavoriteIds.includes(meal.id));

  const handleReorderFromFavorite = async (meal: typeof favorites[0]) => {
    if (!meal) return;
    
    try {
      setReorderingMealId(meal.id);
      const fresh = await trpcProxyClient.meals.get.query({ id: meal.id });
      const plate = { ...meal, acceptingOrders: fresh.acceptingOrders === true, available: fresh.available };
      if (plate.available === false || plate.acceptingOrders === false) {
        Alert.alert('Orders', 'This cook is not taking orders.');
        return;
      }
      
      // Check for previous order to get preferences
      const previousOrder = orders?.find(o => o.mealId === meal.id);
      
      if (previousOrder) {
        // Use previous preferences
        const added = addToCart(plate, previousOrder.quantity, {
          specialInstructions: previousOrder.specialInstructions,
          allergies: previousOrder.allergies,
          cookingTemperature: previousOrder.cookingTemperature,
          pickupTime: reorderPickup(previousOrder.pickupTime),
        });
        if (!added) {
          Alert.alert('Orders', 'This cook is not taking orders.');
          return;
        }
        Alert.alert('Success', 'Meal added to cart with your previous preferences!', [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
        ]);
      } else {
        // Use defaults
        const added = addToCart(plate, 1);
        if (!added) {
          Alert.alert('Orders', 'This cook is not taking orders.');
          return;
        }
        Alert.alert('Success', 'Meal added to cart!', [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
        ]);
      }
    } catch (error) {
      console.error('[Re-order from Favorite] Error:', error);
      const message = error instanceof Error ? error.message : 'This cook is not taking orders.';
      Alert.alert('Orders', message);
    } finally {
      setReorderingMealId(null);
    }
  };

  const contentTopPadding = useMemo(() => {
    return insets.top + 76 + 12;
  }, [insets.top]);

  return (
    <BuyerOnly>
      <View style={styles.container}>
        <View style={[styles.headerContainer, { top: insets.top }]}>
          <LinearGradient
            colors={monoGradients.red}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          />
          <View testID="buyer-dashboard-header" style={styles.header}> 
            <Text style={styles.title}>Your Dashboard</Text>
            <Text style={styles.subtitle}>Orders, favorites, and pickup</Text>
          </View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentTopPadding }]}
        >

          <View style={[styles.section, styles.firstSection]}>
            <GlassPressable onPress={() => router.push('/charitable-gifts' as Href)} testID="buyer-charitable-gifts">
              <Text style={styles.sectionTitle}>Charitable gifts</Text>
              <Text style={styles.emptySubtext}>Portions set aside for unhoused people, elders, and children. No card.</Text>
            </GlassPressable>
            <Text testID="recent-purchases-title" style={styles.sectionTitle}>Recent Purchases</Text>
            {(orders || []).length === 0 ? (
              <Text style={[styles.emptySubtext, { paddingHorizontal: 24 }]}>Your orders will show up here.</Text>
            ) : (
            <HorizontalCarousel contentContainerStyle={styles.horizontal}>
              {(orders || []).map(order => (
                <View key={`p-${order.id}`} style={styles.card}>
                  <GlassPressable
                    onPress={() => {
                      try {
                        router.push(`/order/${order.id}` as const);
                      } catch (error) {
                        console.error('[buyer-dashboard] Error navigating to order:', error);
                      }
                    }}
                  >
                    {order.mealImage ? (
                      <Image source={{ uri: order.mealImage }} style={styles.cardImage} />
                    ) : (
                      <View style={styles.cardImage} />
                    )}
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{order.mealName}</Text>
                      <View style={styles.row}>
                        <Text style={styles.meta}>{order.status}</Text>
                      </View>
                    </View>
                  </GlassPressable>
                  {order.status === 'completed' ? (
                    <GlassPressable
                      onPress={() => router.push({ pathname: '/reviews/[mealId]', params: { mealId: order.mealId, next: `/order/${order.id}` } })}
                      testID={`review-purchase-${order.id}`}
                    >
                      <Text style={styles.meta}>Review</Text>
                    </GlassPressable>
                  ) : null}
                  {order.status === 'pending' ? (
                    <GlassPressable
                      onPress={() => {
                        Alert.alert('Cancel this order?', 'A paid order is refunded. An unpaid order is closed.', [
                          { text: 'Keep it', style: 'cancel' },
                          {
                            text: 'Cancel order',
                            style: 'destructive',
                            onPress: () => cancelOrder.mutate({ orderId: order.id, status: 'cancelled' }),
                          },
                        ]);
                      }}
                      testID={`cancel-order-${order.id}`}
                    >
                      <Text style={styles.meta}>Cancel order</Text>
                    </GlassPressable>
                  ) : null}
                </View>
              ))}
            </HorizontalCarousel>
            )}
          </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorite Meals</Text>
          {favorites.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color={Colors.gray[300]} />
              <Text style={styles.emptyText}>No favorite meals yet</Text>
              <Text style={styles.emptySubtext}>Tap the heart icon on any meal to add it here</Text>
            </View>
          ) : shownFavorites.length === 0 ? (
            favoritesChecked ? (
              <Text style={[styles.emptySubtext, { paddingHorizontal: 24 }]}>These cooks are not taking orders.</Text>
            ) : null
          ) : (
            <HorizontalCarousel contentContainerStyle={styles.horizontal}>
              {shownFavorites.map(m => (
                <View key={`f-${m.id}`} style={styles.card}>
                  <GlassPressable 
                    onPress={() => {
                      try {
                        router.push(`/meal/${m.id}` as const);
                      } catch (error) {
                        console.error('[buyer-dashboard] Error navigating to meal from favorites:', error);
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: m.images[0] }} style={styles.cardImage} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{m.name}</Text>
                      <View style={styles.row}>
                        <Ionicons name="heart" size={14} color={Colors.gradient.red} />
                        <StarRating value={Math.round(m.rating)} baseColor="yellow" size={16} />
                      </View>
                    </View>
                  </GlassPressable>
                  <GlassPressable
                    onPress={() => handleReorderFromFavorite(m)}
                    disabled={reorderingMealId === m.id}
                    style={[
                      styles.reorderButton,
                      reorderingMealId === m.id && styles.reorderButtonDisabled,
                    ]}
                  >
                    {reorderingMealId === m.id ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <LinearGradient
                        colors={monoGradients.green}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.reorderGradient}
                      >
                        <Text style={styles.reorderText}>Re-order</Text>
                      </LinearGradient>
                    )}
                  </GlassPressable>
                </View>
              ))}
            </HorizontalCarousel>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup</Text>
          <View style={styles.cardWide}>
            <Text style={styles.label}>How you get the plate</Text>
            <Text style={styles.value}>Plates are picked up from your cook. Open an order to see the pickup time and message them.</Text>
          </View>
        </View>

          <Pressable
            style={styles.handlingCard}
            onPress={() => openFoodHandling(pathname)}
            testID="buyer-food-handling"
          >
            <Text style={styles.handlingTitle}>Food handling</Text>
            <Text style={styles.handlingBody}>Cold food at or below 41°F. Hot food at or above 135°F. Refrigerate perishable food within 2 hours, or 1 hour if it is above 90°F outside.</Text>
          </Pressable>

          <GlassPressable
            style={styles.farmCard}
            onPress={() => router.push('/farm-grown-basket' as Href)}
            testID="buyer-farm-grown-basket"
          >
            <Text style={styles.farmTitle}>FarmGrownBasket</Text>
            <Text style={styles.farmBody}>Produce, eggs, honey, and homemade goods. They do not appear in your plate orders.</Text>
          </GlassPressable>

          <GlassPressable
            style={styles.truckCard}
            onPress={() => router.push('/food-truck-popup' as Href)}
            testID="buyer-food-truck-popup"
          >
            <Text style={styles.farmTitle}>FoodTruckPopup</Text>
            <Text style={styles.farmBody}>Order ahead from a truck and pick it up at the window. These tickets are not plate orders.</Text>
          </GlassPressable>

          <GlassPressable
            style={styles.caterCard}
            onPress={() => router.push('/cater-event-deliver' as Href)}
            testID="buyer-cater-event-deliver"
          >
            <Text style={styles.farmTitle}>CaterEventDeliver</Text>
            <Text style={styles.farmBody}>Group packages for an office, clinic, or event. The company drops off and sets up. These orders are not plate orders.</Text>
          </GlassPressable>

          <GlassPressable
            style={styles.clipsCard}
            onPress={() => router.push('/food-review-clips' as Href)}
            testID="buyer-food-review-clips"
          >
            <Text style={styles.farmTitle}>FoodReviewClips</Text>
            <Text style={styles.farmBody}>Watch 9:16 POV food clips and react with smile, heart, and star. Posting a 20 second clip is for premium members.</Text>
          </GlassPressable>

          <GlassPressable
            style={styles.sitCard}
            onPress={() => router.push('/sit-down-delicious' as Href)}
            testID="buyer-sit-down-delicious"
          >
            <Text style={styles.farmTitle}>SitDownDelicious</Text>
            <Text style={styles.farmBody}>Independent coffee, yogurt, ice cream, and small restaurants. Sit down or take out. These orders are not plate orders.</Text>
          </GlassPressable>

          <GlassPressable
            style={styles.prepCard}
            onPress={() => router.push('/meal-prep-go' as Href)}
            testID="buyer-meal-prep-go"
          >
            <Text style={styles.farmTitle}>MealPrepGo</Text>
            <Text style={styles.farmBody}>A week of heat-and-eat meals, cook-at-home kits, or a mix. These orders are not single plates.</Text>
          </GlassPressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </BuyerOnly>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: pagePastel.red },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, ...glassSurface },
  scrollContent: { paddingBottom: 80 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, minHeight: 76 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.white },
  section: { marginBottom: 24 },
  firstSection: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.gray[900], marginBottom: 12, paddingHorizontal: 24 },
  horizontal: { paddingHorizontal: 24, gap: 12 },
  card: { width: 200, backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden', elevation: 1 },
  cardImage: { width: '100%', height: 120, ...glassSurface },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.gray[900], marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, color: Colors.gray[600] },
  cardWide: { marginHorizontal: 24, backgroundColor: Colors.gray[50], borderRadius: 12, padding: 16 },
  label: { fontSize: 12, color: Colors.gray[600], marginBottom: 6 },
  value: { fontSize: 14, color: Colors.gray[900], marginBottom: 12 },
  editButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  editText: { color: Colors.gray[700], fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.gray[700], marginTop: 16 },
  emptySubtext: { fontSize: 14, color: Colors.gray[500], marginTop: 8, textAlign: 'center' },
  bottomSpacer: { height: 24 },
  handlingCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: Colors.blue[50],
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.blue[200],
  },
  handlingTitle: { fontSize: 16, fontWeight: '700', color: Colors.blue[700] },
  handlingBody: { fontSize: 14, color: Colors.blue[600], marginTop: 6, lineHeight: 20 },
  farmCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  farmTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
  farmBody: { fontSize: 14, color: Colors.gray[600], marginTop: 6, lineHeight: 20 },
  truckCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  caterCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  clipsCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  sitCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  prepCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#ECFEFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  reorderButton: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  reorderButtonDisabled: {
    opacity: 0.6,
  },
  reorderGradient: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
});
