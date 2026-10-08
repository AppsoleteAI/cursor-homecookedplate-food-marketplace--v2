import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Star, Clock, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import { titleCase } from '@/lib/title-case';
import { GradientButton } from '@/components/GradientButton';
import { allergyOptions, cookingTemperatures } from '@/mocks/data';
import { isSampleMealId } from '@/lib/sample-meals';
import { FoodHandlingLink } from '@/components/FoodHandlingLink';
import { trpc } from '@/lib/trpc';
import { calculateOrderSplit } from '@/lib/fees';
import type { Meal } from '@/types';
import { useCart } from '@/hooks/cart-context';
import { useFavorites } from '@/hooks/favorites-context';
import StarRating from '@/components/StarRating';
import { useReviewsContext } from '@/hooks/reviews-context';
import { useAuth } from '@/hooks/auth-context';
import { navLogger } from '@/lib/nav-logger';
import { captureException } from '@/lib/sentry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SkeletonMealDetail } from '@/components/SkeletonMealDetail';

const { width } = Dimensions.get('window');

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams();
  const mealId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const mealQuery = trpc.meals.get.useQuery(
    { id: mealId, metroArea: user?.metroArea || undefined },
    { enabled: mealId.length > 0 }
  );
  const meal = useMemo<Meal | undefined>(() => {
    const data = mealQuery.data;
    if (!data) return undefined;
    return {
      id: data.id,
      plateMakerId: data.plateMakerId,
      plateMakerName: data.plateMakerName,
      name: data.name,
      description: data.description,
      price: data.price,
      images: data.images || [],
      ingredients: data.ingredients || [],
      cuisine: data.cuisine,
      category: data.category as Meal['category'],
      dietaryOptions: data.dietaryOptions || [],
      preparationTime: data.preparationTime,
      available: data.available,
      rating: data.rating,
      reviewCount: data.reviewCount,
      featured: data.featured || false,
      tags: data.tags || [],
      isSample: data.isSample === true,
    };
  }, [mealQuery.data]);
  const { getAggregates } = useReviewsContext();
  const aggregates = meal ? getAggregates(meal.id) : { average: 0, count: 0 };

  const role: 'platemaker' | 'platetaker' | undefined = user?.role as any;
  const isPlatemaker = role === 'platemaker';
  
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [cookingTemp, setCookingTemp] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  // Log modal mount for Issue #12 (Instrumentation)
  useEffect(() => {
    const logData = {
      mealId: id,
      hasMeal: !!meal,
      platform: Platform.OS,
      screenWidth: width,
      mealImages: meal?.images?.length || 0,
    };
    
    navLogger.routeChange('app/meal/[id].tsx:MODAL_MOUNT', `/meal/${id}`, undefined, logData);
    
    if (__DEV__) {
      console.log('[MealDetail] Component mounted', logData);
    }
     
  }, [id, meal]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      try {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/(home)/home');
        }
        return true;
      } catch (e) {
        console.error('[MealDetail] Back handler error:', e);
        return false;
      }
    });
    return () => sub.remove();
  }, []);

  // Enhanced error handling with logging
  useEffect(() => {
    if (!mealQuery.isLoading && !meal && mealId) {
      const error = new Error(`Meal not found: ${id}`);
      navLogger.error('app/meal/[id].tsx:MEAL_NOT_FOUND', error, `/meal/${id}`, {
        mealId: id,
        platform: Platform.OS,
      });
      captureException(error, {
        context: 'MealDetailScreen',
        mealId: id,
        platform: Platform.OS,
      });
    }
  }, [meal, mealId, mealQuery.isLoading, id]);

  if (mealQuery.isLoading) {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container} edges={Platform.OS === 'android' ? ['top', 'bottom'] : undefined}>
          <Stack.Screen options={{ headerShown: true, title: 'Meal Details' }} />
          <SkeletonMealDetail />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (!meal) {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container} edges={Platform.OS === 'android' ? ['top', 'bottom'] : undefined}>
          <Stack.Screen options={{ headerShown: true, title: 'Meal Details' }} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Meal not found</Text>
            <Text style={styles.errorSubtext}>ID: {id}</Text>
            <GlassPressable onPress={() => router.back()} style={styles.errorButton}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </GlassPressable>
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  const isSample = meal.isSample === true || isSampleMealId(meal.id);

  const handleAddToCart = () => {
    if (isSample) return;
    addToCart(meal, quantity, {
      allergies: selectedAllergies,
      cookingTemperature: cookingTemp,
      specialInstructions: '',
    });
    Alert.alert('Success', 'Added to cart!');
    router.back();
  };

  const openReviews = () => {
    if (!meal) return;
    router.push({ pathname: `/reviews/[mealId]` as const, params: { mealId: meal.id, next: `/meal/${meal.id}` } });
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Contextual Options: Always include Stack.Screen inside the modal file itself
            to bind the context and prevent PreventRemoveContext errors (Issue #1) */}
        <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Meal Details',
          presentation: 'modal',
          headerLeft: () => (
            <GlassPressable 
              onPress={() => router.back()}
              style={{ marginLeft: 10 }}
            >
              <Text style={{ color: Colors.blue[600], fontSize: 16, fontWeight: '600' }}>Close</Text>
            </GlassPressable>
          ),
        }} 
      />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        testID="meal-detail-scroll"
        onLayout={() => {
          if (__DEV__) {
            console.log('[MealDetail] ScrollView laid out', { platform: Platform.OS, width });
          }
        }}
      >
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={Platform.OS === 'android'}
            onScroll={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentImageIndex(index);
            }}
            scrollEventThrottle={16}
            onLayout={() => {
              if (__DEV__) {
                console.log('[MealDetail] Image ScrollView laid out', { 
                  platform: Platform.OS, 
                  imageCount: meal.images.length,
                  width 
                });
              }
            }}
          >
            {meal.images.map((image, index) => (
              <Image 
                key={index} 
                source={{ uri: image }} 
                style={styles.image}
                onLoad={() => {
                  if (__DEV__) {
                    console.log('[MealDetail] Image loaded', { index, platform: Platform.OS });
                  }
                }}
                onError={(error) => {
                  const err = new Error(`Failed to load image ${index}: ${image}`);
                  navLogger.error('app/meal/[id].tsx:IMAGE_LOAD_ERROR', err, `/meal/${id}`, {
                    imageIndex: index,
                    imageUri: image,
                    platform: Platform.OS,
                  });
                  captureException(err, {
                    context: 'MealDetailScreen:ImageLoad',
                    imageIndex: index,
                    imageUri: image,
                    platform: Platform.OS,
                  });
                }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          <View style={styles.imageIndicators}>
            {meal.images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentImageIndex && styles.indicatorActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text style={styles.name}>{titleCase(meal.name)}</Text>
              <Text style={styles.plateMaker}>{meal.plateMakerName}</Text>
              {(meal.dietaryOptions?.length ?? 0) > 0 && (
                <View style={styles.dietRow}>
                  {meal.dietaryOptions.map((option) => (
                    <View key={option} style={styles.dietChip}>
                      <Text style={styles.dietChipText}>{option}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            {!isPlatemaker && (
              <GlassPressable 
                style={styles.favoriteButton}
                onPress={() => meal && toggleFavorite(meal)}
                testID="favorite-button"
              >
                <Heart 
                  size={24} 
                  color={Colors.gradient.red} 
                  fill={meal && isFavorite(meal.id) ? Colors.gradient.red : 'transparent'}
                />
              </GlassPressable>
            )}
          </View>

          <View style={styles.infoRow}>
            <GlassPressable style={styles.rating} onPress={openReviews} testID="open-reviews-detail">
              {isPlatemaker ? (
                <View style={styles.filledStarsOnly}>
                  {Array.from({ length: Math.max(0, Math.round(aggregates.average)) }).map((_, idx) => (
                    <Star key={idx} size={20} color={Colors.gradient.yellow} fill={Colors.gradient.yellow} />
                  ))}
                </View>
              ) : (
                <StarRating
                  value={Math.round(aggregates.average)}
                  baseColor="yellow"
                  size={20}
                  onChange={(val) => {
                    if (!meal) return;
                    router.push({ pathname: `/reviews/[mealId]` as const, params: { mealId: meal.id, next: `/meal/${meal.id}`, initialRating: String(val) } });
                  }}
                />
              )}
              <Text style={styles.ratingText}>{aggregates.average.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({aggregates.count} reviews)</Text>
            </GlassPressable>
            <View style={styles.time}>
              <Clock size={16} color={Colors.gray[500]} />
              <Text style={styles.timeText}>{meal.preparationTime} min</Text>
            </View>
            <View style={styles.location}>
              <Text style={styles.locationText}>{meal.cuisine}</Text>
            </View>
          </View>

          <Text style={styles.price}>${meal.price.toFixed(2)}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{meal.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <View style={styles.ingredientsList}>
              {meal.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <Text style={styles.ingredientText}>• {ingredient}</Text>
                </View>
              ))}
            </View>
            {!isPlatemaker ? (
              <>
                <Text style={styles.description}>
                  Ingredients and allergens are listed by the cook. Tell them about your allergies before you order. If something looks or smells wrong at pickup, do not eat it. Smell and appearance do not prove the food is safe.
                </Text>
                <FoodHandlingLink />
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customization</Text>
            {meal.category !== 'dessert' && (
              <View style={styles.customSection}>
                <Text style={styles.customLabel}>Cooking Temperature</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled={Platform.OS === 'android'}
                  contentContainerStyle={styles.optionsRow}
                >
                  {cookingTemperatures.map(temp => (
                    <GlassPressable
                      key={temp}
                      style={[
                        styles.optionChip,
                        cookingTemp === temp && styles.optionChipActive,
                      ]}
                      onPress={() => setCookingTemp(temp)}
                      disabled={isPlatemaker}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          cookingTemp === temp && styles.optionChipTextActive,
                        ]}
                      >
                        {temp}
                      </Text>
                    </GlassPressable>
                  ))}
                </ScrollView>
                <Text style={styles.description}>
                  A doneness request does not replace a thermometer. Poultry is 165°F, ground meat is 160°F on the home chart, and whole cuts are 145°F plus a 3-minute rest.
                </Text>
                <FoodHandlingLink testID="open-food-handling-cook-temps" />
              </View>
            )}

            <View style={styles.customSection}>
              <Text style={styles.customLabel}>Food Allergies</Text>
              <View style={styles.allergyGrid}>
                {allergyOptions.map(allergy => (
                  <GlassPressable
                    key={allergy}
                    style={[
                      styles.allergyChip,
                      selectedAllergies.includes(allergy) && styles.allergyChipActive,
                    ]}
                    onPress={() => {
                      setSelectedAllergies(prev =>
                        prev.includes(allergy)
                          ? prev.filter(a => a !== allergy)
                          : [...prev, allergy]
                      );
                    }}
                    disabled={isPlatemaker}
                  >
                    <Text
                      style={[
                        styles.allergyChipText,
                        selectedAllergies.includes(allergy) && styles.allergyChipTextActive,
                      ]}
                    >
                      {allergy}
                    </Text>
                  </GlassPressable>
                ))}
              </View>
            </View>
          </View>

          {!isPlatemaker && !isSample && (
            <View style={styles.quantitySection}>
              <Text style={styles.sectionTitle}>Quantity</Text>
              <View style={styles.quantityControls}>
                <GlassPressable
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </GlassPressable>
                <Text style={styles.quantityText}>{quantity}</Text>
                <GlassPressable
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </GlassPressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {!isPlatemaker && isSample && (
        <View style={styles.footer}>
          <Text style={styles.sampleNote}>Sample plate. This one is not for sale. A cook lists a real plate with their own photo or video.</Text>
        </View>
      )}
      {!isPlatemaker && !isSample && (
        <View style={styles.footer}>
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Plate ${ (meal.price * quantity).toFixed(2) }</Text>
            <Text style={styles.totalPrice}>${calculateOrderSplit(meal.price * quantity).totalCaptured.toFixed(2)}</Text>
          </View>
          <GradientButton
            title="Add to Plate"
            onPress={handleAddToCart}
            style={styles.addButton}
          />
        </View>
      )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width,
    height: width * 0.8,
    ...glassSurface,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  indicatorActive: {
    backgroundColor: Colors.white,
    width: 24,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleSection: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  plateMaker: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  dietRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  dietChip: {
    backgroundColor: Colors.gray[100],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dietChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  favoriteButton: {
    padding: 8,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filledStarsOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  reviewCount: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  timeText: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.gradient.green,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.gray[600],
    lineHeight: 24,
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientItem: {
    paddingVertical: 4,
  },
  ingredientText: {
    fontSize: 14,
    color: Colors.gray[700],
  },
  customSection: {
    marginBottom: 20,
  },
  customLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 12,
  },
  optionsRow: {
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    marginRight: 8,
  },
  optionChipActive: {
    backgroundColor: Colors.gradient.orange,
  },
  optionChipText: {
    fontSize: 14,
    color: Colors.gray[700],
  },
  optionChipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  allergyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    marginRight: 8,
    marginBottom: 8,
  },
  allergyChipActive: {
    backgroundColor: Colors.gradient.red,
  },
  allergyChipText: {
    fontSize: 14,
    color: Colors.gray[700],
  },
  allergyChipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  sampleNote: {
    flex: 1,
    color: Colors.gray[700],
    fontSize: 15,
    lineHeight: 21,
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  addButton: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.blue[600],
    borderRadius: 8,
  },
  errorButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
