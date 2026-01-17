import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export const PreLaunchChecklist: React.FC = () => {
  const { data: checkpoints, isLoading, error } = trpc.admin.verifyPreLaunch.useQuery();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gradient.purple} />
        <Text style={styles.loadingText}>Verifying pre-launch requirements...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading checklist</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (!checkpoints || checkpoints.length === 0) {
    return (
      <View style={styles.checklistPanel}>
        <Text style={styles.header}>Pre-Launch Checklist</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No checkpoints available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.checklistPanel}>
      <Text style={styles.header}>Pre-Launch Checklist</Text>
      <Text style={styles.subheader}>Single Source of Truth for pre-launch verification</Text>
      
      {checkpoints.map((checkpoint, index) => {
        const statusEmoji = checkpoint.status === 'pass' ? '🟢' : '🔴';
        const statusText = checkpoint.status === 'pass' ? 'Pass' : 'Fail';
        const statusColor = checkpoint.status === 'pass' ? Colors.gradient.green[0] : '#EF4444';

        return (
          <View key={index} style={styles.checkpointItem}>
            <View style={styles.checkpointHeader}>
              <Text style={styles.checkpointName}>{checkpoint.checkpoint}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusEmoji}>{statusEmoji}</Text>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>
            <Text style={styles.checkpointMessage}>{checkpoint.message}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  checklistPanel: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  subheader: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 20,
  },
  checkpointItem: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  checkpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkpointName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusEmoji: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  checkpointMessage: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  loadingContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
  errorContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error || '#EF4444',
    marginBottom: 4,
  },
  errorDetail: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray[500],
    fontStyle: 'italic',
  },
});
