import React, { useMemo, useRef, useState, useEffect } from 'react';
import { screenName, titleCase } from '@/lib/title-case';
import { GlassBadge, GlassPressable, glassSurface } from '@/components/glass-surface';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router , type Href } from 'expo-router';
import { Colors, monoGradients, pagePastel } from '@/constants/colors';
import { MealCard } from '@/components/MealCard';
import { cuisineTypes, dietaryOptions } from '@/mocks/data';
import { useAuth } from '@/hooks/auth-context';
import useScrollRestoration from '@/hooks/useScrollRestoration';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import { useOrders } from '@/hooks/orders-context';
import { trpc } from '@/lib/trpc';
import type { Meal } from '@/types';
import { SkeletonMealList } from '@/components/SkeletonMealList';

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { bellCount, markBellSeen } = useOrders();
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string | null>(null);
  const cuisineBrowse: string[] = useMemo(() => cuisineTypes, []);
  const dietaryBrowse: string[] = useMemo(() => dietaryOptions, []);

  // Fetch meals from tRPC backend
  const { data: mealsData, isLoading: mealsLoading, error: mealsError } = trpc.meals.list.useQuery({
    cuisine: selectedCuisine || undefined,
    metroArea: user?.metroArea || undefined,
  });

  // Map tRPC response to Meal interface
  const meals: Meal[] = useMemo(() => {
    if (!mealsData) return [];
    return mealsData.map((meal) => ({
      id: meal.id,
      plateMakerId: meal.plateMakerId,
      plateMakerName: meal.plateMakerName,
      name: meal.name,
      description: meal.description,
      price: meal.price,
      images: meal.images || [],
      ingredients: meal.ingredients || [],
      cuisine: meal.cuisine,
      category: meal.category as Meal['category'],
      dietaryOptions: meal.dietaryOptions || [],
      preparationTime: meal.preparationTime,
      available: meal.available,
      rating: meal.rating,
      reviewCount: meal.reviewCount,
      featured: meal.featured || false,
      tags: meal.tags || [],
      isSample: meal.isSample === true,
    }));
  }, [mealsData]);

  const recentOrders = trpc.orders.list.useQuery(
    { role: 'buyer' },
    { enabled: user?.role === 'platetaker' }
  );

  const reorderShelf = useMemo(() => {
    const seen = new Set<string>();
    const shelf: { mealId: string; mealName: string; mealImage: string; status: string }[] = [];
    for (const order of recentOrders.data || []) {
      if (seen.has(order.mealId)) continue;
      seen.add(order.mealId);
      shelf.push({
        mealId: order.mealId,
        mealName: order.mealName,
        mealImage: order.mealImage,
        status: order.status,
      });
      if (shelf.length === 3) break;
    }
    return shelf;
  }, [recentOrders.data]);

  const featuredMeals = useMemo(() => meals.filter(meal => meal.featured), [meals]);
  const lovedMeals = useMemo(() => {
    return [...meals]
      .filter((meal) => (meal.reviewCount || 0) > 0)
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0) || b.rating - a.rating)
      .slice(0, 8);
  }, [meals]);
  const filteredMeals = useMemo(() => {
    let list = meals;
    if (selectedCuisine) {
      list = list.filter(meal => meal.cuisine === selectedCuisine);
    }
    if (selectedDietary) {
      list = list.filter(meal => (meal.dietaryOptions ?? []).includes(selectedDietary));
    }
    return list;
  }, [meals, selectedCuisine, selectedDietary]);

  const scrollRef = useRef<ScrollView | null>(null);
  const { onScroll } = useScrollRestoration('homeScroll', scrollRef);
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll(e.nativeEvent.contentOffset.x, e.nativeEvent.contentOffset.y);
  };

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fadeAnim = useSharedValue(1);

  const topMeals = useMemo(() => {
    return [...meals]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }, [meals]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Reanimated sequence runs on UI thread for smooth performance
      fadeAnim.value = withSequence(
        withTiming(0, {
          duration: 500,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, {
          duration: 500,
          easing: Easing.in(Easing.quad),
        })
      );

      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % topMeals.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [topMeals.length, fadeAnim]);

  const animatedImageStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const currentMeal = topMeals[currentImageIndex];

  return (
    <View style={styles.container}>
      <View style={styles.staticHeader}>
        <LinearGradient
          colors={monoGradients.yellow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerCard, { paddingTop: insets.top }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Hello, {screenName(user?.username)}!</Text>
              <View style={styles.location}>
                <Ionicons name="location-outline" size={16} color={Colors.white} />
                <Text style={styles.locationText}>{user?.metroArea || 'Pickup near you'}</Text>
              </View>
            </View>
            <GlassPressable style={styles.notificationButton} onPress={() => { markBellSeen().catch(()=>{}); router.push('/notifications-bell'); }} testID="open-notifications-bell">
              <Ionicons name="notifications-outline" size={24} color={Colors.white} />
              {bellCount > 0 && (
                <GlassBadge style={styles.badge} testID="notifications-badge" popKey={bellCount}>
                  <Text style={styles.badgeText}>{bellCount}</Text>
                </GlassBadge>
              )}
            </GlassPressable>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Fresh, Homemade</Text>
            <Text style={styles.heroSubtitle}>Meals Near You</Text>
            
            {currentMeal && (
              <Animated.View style={animatedImageStyle}>
                <Image
                  source={{ uri: currentMeal.images[0] }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </Animated.View>
            )}
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
          <View>
          <Pressable
            style={styles.handlingEntry}
            onPress={() => router.push('/food-handling' as Href)}
            testID="open-food-handling"
          >
            <Text style={styles.handlingKicker}>Food handling</Text>
            <Text style={styles.handlingTitle}>Temperatures for pickup and leftovers</Text>
            <Text style={styles.handlingBody}>Cold food at or below 41°F. Hot food at or above 135°F. Refrigerate perishable food within 2 hours.</Text>
          </Pressable>
          <GlassPressable
            style={styles.farmEntry}
            onPress={() => router.push('/farm-grown-basket' as Href)}
            testID="open-farm-grown-basket"
          >
            <Text style={styles.farmKicker}>FarmGrownBasket</Text>
            <Text style={styles.farmTitle}>Farms, gardens, and co-ops</Text>
            <Text style={styles.farmBody}>Produce, eggs, honey, and homemade goods. Pick them up from the farm.</Text>
          </GlassPressable>
          <GlassPressable
            style={styles.truckEntry}
            onPress={() => router.push('/food-truck-popup' as Href)}
            testID="open-food-truck-popup"
          >
            <Text style={styles.truckKicker}>FoodTruckPopup</Text>
            <Text style={styles.farmTitle}>Food trucks, open windows</Text>
            <Text style={styles.farmBody}>Order ahead and pick up at the truck. Separate from plates and farm goods.</Text>
          </GlassPressable>
          <GlassPressable
            style={styles.caterEntry}
            onPress={() => router.push('/cater-event-deliver' as Href)}
            testID="open-cater-event-deliver"
          >
            <Text style={styles.caterKicker}>CaterEventDeliver</Text>
            <Text style={styles.farmTitle}>Catering and event drop-off</Text>
            <Text style={styles.farmBody}>Per-person packages for offices, clinics, and events. Separate from plates, farms, and trucks.</Text>
          </GlassPressable>
          <GlassPressable
            style={styles.clipsEntry}
            onPress={() => router.push('/food-review-clips' as Href)}
            testID="open-food-review-clips"
          >
            <Text style={styles.clipsKicker}>FoodReviewClips</Text>
            <Text style={styles.farmTitle}>20 second food clips</Text>
            <Text style={styles.farmBody}>Watch 9:16 POV reviews and react with smile, heart, and star. Posting a clip is for premium members.</Text>
          </GlassPressable>
          <GlassPressable
            style={styles.sitEntry}
            onPress={() => router.push('/sit-down-delicious' as Href)}
            testID="open-sit-down-delicious"
          >
            <Text style={styles.sitKicker}>SitDownDelicious</Text>
            <Text style={styles.farmTitle}>Independent restaurants</Text>
            <Text style={styles.farmBody}>Coffee, yogurt, ice cream, and small restaurants. Sit down or take out.</Text>
          </GlassPressable>
          <GlassPressable
            style={styles.prepEntry}
            onPress={() => router.push('/meal-prep-go' as Href)}
            testID="open-meal-prep-go"
          >
            <Text style={styles.prepKicker}>MealPrepGo</Text>
            <Text style={styles.farmTitle}>Weekly plates and prep kits</Text>
            <Text style={styles.farmBody}>Heat-and-eat meals, cook-at-home kits, or a mix. Built for the week, picked up or dropped off.</Text>
          </GlassPressable>
          {mealsError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {mealsError.message || 'Failed to load meals. Please try again.'}
              </Text>
            </View>
          )}

          {mealsLoading && (
            <SkeletonMealList />
          )}

          {!mealsLoading && !mealsError && reorderShelf.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order again</Text>
              <HorizontalCarousel contentContainerStyle={styles.horizontalScroll} testID="reorder-carousel">
                {reorderShelf.map((order) => (
                  <GlassPressable
                    key={order.mealId}
                    style={styles.reorderCard}
                    onPress={() => router.push(`/meal/${order.mealId}` as const)}
                  >
                    {order.mealImage ? (
                      <Image source={{ uri: order.mealImage }} style={styles.reorderImage} />
                    ) : (
                      <View style={[styles.reorderImage, styles.reorderPlaceholder]} />
                    )}
                    <Text style={styles.reorderName} numberOfLines={1}>{order.mealName}</Text>
                    <Text style={styles.reorderStatus}>{order.status}</Text>
                  </GlassPressable>
                ))}
              </HorizontalCarousel>
            </View>
          )}

          {!mealsLoading && !mealsError && topMeals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What sounds good</Text>
              <HorizontalCarousel contentContainerStyle={styles.horizontalScroll} testID="craving-carousel">
                {topMeals.map((meal) => (
                  <GlassPressable
                    key={`craving-${meal.id}`}
                    style={styles.cravingItem}
                    onPress={() => router.push(`/meal/${meal.id}` as const)}
                  >
                    {meal.images[0] ? (
                      <Image source={{ uri: meal.images[0] }} style={styles.cravingImage} />
                    ) : (
                      <View style={[styles.cravingImage, styles.reorderPlaceholder]} />
                    )}
                    <Text style={styles.cravingLabel} numberOfLines={2}>{titleCase(meal.name)}</Text>
                  </GlassPressable>
                ))}
              </HorizontalCarousel>
            </View>
          )}

          {!mealsLoading && !mealsError && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Meals</Text>
            {featuredMeals.length > 0 ? (
              <HorizontalCarousel contentContainerStyle={styles.horizontalScroll} testID="featured-carousel">
                {featuredMeals.map(meal => (
                  <View key={meal.id} style={styles.featuredCard}>
                    <MealCard meal={meal} sizeVariant="featured" />
                  </View>
                ))}
              </HorizontalCarousel>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No featured meals available</Text>
              </View>
            )}
          </View>
          )}

          {!mealsLoading && !mealsError && lovedMeals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Most loved</Text>
              <HorizontalCarousel contentContainerStyle={styles.horizontalScroll} testID="loved-carousel">
                {lovedMeals.map(meal => (
                  <View key={`loved-${meal.id}`} style={styles.featuredCard}>
                    <MealCard meal={meal} sizeVariant="featured" />
                  </View>
                ))}
              </HorizontalCarousel>
            </View>
          )}
          </View>

          <View style={styles.stickyFilters}>
          <Text style={styles.filterLabel}>Cuisine</Text>
          <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="cuisine-carousel">
            {cuisineBrowse.map(cuisine => (
              <GlassPressable
                key={cuisine}
                testID={`cuisine-chip-${cuisine}`}
                style={[
                  styles.cuisineChip,
                  selectedCuisine === cuisine && styles.cuisineChipActive,
                ]}
                onPress={() => setSelectedCuisine(
                  selectedCuisine === cuisine ? null : cuisine
                )}
              >
                <Text
                  style={[
                    styles.cuisineChipText,
                    selectedCuisine === cuisine && styles.cuisineChipTextActive,
                  ]}
                >
                  {cuisine}
                </Text>
              </GlassPressable>
            ))}
          </HorizontalCarousel>
          <Text style={styles.filterLabel}>Dietary</Text>
          <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="dietary-carousel">
            {dietaryBrowse.map(option => (
              <GlassPressable
                key={option}
                testID={`dietary-chip-${option}`}
                style={[
                  styles.cuisineChip,
                  selectedDietary === option && styles.cuisineChipActive,
                ]}
                onPress={() => setSelectedDietary(
                  selectedDietary === option ? null : option
                )}
              >
                <Text
                  style={[
                    styles.cuisineChipText,
                    selectedDietary === option && styles.cuisineChipTextActive,
                  ]}
                >
                  {option}
                </Text>
              </GlassPressable>
            ))}
          </HorizontalCarousel>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Meals</Text>
            {!mealsLoading && !mealsError && filteredMeals.length > 0 ? (
              <View style={styles.mealGrid}>
                {filteredMeals.map(meal => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>{mealsLoading ? 'Loading plates' : 'No meals available'}</Text>
              </View>
            )}
          </View>
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pagePastel.yellow,
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
    ...glassSurface,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  heroContent: {
    marginTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...glassSurface,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.gradient.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: 420 + 44,
    paddingBottom: 100,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 16,
    lineHeight: 34,
  },
  heroImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  horizontalScroll: {
    paddingHorizontal: 24,
    gap: 1.5,
  },
  featuredCard: {
    marginRight: 1.5,
  },
  cuisineScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  stickyFilters: {
    backgroundColor: Colors.white,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray[600],
    paddingHorizontal: 24,
    marginBottom: 8,
    marginTop: 4,
  },
  reorderCard: {
    width: 148,
    marginRight: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    overflow: 'hidden',
  },
  reorderImage: {
    width: '100%',
    height: 96,
    backgroundColor: Colors.gray[100],
    ...glassSurface,
  },
  reorderPlaceholder: {
    backgroundColor: Colors.gray[200],
  },
  reorderName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray[900],
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  reorderStatus: {
    fontSize: 12,
    color: Colors.gray[600],
    paddingHorizontal: 10,
    paddingBottom: 10,
    textTransform: 'capitalize',
  },
  cravingItem: {
    width: 88,
    marginRight: 14,
    alignItems: 'center',
  },
  cravingImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gray[200],
    ...glassSurface,
  },
  cravingLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray[800],
    textAlign: 'center',
  },
  cuisineChip: {
    ...glassSurface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    marginRight: 12,
  },
  cuisineChipActive: {
    backgroundColor: monoGradients.yellow[0],
  },
  cuisineChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  cuisineChipTextActive: {
    color: Colors.white,
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  errorContainer: {
    marginHorizontal: 24,
    marginVertical: 16,
    padding: 16,
    backgroundColor: Colors.error + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
  emptySection: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray[500],
  },
  handlingEntry: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: Colors.blue[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.blue[200],
  },
  handlingKicker: {
    color: Colors.blue[700],
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  handlingTitle: {
    color: Colors.blue[700],
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  handlingBody: {
    color: Colors.blue[600],
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  farmEntry: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...glassSurface,
  },
  farmKicker: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  farmTitle: {
    color: Colors.gray[900],
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  farmBody: {
    color: Colors.gray[600],
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  truckEntry: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
    ...glassSurface,
  },
  truckKicker: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
  },
  caterEntry: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    ...glassSurface,
  },
  caterKicker: {
    color: '#6D28D9',
    fontSize: 12,
    fontWeight: '700',
  },
  clipsEntry: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
    ...glassSurface,
  },
  clipsKicker: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  sitEntry: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    ...glassSurface,
  },
  sitKicker: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  prepEntry: {
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: '#ECFEFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    ...glassSurface,
  },
  prepKicker: {
    color: '#0E7490',
    fontSize: 12,
    fontWeight: '700',
  },
});
