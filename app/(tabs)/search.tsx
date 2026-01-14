import React, { useState, useCallback, useEffect } from 'react';
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
import { mockMeals } from '@/mocks/data';
import { useRouter } from 'expo-router';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);

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

  const filteredMeals = mockMeals.filter(meal => {
    if (!isSearchActive) return true;
    const matchesSearch = meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <View style={styles.container}>
      <View style={styles.staticHeader}>
        <LinearGradient
          colors={monoGradients.orange}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerCard, { paddingTop: insets.top }]}
        >
          <View style={styles.headerInner}>
            <Text style={styles.title}>Search Meals</Text>
            <View style={styles.searchContainer}>
              <View style={[styles.searchBar, isInputFocused ? styles.searchBarFocused : null]} testID="search-bar">
                <TouchableOpacity onPress={doSearch} accessibilityRole="button" testID="execute-search">
                  <Ionicons name="search" size={20} color={Colors.gray[200]} />
                </TouchableOpacity>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for meals..."
                  placeholderTextColor={Colors.gray[200]}
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
              <TouchableOpacity
                style={styles.filterButton}
                onPress={openFilter}
                accessibilityRole="button"
                testID="toggle-filters"
              >
                <Ionicons name="options-outline" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
            {isSearchActive && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetSearch}
                accessibilityRole="button"
                testID="reset-search"
              >
                <Ionicons name="close" size={16} color={Colors.white} />
                <Text style={styles.resetButtonText}>Back to Search</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 2,
    borderColor: 'transparent',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingTop: 240,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
