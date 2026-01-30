import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton placeholder for notifications list
 * 
 * Matches the structure of notification items:
 * - Icon circle
 * - Two text lines (title, message)
 * - Timestamp skeleton
 */
export const SkeletonNotificationsList: React.FC = () => {
  const NotificationItemSkeleton = () => (
    <View style={styles.notificationItem}>
      <Skeleton width={40} height={40} borderRadius={20} style={styles.icon} />
      <View style={styles.content}>
        <Skeleton width="70%" height={16} borderRadius={4} style={styles.title} />
        <Skeleton width="90%" height={14} borderRadius={4} style={styles.message} />
        <Skeleton width={80} height={12} borderRadius={4} style={styles.timestamp} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <NotificationItemSkeleton key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  icon: {
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 8,
  },
  message: {
    marginBottom: 6,
  },
  timestamp: {
    marginTop: 4,
  },
});
