import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { Colors, monoGradients } from '@/constants/colors';
import { cuisineTypes, dietaryOptions, mockMeals } from '@/mocks/data';
import { MealCard } from '@/components/MealCard';
import { Ionicons } from '@expo/vector-icons';
import HorizontalCarousel from '@/components/HorizontalCarousel';
import { useAuth } from '@/hooks/auth-context';
import { useCart } from '@/hooks/cart-context';

const categories: string[] = ['dinner', 'dessert', 'lunch', 'breakfast', 'brunch', 'vegan'];
const ratings: string[] = ['Any', '1★+', '2★+', '3★+', '4★+', '5★+'];
const tags: string[] = [
  '#comfort-food',
  '#family-favorite',
  '#homemade',
  '#spicy',
  '#creamy',
  '#popular',
  '#sweet',
  '#coffee',
  '#classic',
  '#healthy',
  '#aromatic',
  '#plant-based',
  '#breakfast',
  '#brunch',
  '#vegan',
];

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { totalItems } = useCart();
  const isPlatemaker = user?.role === 'platemaker';

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<string>('Any');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const toggleSelection = (item: string, list: string[], setter: (list: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedCuisines([]);
    setSelectedDietary([]);
    setSelectedRating('Any');
    setSelectedTags([]);
    setMinPrice('0');
    setMaxPrice('100');
  };

  const filteredMeals = mockMeals.filter(meal => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(meal.category)) {
      return false;
    }
    if (selectedCuisines.length > 0 && !selectedCuisines.includes(meal.cuisine)) {
      return false;
    }
    if (selectedDietary.length > 0) {
      const hasDietary = selectedDietary.some(diet =>
        (meal.dietaryOptions ?? []).some(opt => opt.toLowerCase().includes(diet.toLowerCase()))
      );
      if (!hasDietary) return false;
    }
    if (selectedRating !== 'Any') {
      const minRating = parseInt(selectedRating.charAt(0));
      if (meal.rating < minRating) return false;
    }
    if (selectedTags.length > 0) {
      const hasTag = selectedTags.some(tag => (meal.tags ?? []).includes(tag.replace('#', '')));
      if (!hasTag) return false;
    }
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || 100;
    if (meal.price < min || meal.price > max) {
      return false;
    }
    return true;
  });

  const footerItems = useMemo(() => {
    if (isPlatemaker) {
      return (
        [
          { key: 'home', label: 'Home', route: '/(tabs)/(home)/home', emoji: '🏠' },
          { key: 'search', label: 'Search', route: '/(tabs)/search', emoji: '🔍' },
          { key: 'create', label: 'Create', route: '/(tabs)/create-meal', emoji: '🍳' },
          { key: 'dashboard', label: 'Dashboard', route: '/(tabs)/dashboard', emoji: '💰' },
          { key: 'profile', label: 'Profile', route: '/(tabs)/profile', emoji: '👤' },
        ] as const
      );
    }
    return (
      [
        { key: 'home', label: 'Home', route: '/(tabs)/(home)/home', emoji: '🏠' },
        { key: 'search', label: 'Search', route: '/(tabs)/search', emoji: '🔍' },
        { key: 'cart', label: 'Cart', route: '/(tabs)/cart', emoji: '🛒' },
        { key: 'orders', label: 'Orders', route: '/(tabs)/buyer-dashboard', emoji: '🍕' },
        { key: 'profile', label: 'Profile', route: '/(tabs)/profile', emoji: '👤' },
      ] as const
    );
  }, [isPlatemaker]);

  const HEADER_BASE_HEIGHT = 144;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerBackground}>
        <LinearGradient
          colors={monoGradients.orange}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top, minHeight: HEADER_BASE_HEIGHT + insets.top }]}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>Filter Search</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                testID="back-to-search"
              >
                <Text style={styles.headerButtonText}>Back To Search</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAll}
                testID="clear-all"
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
              >
                <Ionicons name="refresh" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_BASE_HEIGHT + insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="category-carousel">
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.cuisineChip,
                  selectedCategories.includes(category) && styles.cuisineChipActive,
                ]}
                onPress={() => toggleSelection(category, selectedCategories, setSelectedCategories)}
                testID={`category-${category}`}
              >
                <Text
                  style={[
                    styles.cuisineChipText,
                    selectedCategories.includes(category) && styles.cuisineChipTextActive,
                  ]}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </HorizontalCarousel>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuisine</Text>
          <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="cuisine-carousel">
            {cuisineTypes.map(cuisine => (
              <TouchableOpacity
                key={cuisine}
                style={[
                  styles.cuisineChip,
                  selectedCuisines.includes(cuisine) && styles.cuisineChipActive,
                ]}
                onPress={() => toggleSelection(cuisine, selectedCuisines, setSelectedCuisines)}
                testID={`cuisine-${cuisine}`}
              >
                <Text
                  style={[
                    styles.cuisineChipText,
                    selectedCuisines.includes(cuisine) && styles.cuisineChipTextActive,
                  ]}
                >
                  {cuisine}
                </Text>
              </TouchableOpacity>
            ))}
          </HorizontalCarousel>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dietary</Text>
          <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="dietary-carousel">
            {dietaryOptions.map(dietary => (
              <TouchableOpacity
                key={dietary}
                style={[
                  styles.chip,
                  selectedDietary.includes(dietary) && styles.chipSelected,
                ]}
                onPress={() => toggleSelection(dietary, selectedDietary, setSelectedDietary)}
                testID={`dietary-${dietary}`}
              >
                <Text
                  style={[
                    styles.dietaryText,
                    selectedDietary.includes(dietary) && styles.chipTextSelected,
                  ]}
                >
                  {dietary}
                </Text>
              </TouchableOpacity>
            ))}
          </HorizontalCarousel>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price</Text>
          <View style={styles.priceContainer}>
            <View style={styles.priceInput}>
              <Text style={styles.priceLabel}>Min</Text>
              <TextInput
                style={styles.priceTextInput}
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.gray[400]}
                testID="min-price"
              />
            </View>
            <View style={styles.priceInput}>
              <Text style={styles.priceLabel}>Max</Text>
              <TextInput
                style={styles.priceTextInput}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={Colors.gray[400]}
                testID="max-price"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minimum rating</Text>
          <View style={styles.chipContainer}>
            {ratings.map(rating => (
              <TouchableOpacity
                key={rating}
                style={[
                  styles.chip,
                  selectedRating === rating && styles.chipSelected,
                ]}
                onPress={() => setSelectedRating(rating)}
                testID={`rating-${rating}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedRating === rating && styles.chipTextSelected,
                  ]}
                >
                  {rating}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <HorizontalCarousel contentContainerStyle={styles.cuisineScroll} testID="tags-carousel">
            {tags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.chip,
                  selectedTags.includes(tag) && styles.chipSelected,
                ]}
                onPress={() => toggleSelection(tag, selectedTags, setSelectedTags)}
                testID={`tag-${tag}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedTags.includes(tag) && styles.chipTextSelected,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </HorizontalCarousel>
        </View>

        <View style={styles.resultsSection}>
          <Text style={styles.resultCount}>{filteredMeals.length} meals found</Text>
          <View style={styles.mealGrid}>
            {filteredMeals.map(meal => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]} testID="filter-footer-menu">
        {footerItems.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.footerItem}
            onPress={() => {
              if (item.key === 'home') {
                router.replace(item.route);
              } else {
                router.push(item.route);
              }
            }}
            accessibilityRole="button"
            testID={`footer-${item.key}`}
          >
            <View>
              <Text style={styles.footerEmoji}>{item.emoji}</Text>
              {item.key === 'cart' && totalItems > 0 ? (
                <View style={styles.cartBadge} testID="filter-cart-badge">
                  <Text style={styles.cartBadgeText}>{totalItems}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.footerLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  headerBackground: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    paddingTop: 16,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
  },
  clearButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  clearButtonText: {
    fontSize: 20,
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
  },
  chipSelected: {
    backgroundColor: monoGradients.orange[0],
  },
  chipSelectedYellow: {
    backgroundColor: Colors.gradient.yellow,
    borderColor: Colors.gradient.yellow,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  chipTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray[600],
    marginBottom: 4,
  },
  priceTextInput: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.gray[600],
    padding: 0,
  },
  resultsSection: {
    paddingHorizontal: 0,
    marginTop: 8,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[600],
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  cuisineScroll: {
    paddingHorizontal: 0,
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
    backgroundColor: monoGradients.orange[0],
  },
  cuisineChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  cuisineChipTextActive: {
    color: Colors.white,
  },
  dietaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  footerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  footerEmoji: {
    fontSize: 22,
  },
  footerLabel: {
    fontSize: 10,
    color: Colors.gray[700],
    marginTop: 2,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.gradient.red,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
