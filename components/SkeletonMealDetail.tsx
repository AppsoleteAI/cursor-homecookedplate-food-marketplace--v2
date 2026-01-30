import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton Meal Detail Component
 * 
 * Loading state for meal detail screen.
 * Matches the structure of meal detail layout.
 */
export const SkeletonMealDetail: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Skeleton */}
        <Skeleton width="100%" height={300} borderRadius={0} />

        {/* Content Section */}
        <View style={styles.content}>
          {/* Title and Price */}
          <View style={styles.header}>
            <Skeleton width="70%" height={28} borderRadius={4} style={styles.title} />
            <Skeleton width={80} height={24} borderRadius={4} />
          </View>

          {/* Rating and Location */}
          <View style={styles.meta}>
            <Skeleton width={100} height={16} borderRadius={4} />
            <Skeleton width={120} height={16} borderRadius={4} />
          </View>

          {/* Description */}
          <View style={styles.description}>
            <Skeleton width="100%" height={14} borderRadius={4} style={styles.descriptionLine} />
            <Skeleton width="90%" height={14} borderRadius={4} style={styles.descriptionLine} />
            <Skeleton width="95%" height={14} borderRadius={4} style={styles.descriptionLine} />
          </View>

          {/* Allergies Section */}
          <View style={styles.section}>
            <Skeleton width={120} height={20} borderRadius={4} style={styles.sectionTitle} />
            <View style={styles.chips}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} width={80} height={32} borderRadius={16} style={styles.chip} />
              ))}
            </View>
          </View>

          {/* Quantity Selector */}
          <View style={styles.section}>
            <Skeleton width={100} height={20} borderRadius={4} style={styles.sectionTitle} />
            <View style={styles.quantityRow}>
              <Skeleton width={40} height={40} borderRadius={8} />
              <Skeleton width={60} height={24} borderRadius={4} />
              <Skeleton width={40} height={40} borderRadius={8} />
            </View>
          </View>

          {/* Add to Cart Button */}
          <Skeleton width="100%" height={56} borderRadius={12} style={styles.button} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    marginBottom: 0,
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  description: {
    marginBottom: 24,
  },
  descriptionLine: {
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 0,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    marginTop: 8,
  },
});
