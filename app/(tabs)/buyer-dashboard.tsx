import React, { useMemo, useState } from 'react';
import { BuyerOnly } from '@/components/RoleGuard';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors, monoGradients } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StarRating from '@/components/StarRating';
import { useFavorites } from '@/hooks/favorites-context';
import { useCart } from '@/hooks/cart-context';
import { router , type Href } from 'expo-router';
import { trpc } from '@/lib/trpc';
import HorizontalCarousel from '@/components/HorizontalCarousel';

export default function BuyerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { favorites } = useFavorites();
  const { addToCart } = useCart();
  const [reorderingMealId, setReorderingMealId] = useState<string | null>(null);

  const { data: orders } = trpc.orders.list.useQuery(
    { role: 'buyer' },
    {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  const purchases = useMemo(() => {
    const seen = new Set<string>();
    return (orders || []).filter((order) => {
      if (seen.has(order.mealId)) return false;
      seen.add(order.mealId);
      return true;
    }).slice(0, 3);
  }, [orders]);

  const handleReorderFromFavorite = async (meal: typeof favorites[0]) => {
    if (!meal) return;
    
    try {
      setReorderingMealId(meal.id);
      
      // Check for previous order to get preferences
      const previousOrder = orders?.find(o => o.mealId === meal.id);
      
      if (previousOrder) {
        // Use previous preferences
        addToCart(meal, previousOrder.quantity, {
          specialInstructions: previousOrder.specialInstructions,
          allergies: previousOrder.allergies,
          cookingTemperature: previousOrder.cookingTemperature,
          pickupTime: previousOrder.pickupTime,
        });
        Alert.alert('Success', 'Meal added to cart with your previous preferences!', [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
        ]);
      } else {
        // Use defaults
        addToCart(meal, 1);
        Alert.alert('Success', 'Meal added to cart!', [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
        ]);
      }
    } catch (error) {
      console.error('[Re-order from Favorite] Error:', error);
      Alert.alert('Error', 'Failed to add to cart. Please try again.');
    } finally {
      setReorderingMealId(null);
    }
  };

  const contentTopPadding = useMemo(() => {
    const baseHeaderHeight = 140;
    const extra = 24;
    return insets.top + baseHeaderHeight + extra;
  }, [insets.top]);

  return (
    <BuyerOnly>
      <View style={styles.container}>
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
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
            <Text testID="recent-purchases-title" style={styles.sectionTitle}>Recent Purchases</Text>
            {purchases.length === 0 ? (
              <Text style={[styles.emptySubtext, { paddingHorizontal: 24 }]}>Your orders will show up here.</Text>
            ) : (
            <HorizontalCarousel contentContainerStyle={styles.horizontal}>
              {purchases.map(order => (
                <TouchableOpacity 
                  key={`p-${order.id}`} 
                  style={styles.card}
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
                </TouchableOpacity>
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
          ) : (
            <HorizontalCarousel contentContainerStyle={styles.horizontal}>
              {favorites.map(m => (
                <View key={`f-${m.id}`} style={styles.card}>
                  <TouchableOpacity 
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
                  </TouchableOpacity>
                  <TouchableOpacity
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
                  </TouchableOpacity>
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

          <TouchableOpacity
            style={styles.farmCard}
            onPress={() => router.push('/farm-grown-basket' as Href)}
            testID="buyer-farm-grown-basket"
          >
            <Text style={styles.farmTitle}>FarmGrownBasket</Text>
            <Text style={styles.farmBody}>Farm goods, CSA shares, and cottage foods. They do not appear in your plate orders.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.truckCard}
            onPress={() => router.push('/food-truck-popup' as Href)}
            testID="buyer-food-truck-popup"
          >
            <Text style={styles.farmTitle}>FoodTruckPopup</Text>
            <Text style={styles.farmBody}>Order ahead from a truck and pick it up at the window. These tickets are not plate orders.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.caterCard}
            onPress={() => router.push('/cater-event-delivered' as Href)}
            testID="buyer-cater-event-delivered"
          >
            <Text style={styles.farmTitle}>CaterEventDelivered</Text>
            <Text style={styles.farmBody}>Group packages for an office, clinic, or event. The company drops off and sets up. These orders are not plate orders.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sitCard}
            onPress={() => router.push('/sit-down-delicious' as Href)}
            testID="buyer-sit-down-delicious"
          >
            <Text style={styles.farmTitle}>SitDownDelicious</Text>
            <Text style={styles.farmBody}>Independent coffee, yogurt, ice cream, and small restaurants. Sit down or take out. These orders are not plate orders.</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </BuyerOnly>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  scrollContent: { paddingBottom: 80 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.white },
  section: { marginBottom: 24 },
  firstSection: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.gray[900], marginBottom: 12, paddingHorizontal: 24 },
  horizontal: { paddingHorizontal: 24, gap: 12 },
  card: { width: 200, backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden', elevation: 1 },
  cardImage: { width: '100%', height: 120 },
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
  sitCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
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
