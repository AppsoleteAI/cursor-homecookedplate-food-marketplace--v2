import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';
import HorizontalCarousel from './HorizontalCarousel';

/**
 * Skeleton placeholder for meal cards list
 * 
 * Matches the structure of the home screen meal list:
 * - Featured Meals section with horizontal scroll
 * - Browse by Cuisine section
 * - All Meals grid section
 */
export const SkeletonMealList: React.FC = () => {
  // Meal card skeleton (matches MealCard dimensions)
  const MealCardSkeleton = () => (
    <View style={styles.mealCard}>
      <Skeleton width={160} height={120} borderRadius={12} />
      <View style={styles.mealCardContent}>
        <Skeleton width="80%" height={16} borderRadius={4} style={styles.mealTitle} />
        <Skeleton width="60%" height={14} borderRadius={4} style={styles.mealPrice} />
        <View style={styles.mealRating}>
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );

  // Featured meals horizontal scroll skeleton
  const FeaturedSection = () => (
    <View style={styles.section}>
      <Skeleton width={120} height={20} borderRadius={4} style={styles.sectionTitle} />
      <HorizontalCarousel contentContainerStyle={styles.horizontalScroll}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.featuredCard}>
            <MealCardSkeleton />
          </View>
        ))}
      </HorizontalCarousel>
    </View>
  );

  // All meals grid skeleton
  const AllMealsSection = () => (
    <View style={styles.section}>
      <Skeleton width={100} height={20} borderRadius={4} style={styles.sectionTitle} />
      <View style={styles.grid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.gridItem}>
            <MealCardSkeleton />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FeaturedSection />
      <AllMealsSection />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    marginHorizontal: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 16,
  },
  featuredCard: {
    marginRight: 12,
  },
  mealCard: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealCardContent: {
    padding: 12,
  },
  mealTitle: {
    marginBottom: 8,
  },
  mealPrice: {
    marginBottom: 6,
  },
  mealRating: {
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
});
