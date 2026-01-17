import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export const CityMaxAlerts: React.FC = () => {
  const { data: alerts, isLoading, error } = trpc.admin.getSystemAlerts.useQuery();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gradient.purple} />
        <Text style={styles.loadingText}>Loading City Max Alerts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading alerts</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <View style={styles.alertPanel}>
        <Text style={styles.header}>Recent City Max Alerts</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No alerts to display</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.alertPanel}>
      <Text style={styles.header}>Recent City Max Alerts</Text>
      <ScrollView style={styles.alertList} showsVerticalScrollIndicator={false}>
        {alerts.map((alert) => (
          <View key={alert.id} style={styles.alertItem}>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <Text style={styles.alertTime}>
              {new Date(alert.createdAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  alertPanel: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 16,
  },
  alertList: {
    maxHeight: 400,
  },
  alertItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gradient.orange[0],
  },
  alertMessage: {
    fontSize: 14,
    color: Colors.gray[700],
    marginBottom: 4,
    lineHeight: 20,
  },
  alertTime: {
    fontSize: 12,
    color: Colors.gray[500],
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
