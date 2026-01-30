import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './SkeletonScreen';

/**
 * Skeleton Dashboard Component
 * 
 * Loading state for platemaker dashboard.
 * Matches the structure of dashboard stats grid and availability card.
 */
export const SkeletonDashboard: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Availability Card Skeleton */}
      <View style={styles.availabilityCard}>
        <View style={styles.availabilityHeader}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={150} height={18} borderRadius={4} />
          <Skeleton width={50} height={30} borderRadius={15} />
        </View>
        <Skeleton width="100%" height={14} borderRadius={4} style={styles.availabilitySubtext} />
      </View>

      {/* Stats Grid Skeleton */}
      <View style={styles.statsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statCard}>
            <Skeleton width={24} height={24} borderRadius={12} style={styles.statIcon} />
            <Skeleton width={80} height={24} borderRadius={4} style={styles.statValue} />
            <Skeleton width={100} height={14} borderRadius={4} style={styles.statLabel} />
          </View>
        ))}
      </View>

      {/* Orders Section Skeleton */}
      <View style={styles.section}>
        <Skeleton width={120} height={20} borderRadius={4} style={styles.sectionTitle} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.orderCard}>
            <Skeleton width="100%" height={100} borderRadius={8} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  availabilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  availabilitySubtext: {
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    marginBottom: 4,
  },
  statLabel: {
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  orderCard: {
    marginBottom: 12,
  },
});
