import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton List Component
 * 
 * Reusable skeleton for list-based content (orders, messages, notifications).
 * Provides consistent loading state for list views.
 */
export const SkeletonList: React.FC<{ 
  itemCount?: number;
  showHeader?: boolean;
}> = ({ 
  itemCount = 5,
  showHeader = true 
}) => {
  const ListItemSkeleton = () => (
    <View style={styles.listItem}>
      <Skeleton width={60} height={60} borderRadius={8} style={styles.avatar} />
      <View style={styles.listItemContent}>
        <Skeleton width="70%" height={16} borderRadius={4} style={styles.listItemTitle} />
        <Skeleton width="50%" height={14} borderRadius={4} style={styles.listItemSubtitle} />
      </View>
      <Skeleton width={40} height={14} borderRadius={4} />
    </View>
  );

  return (
    <View style={styles.container}>
      {showHeader && (
        <Skeleton width={120} height={20} borderRadius={4} style={styles.header} />
      )}
      {Array.from({ length: itemCount }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    marginBottom: 6,
  },
  listItemSubtitle: {
    marginBottom: 0,
  },
});
