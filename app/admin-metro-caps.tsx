import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, monoGradients } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';

interface MetroCount {
  metro_name: string;
  platemaker_count: number;
  platetaker_count: number;
  max_cap: number;
  updated_at: string;
}

export default function AdminMetroCapsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedMetro, setSelectedMetro] = useState<string | null>(null);
  const [newMaxCap, setNewMaxCap] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  // Verify admin access
  if (!user?.isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Admin privileges required</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { data: metroCounts, isLoading, refetch } = trpc.admin.getMetroCounts.useQuery();
  const updateMaxCapMutation = trpc.admin.updateMaxCap.useMutation({
    onSuccess: () => {
      Alert.alert('Success', `Max cap updated to ${newMaxCap} for ${selectedMetro}`);
      setSelectedMetro(null);
      setNewMaxCap('');
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update max cap');
    },
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleUpdateMaxCap = () => {
    if (!selectedMetro || !newMaxCap) {
      Alert.alert('Error', 'Please select a metro and enter a max cap value');
      return;
    }

    const cap = parseInt(newMaxCap, 10);
    if (isNaN(cap) || cap < 0) {
      Alert.alert('Error', 'Max cap must be a positive number');
      return;
    }

    Alert.alert(
      'Confirm Update',
      `Update max cap for "${selectedMetro}" to ${cap}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: () => {
            updateMaxCapMutation.mutate({
              metro_name: selectedMetro,
              max_cap: cap,
            });
          },
        },
      ]
    );
  };

  const getStatusColor = (count: number, maxCap: number) => {
    const percentage = (count / maxCap) * 100;
    if (percentage >= 100) return Colors.error; // At cap (red)
    if (percentage >= 80) return Colors.warning; // Near cap (orange)
    if (percentage >= 50) return Colors.gradient.yellow; // Mid-range
    return Colors.success; // Low usage (green)
  };

  const getStatusText = (count: number, maxCap: number) => {
    const percentage = (count / maxCap) * 100;
    if (percentage >= 100) return 'FULL';
    if (percentage >= 80) return 'NEAR CAP';
    if (percentage >= 50) return 'MODERATE';
    return 'AVAILABLE';
  };

  return (
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
            <Text style={styles.headerTitle}>Metro Cap Management</Text>
            <View style={styles.headerSpacer} />
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cap Monitoring</Text>
          <Text style={styles.infoText}>
            Monitor metro area member counts and adjust max_cap per metro.
            Notifications are automatically sent when any count hits max_cap.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.info} />
            <Text style={styles.loadingText}>Loading metro counts...</Text>
          </View>
        ) : metroCounts && metroCounts.length > 0 ? (
          <>
            {metroCounts.map((metro: MetroCount) => {
              const makerStatus = getStatusColor(metro.platemaker_count, metro.max_cap);
              const takerStatus = getStatusColor(metro.platetaker_count, metro.max_cap);
              const isSelected = selectedMetro === metro.metro_name && isEditing;

              return (
                <View key={metro.metro_name} style={styles.metroCard}>
                  <View style={styles.metroHeader}>
                    <Text style={styles.metroName}>{metro.metro_name}</Text>
                    {!isSelected && (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                          setSelectedMetro(metro.metro_name);
                          setNewMaxCap(metro.max_cap.toString());
                          setIsEditing(true);
                        }}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.blue[600]} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.countsContainer}>
                    <View style={styles.countRow}>
                      <Text style={styles.countLabel}>Platemakers:</Text>
                      <View style={styles.countValueContainer}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: makerStatus },
                          ]}
                        />
                        <Text style={styles.countValue}>
                          {metro.platemaker_count} / {metro.max_cap}
                        </Text>
                        <Text
                          style={[
                            styles.statusText,
                            { color: makerStatus },
                          ]}
                        >
                          {getStatusText(metro.platemaker_count, metro.max_cap)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.countRow}>
                      <Text style={styles.countLabel}>Platetakers:</Text>
                      <View style={styles.countValueContainer}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: takerStatus },
                          ]}
                        />
                        <Text style={styles.countValue}>
                          {metro.platetaker_count} / {metro.max_cap}
                        </Text>
                        <Text
                          style={[
                            styles.statusText,
                            { color: takerStatus },
                          ]}
                        >
                          {getStatusText(metro.platetaker_count, metro.max_cap)}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.editContainer}>
                        <Text style={styles.editLabel}>New Max Cap:</Text>
                        <TextInput
                          style={styles.editInput}
                          value={newMaxCap}
                          onChangeText={setNewMaxCap}
                          keyboardType="number-pad"
                          placeholder={`Current: ${metro.max_cap}`}
                          placeholderTextColor={Colors.gray[400]}
                        />
                        <View style={styles.editActions}>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                              setSelectedMetro(null);
                              setNewMaxCap('');
                              setIsEditing(false);
                            }}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleUpdateMaxCap}
                            disabled={updateMaxCapMutation.isPending}
                          >
                            {updateMaxCapMutation.isPending ? (
                              <ActivityIndicator
                                size="small"
                                color={Colors.white}
                              />
                            ) : (
                              <Text style={styles.saveButtonText}>Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No metro counts found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    zIndex: 10,
  },
  headerGradient: {
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: Colors.blue[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.blue[200],
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.blue[900],
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.blue[700],
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
  metroCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  metroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metroName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  countsContainer: {
    gap: 12,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  countLabel: {
    fontSize: 14,
    color: Colors.gray[700],
    fontWeight: '600',
  },
  countValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  editContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: Colors.gray[300],
    gap: 12,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  editInput: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.gray[900],
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  saveButton: {
    backgroundColor: Colors.info,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.blue[600],
  },
});
