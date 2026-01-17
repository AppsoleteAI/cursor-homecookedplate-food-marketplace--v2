import React, { useState, useCallback } from 'react';
import { AdminOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { ProgressBar } from '@/components/ProgressBar';
import { trpc } from '@/lib/trpc';
import { UserTrialControl } from '@/components/Admin/UserTrialControl';
import { CityMaxAlerts } from '@/components/Admin/CityMaxAlerts';
import { PreLaunchChecklist } from '@/components/Admin/PreLaunchChecklist';

const MetroMonitor = () => {
  const { data: counts, isLoading, error } = trpc.admin.getMetroCounts.useQuery();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gradient.green} />
        <Text style={styles.loadingText}>Loading metro counts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading metro counts</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (!counts || counts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No metro areas found</Text>
      </View>
    );
  }

  const maxCap = counts[0]?.max_cap || 100;

  return (
    <View style={styles.metroMonitor}>
      <Text style={styles.metroHeader}>Metro Cap Monitor</Text>
      {counts.map(metro => (
        <View key={metro.metro_name} style={styles.metroRow}>
          <Text style={styles.metroName}>{metro.metro_name}</Text>
          <ProgressBar 
            progress={metro.maker_count / maxCap} 
            label={`Makers: ${metro.maker_count}/${maxCap}`}
            color="green"
          />
          <ProgressBar 
            progress={metro.taker_count / maxCap} 
            label={`Takers: ${metro.taker_count}/${maxCap}`}
            color="green"
          />
        </View>
      ))}
    </View>
  );
};

const MetroControlRow = ({ metro }: { metro: { metro_name: string; is_active: boolean; trial_days: number } }) => {
  const utils = trpc.useUtils();
  
  // Toggle city on/off or change trial length
  const updateMetro = trpc.admin.updateMetroSettings.useMutation({
    onSuccess: () => {
      utils.admin.getMetroCounts.invalidate();
    },
  });

  const [trialDaysValue, setTrialDaysValue] = useState(String(metro.trial_days));

  const handleTrialDaysChange = (text: string) => {
    setTrialDaysValue(text);
    const days = Number(text);
    if (!isNaN(days) && days > 0) {
      updateMetro.mutate({ name: metro.metro_name, trial_days: days });
    }
  };

  return (
    <View style={styles.metroControlRow}>
      <View style={styles.metroControlHeader}>
        <Text style={styles.metroControlName}>{metro.metro_name}</Text>
        <Switch 
          value={metro.is_active} 
          onValueChange={(val) => updateMetro.mutate({ name: metro.metro_name, is_active: val })} 
        />
      </View>
      
      <View style={styles.trialDaysContainer}>
        <Text style={styles.trialDaysLabel}>Trial Days:</Text>
        <TextInput
          style={styles.trialDaysInput}
          value={trialDaysValue}
          keyboardType="numeric"
          onChangeText={handleTrialDaysChange}
          placeholder="90"
        />
      </View>
    </View>
  );
};

const MetroSettings = () => {
  const { data: counts, isLoading, error } = trpc.admin.getMetroCounts.useQuery();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gradient.purple} />
        <Text style={styles.loadingText}>Loading metro settings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading metro settings</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (!counts || counts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No metro areas found</Text>
      </View>
    );
  }

  return (
    <View style={styles.metroSettings}>
      <Text style={styles.metroHeader}>Metro Settings</Text>
      <Text style={styles.metroSubheader}>Toggle metro signups and adjust trial periods</Text>
      {counts.map(metro => (
        <MetroControlRow key={metro.metro_name} metro={metro} />
      ))}
    </View>
  );
};

const UserManagement = () => {
  const [userId, setUserId] = useState('');
  const [extensionDays, setExtensionDays] = useState('30');

  return (
    <View style={styles.userManagement}>
      <Text style={styles.metroHeader}>User Management</Text>
      <Text style={styles.metroSubheader}>
        Manually extend trial periods for specific users. Bypasses automated limits for high-value users.
      </Text>
      
      <View style={styles.userManagementRow}>
        <Text style={styles.inputLabel}>User ID (UUID):</Text>
        <TextInput
          style={styles.userIdInput}
          value={userId}
          onChangeText={setUserId}
          placeholder="Enter user UUID"
          placeholderTextColor={Colors.gray[400]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.userManagementRow}>
        <Text style={styles.inputLabel}>Extension Days:</Text>
        <TextInput
          style={styles.extensionDaysInput}
          value={extensionDays}
          onChangeText={setExtensionDays}
          keyboardType="numeric"
          placeholder="30"
          placeholderTextColor={Colors.gray[400]}
        />
      </View>

      <View style={styles.trialButtonContainer}>
        <UserTrialControl
          userId={userId.trim()}
          extensionDays={Number(extensionDays) || 30}
        />
      </View>
    </View>
  );
};

export default function AdminDashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // The query will automatically refetch when we invalidate it
    // For now, just wait a bit to show the refresh indicator
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <AdminOnly>
      <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.purple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerGradient, { paddingTop: insets.top }]}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height ?? 0;
              if (h !== headerHeight) {
                setHeaderHeight(h);
              }
            }}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Admin Dashboard</Text>
              <Text style={styles.subtitle}>Monitor metro area caps and system metrics</Text>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <PreLaunchChecklist />
          <MetroMonitor />
          <CityMaxAlerts />
          <UserManagement />
        </ScrollView>
      </View>
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  staticHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  metroMonitor: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  metroHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 20,
  },
  metroRow: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  metroName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  metroSettings: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  metroSubheader: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 20,
  },
  metroControlRow: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  metroControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metroControlName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    flex: 1,
  },
  trialDaysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trialDaysLabel: {
    fontSize: 14,
    color: Colors.gray[700],
    fontWeight: '500',
  },
  trialDaysInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
    minWidth: 80,
  },
  userManagement: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  userManagementRow: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.gray[700],
    fontWeight: '600',
    marginBottom: 8,
  },
  userIdInput: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
    fontFamily: 'monospace',
  },
  extensionDaysInput: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
    width: 120,
  },
  trialButtonContainer: {
    marginTop: 8,
  },
});
