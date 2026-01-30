import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton Card Component
 * 
 * Reusable skeleton for meal cards and similar card-based content.
 * Matches the structure of MealCard component.
 */
export const SkeletonCard: React.FC<{ sizeVariant?: 'default' | 'featured' }> = ({ 
  sizeVariant = 'default' 
}) => {
  const cardWidth = sizeVariant === 'featured' ? 160 : '100%';
  const imageHeight = sizeVariant === 'featured' ? 120 : 180;

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <Skeleton width="100%" height={imageHeight} borderRadius={12} style={styles.image} />
      <View style={styles.content}>
        <Skeleton width="80%" height={16} borderRadius={4} style={styles.title} />
        <Skeleton width="60%" height={14} borderRadius={4} style={styles.subtitle} />
        <View style={styles.footer}>
          <Skeleton width={60} height={12} borderRadius={4} />
          <Skeleton width={40} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    marginBottom: 0,
  },
  content: {
    padding: 12,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
});
