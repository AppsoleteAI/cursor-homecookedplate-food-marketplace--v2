import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { MealCard } from '@/components/MealCard';
import { cuisineTypes, dietaryOptions } from '@/mocks/data';
import { useAuth } from '@/hooks/auth-context';
import useScrollRestoration from '@/hooks/useScrollRestoration';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import { useOrders } from '@/hooks/orders-context';
import { trpc } from '@/lib/trpc';
import type { Meal } from '@/types';

export default function HomeScreen() {
  useAuth();
  const insets = useSafeAreaInsets();
  const { bellCount, markBellSeen } = useOrders();
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string | null>(null);
  const cuisineBrowse: string[] = useMemo(() => cuisineTypes, []);
  const dietaryBrowse: string[] = useMemo(() => dietaryOptions, []);

  // Fetch meals from tRPC backend
  const { data: mealsData, isLoading: mealsLoading, error: mealsError } = trpc.meals.list.useQuery({
    cuisine: selectedCuisine || undefined,
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
    }));
  }, [mealsData]);

  const featuredMeals = useMemo(() => meals.filter(meal => meal.featured), [meals]);
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
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const topMeals = useMemo(() => {
    return [...meals]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }, [meals]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % topMeals.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [topMeals.length, fadeAnim]);

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
              <Text style={styles.greeting}>Hello, plate!</Text>
              <View style={styles.location}>
                <Ionicons name="location-outline" size={16} color={Colors.white} />
                <Text style={styles.locationText}>Brooklyn, NY</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notificationButton} onPress={() => { markBellSeen().catch(()=>{}); router.push('/notifications-bell'); }} testID="open-notifications-bell">
              <Ionicons name="notifications-outline" size={24} color={Colors.white} />
              {bellCount > 0 && (
                <View style={styles.badge} testID="notifications-badge">
                  <Text style={styles.badgeText}>{bellCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Fresh, Homemade</Text>
            <Text style={styles.heroSubtitle}>Meals Near You</Text>
            
            {currentMeal && (
              <Animated.View style={{ opacity: fadeAnim }}>
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
          {mealsError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {mealsError.message || 'Failed to load meals. Please try again.'}
              </Text>
            </View>
          )}

          {mealsLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.gradient.green} />
              <Text style={styles.loadingText}>Loading meals...</Text>
            </View>
          )}

          {!mealsLoading && !mealsError && (
            <>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Browse by Cuisine</Text>
            <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="cuisine-carousel">
              {cuisineBrowse.map(cuisine => (
                <TouchableOpacity
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
                </TouchableOpacity>
              ))}
            </HorizontalCarousel>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Browse by Dietary Restrictions</Text>
            <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="dietary-carousel">
              {dietaryBrowse.map(option => (
                <TouchableOpacity
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
                </TouchableOpacity>
              ))}
            </HorizontalCarousel>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Meals</Text>
            {filteredMeals.length > 0 ? (
              <View style={styles.mealGrid}>
                {filteredMeals.map(meal => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No meals available</Text>
              </View>
            )}
          </View>
          </>
          )}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
  cuisineChip: {
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
});
