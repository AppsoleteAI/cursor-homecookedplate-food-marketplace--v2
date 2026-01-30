import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton placeholder for conversations list
 * 
 * Matches the structure of message conversation items:
 * - Avatar circle
 * - Two text lines (name, preview)
 * - Timestamp skeleton
 */
export const SkeletonMessagesList: React.FC = () => {
  const ConversationItemSkeleton = () => (
    <View style={styles.conversationItem}>
      <Skeleton width={50} height={50} borderRadius={25} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Skeleton width={120} height={16} borderRadius={4} />
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
        <Skeleton width="80%" height={14} borderRadius={4} style={styles.preview} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  preview: {
    marginTop: 4,
  },
});
