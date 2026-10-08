import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GlassPressable, glassSurface } from '@/components/glass-surface';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, inAppHeaderBand, monoGradients, pagePastel } from '@/constants/colors';
import { MealCard } from '@/components/MealCard';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/auth-context';
import type { Meal } from '@/types';
import { useRouter } from 'expo-router';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const doSearch = useCallback(() => {
    if (searchQuery.trim()) {
      setIsSearchActive(true);
    }
  }, [searchQuery]);

  const resetSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchActive(false);
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSearchActive) {
        resetSearch();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isSearchActive, resetSearch]);

  const openFilter = useCallback(() => {
    router.push('/filter');
  }, [router]);

  const { data: mealsData, isLoading, error } = trpc.meals.list.useQuery({
    metroArea: user?.metroArea || undefined,
  });
  const meals: Meal[] = useMemo(() => {
    return (mealsData || []).map((meal) => ({
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

  const filteredMeals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!isSearchActive || !query) return meals;
    return meals.filter((meal) => {
      const diet = (meal.dietaryOptions || []).join(' ').toLowerCase();
      return meal.name.toLowerCase().includes(query)
        || meal.description.toLowerCase().includes(query)
        || meal.cuisine.toLowerCase().includes(query)
        || meal.plateMakerName.toLowerCase().includes(query)
        || diet.includes(query);
    });
  }, [meals, searchQuery, isSearchActive]);

  return (
    <View style={styles.container}>
      <View style={[styles.staticHeader, { top: insets.top }]}>
        <LinearGradient
          colors={monoGradients.orange}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height ?? 0;
            if (next !== headerHeight) setHeaderHeight(next);
          }}
        >
          <View style={styles.headerInner}>
            <Text style={styles.title}>Search Meals</Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + headerHeight + 12 }]}
      >
            <View style={styles.searchContainer}>
              <View style={[styles.searchBar, isInputFocused ? styles.searchBarFocused : null]} testID="search-bar">
                <GlassPressable onPress={doSearch} accessibilityRole="button" testID="execute-search">
                  <Ionicons name="search" size={20} color={Colors.gray[600]} />
                </GlassPressable>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Meals, cooks, or cuisines"
                  placeholderTextColor={Colors.gray[500]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={doSearch}
                  testID="search-input"
                  numberOfLines={1}
                  multiline={false}
                  inputMode="search"
                  returnKeyType="search"
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                />
              </View>
              <GlassPressable
                style={styles.filterButton}
                onPress={openFilter}
                accessibilityRole="button"
                testID="toggle-filters"
              >
                <Ionicons name="options-outline" size={20} color={Colors.gray[800]} />
              </GlassPressable>
            </View>
            {isSearchActive && (
              <GlassPressable
                style={styles.resetButton}
                onPress={resetSearch}
                accessibilityRole="button"
                testID="reset-search"
              >
                <Ionicons name="close" size={16} color={Colors.gray[800]} />
                <Text style={styles.resetButtonText}>Back to Search</Text>
              </GlassPressable>
            )}
        <Text style={styles.resultCount}>
          {isLoading ? 'Loading plates' : error ? 'Could not load plates' : `${filteredMeals.length} meals found`}
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
    backgroundColor: pagePastel.orange,
  },
  staticHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerCard: {
    paddingHorizontal: inAppHeaderBand.paddingHorizontal,
    paddingTop: inAppHeaderBand.paddingTop,
    paddingBottom: inAppHeaderBand.paddingBottom,
    minHeight: inAppHeaderBand.minHeight,
    justifyContent: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...glassSurface,
  },
  headerInner: {
    paddingVertical: 0,
  },
  title: {
    fontSize: inAppHeaderBand.titleSize,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  searchBarFocused: {
    borderColor: '#2F6BFF',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Colors.gray[900],
    overflow: 'hidden',
  },

  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
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
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[800],
  },
});
