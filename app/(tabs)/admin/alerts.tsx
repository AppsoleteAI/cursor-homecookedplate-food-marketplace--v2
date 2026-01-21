import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, monoGradients } from '@/constants/colors';
import { AdminOnly } from '@/components/RoleGuard';
import { trpc } from '@/lib/trpc';

interface SystemAlert {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
  resolved: boolean;
}

export default function AdminAlertsFeed() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: alerts, isLoading, error, refetch } = trpc.admin.getSystemAlerts.useQuery();

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return Colors.error || '#EF4444';
      case 'high':
        return Colors.warning || '#F59E0B';
      case 'medium':
        return Colors.gradient.orange[0] || '#FB923C';
      case 'low':
        return Colors.info || '#3B82F6';
      default:
        return Colors.gray[400];
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'warning';
      case 'medium':
        return 'information-circle';
      case 'low':
        return 'checkmark-circle';
      default:
        return 'ellipse';
    }
  };

  return (
    <AdminOnly>
      <View style={styles.container}>
        <View style={styles.header}>
          <LinearGradient
            colors={monoGradients.blue}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerGradient, { paddingTop: insets.top }]}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>City Max Alerts</Text>
              <View style={styles.headerSpacer} />
            </View>
          </LinearGradient>
        </View>

        {isLoading && !alerts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.info} />
            <Text style={styles.loadingText}>Loading alerts...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading alerts</Text>
            <Text style={styles.errorDetail}>{error.message}</Text>
          </View>
        ) : (
          <FlatList
            data={alerts || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.info}
              />
            }
            renderItem={({ item }: { item: SystemAlert }) => {
              const severityColor = getSeverityColor(item.severity);
              // Standardize: metadata uses snake_case (metro_name) as sent from backend/hono.ts
              const metroName = item.metadata?.metro_name;
              
              return (
                <View
                  style={[
                    styles.alertCard,
                    {
                      borderLeftColor: severityColor,
                      backgroundColor: item.resolved ? Colors.gray[50] : Colors.white,
                    },
                  ]}
                >
                  <View style={styles.alertHeader}>
                    <View style={styles.alertHeaderLeft}>
                      <Ionicons
                        name={getSeverityIcon(item.severity) as any}
                        size={20}
                        color={severityColor}
                        style={styles.severityIcon}
                      />
                      <Text style={styles.alertType}>{item.title}</Text>
                    </View>
                    <Text style={styles.alertTime}>
                      {new Date(item.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </View>
                  
                  <Text style={styles.alertMessage}>{item.message}</Text>
                  
                  {item.alertType && (
                    <View style={styles.alertTypeBadge}>
                      <Text style={styles.alertTypeText}>{item.alertType}</Text>
                    </View>
                  )}
                  
                  {metroName && (
                    <View style={styles.metroInfo}>
                      <Ionicons name="location" size={16} color={Colors.info} />
                      <Text style={styles.metroName}>{metroName}</Text>
                    </View>
                  )}
                  
                  {item.resolved && (
                    <View style={styles.resolvedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.resolvedText}>Resolved</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={64} color={Colors.gray[300]} />
                <Text style={styles.emptyText}>No alerts to display</Text>
                <Text style={styles.emptySubtext}>System is running smoothly</Text>
              </View>
            }
          />
        )}
      </View>
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
  errorContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.error || '#EF4444',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  alertCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityIcon: {
    marginRight: 8,
  },
  alertType: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  alertTime: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  alertMessage: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
    marginBottom: 8,
  },
  alertTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  alertTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray[700],
    textTransform: 'uppercase',
  },
  metroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metroName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.info,
    marginLeft: 4,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[700],
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray[500],
    marginTop: 4,
  },
});
