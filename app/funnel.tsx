import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, monoGradients } from '@/constants/colors';
import { MealCard } from '@/components/MealCard';
import { mockMeals, cuisineTypes, dietaryOptions } from '@/mocks/data';
import { useRouter, Stack } from 'expo-router';

export default function FunnelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [minRating, setMinRating] = useState<number>(0);

  const resetFiltersAndGoBack = useCallback(() => {
    setSearchQuery('');
    setSelectedCuisines([]);
    setSelectedDietary([]);
    setSelectedCategories([]);
    setSelectedTags([]);
    setPriceRange({ min: null, max: null });
    setMinRating(0);
    router.back();
  }, [router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      resetFiltersAndGoBack();
      return true;
    });

    return () => backHandler.remove();
  }, [resetFiltersAndGoBack]);

  const categories = useMemo(() => {
    const mealCategories = Array.from(new Set(mockMeals.map(m => m.category)));
    const allCategories = [...new Set([...mealCategories, 'breakfast', 'brunch', 'vegan'])];
    return allCategories;
  }, []);
  const tags = useMemo(() => Array.from(new Set((mockMeals.flatMap(m => m.tags ?? []) as string[]))), []);

  const filteredMeals = mockMeals.filter(meal => {
    const matchesSearch = meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCuisine = selectedCuisines.length === 0 || selectedCuisines.includes(meal.cuisine);
    const matchesDietary = selectedDietary.length === 0 ||
      selectedDietary.some(diet => meal.dietaryOptions.includes(diet));
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(meal.category);
    const matchesPrice = (priceRange.min === null || meal.price >= priceRange.min) && (priceRange.max === null || meal.price <= priceRange.max);
    const mealTags: string[] = meal.tags ?? [];
    const matchesTags = selectedTags.length === 0 || selectedTags.some(t => mealTags.includes(t));
    const matchesRating = meal.rating >= minRating;

    return matchesSearch && matchesCuisine && matchesDietary && matchesCategory && matchesPrice && matchesTags && matchesRating;
  });

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  const toggleDietary = (option: string) => {
    setSelectedDietary(prev =>
      prev.includes(option)
        ? prev.filter(d => d !== option)
        : [...prev, option]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => (prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const clearFilters = () => {
    setSelectedCuisines([]);
    setSelectedDietary([]);
    setSelectedCategories([]);
    setSelectedTags([]);
    setPriceRange({ min: null, max: null });
    setMinRating(0);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.staticHeader}>
        <LinearGradient
          colors={monoGradients.orange}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerCard, { paddingTop: insets.top }]}
        >
          <View style={styles.headerInner}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={resetFiltersAndGoBack}
                accessibilityRole="button"
                testID="back-to-search"
              >
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.title}>Funnel Search</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={resetFiltersAndGoBack} testID="back-to-search-button">
                <Text style={styles.actionButton}>Back To Search</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearFilters} testID="clear-filters">
                <Text style={styles.actionButton}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140 }]}
      >
        <View style={styles.filtersContainer} testID="filters-panel">
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, selectedCategories.includes(cat) && styles.chipActive]}
                  onPress={() => toggleCategory(cat)}
                  testID={`chip-category-${cat}`}
                >
                  <Text style={[styles.chipText, selectedCategories.includes(cat) && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Cuisine</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {cuisineTypes.map(cuisine => (
                <TouchableOpacity
                  key={cuisine}
                  style={[
                    styles.chip,
                    selectedCuisines.includes(cuisine) && styles.chipActive,
                  ]}
                  onPress={() => toggleCuisine(cuisine)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedCuisines.includes(cuisine) && styles.chipTextActive,
                    ]}
                  >
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Dietary</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {dietaryOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    selectedDietary.includes(option) && styles.chipActive,
                  ]}
                  onPress={() => toggleDietary(option)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedDietary.includes(option) && styles.chipTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Price</Text>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24 }}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceLabel}>Min</Text>
                <TextInput
                  style={styles.priceInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.gray[400]}
                  value={priceRange.min !== null ? String(priceRange.min) : ''}
                  onChangeText={(t) => setPriceRange(pr => ({ ...pr, min: t === '' ? null : Number(t) }))}
                  testID="price-min"
                />
              </View>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceLabel}>Max</Text>
                <TextInput
                  style={styles.priceInput}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={Colors.gray[400]}
                  value={priceRange.max !== null ? String(priceRange.max) : ''}
                  onChangeText={(t) => setPriceRange(pr => ({ ...pr, max: t === '' ? null : Number(t) }))}
                  testID="price-max"
                />
              </View>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Minimum rating</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
              {[0,1,2,3,4,5].map(r => (
                <TouchableOpacity
                  key={`r-${r}`}
                  style={[styles.chip, minRating === r && styles.chipActive]}
                  onPress={() => setMinRating(r)}
                  testID={`min-rating-${r}`}
                >
                  <Text style={[styles.chipText, minRating === r && styles.chipTextActive]}>{r === 0 ? 'Any' : `${r}★+`}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
              {tags.map(tag => (
                <TouchableOpacity key={tag} style={[styles.chip, selectedTags.includes(tag) && styles.chipActive]} onPress={() => toggleTag(tag)} testID={`chip-tag-${tag}`}>
                  <Text style={[styles.chipText, selectedTags.includes(tag) && styles.chipTextActive]}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <Text style={styles.resultCount}>
          {filteredMeals.length} meals found
        </Text>
        <View style={styles.mealGrid}>
          {filteredMeals.map(meal => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </View>
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
  headerInner: {
    paddingVertical: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'flex-end',
  },
  actionButton: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  filtersContainer: {
    backgroundColor: Colors.gray[50],
    paddingVertical: 16,
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  filterChips: {
    paddingHorizontal: 24,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.gradient.yellow,
    borderColor: Colors.gradient.yellow,
  },
  chipText: {
    fontSize: 14,
    color: Colors.gray[700],
  },
  chipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  resultCount: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 20,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.gray[600],
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray[900],
  },
});
