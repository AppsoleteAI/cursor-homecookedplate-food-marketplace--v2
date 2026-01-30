import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton placeholder for orders list
 * 
 * Matches the structure of order cards:
 * - Image
 * - Title
 * - Price
 * - Status badge
 */
export const SkeletonOrdersList: React.FC = () => {
  const OrderCardSkeleton = () => (
    <View style={styles.orderCard}>
      <Skeleton width="100%" height={150} borderRadius={12} style={styles.image} />
      <View style={styles.content}>
        <Skeleton width="80%" height={18} borderRadius={4} style={styles.title} />
        <View style={styles.footer}>
          <Skeleton width={80} height={16} borderRadius={4} />
          <Skeleton width={60} height={20} borderRadius={10} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4].map((i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    marginBottom: 12,
  },
  content: {
    padding: 12,
  },
  title: {
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
