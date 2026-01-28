import React, { useMemo, useState, useCallback } from 'react';
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
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { ProgressBar } from '@/components/ProgressBar';
import { trpc } from '@/lib/trpc';
import { UserTrialControl } from '@/components/Admin/UserTrialControl';
import { CityMaxAlerts } from '@/components/Admin/CityMaxAlerts';
import { PreLaunchChecklist } from '@/components/Admin/PreLaunchChecklist';
import BarChart, { BarDatum } from '@/components/BarChart';
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  ForecastTimeUnit,
  SUBSCRIPTION_PRICES,
  calculatePromotionalCapRevenue,
  forecastRevenueTotals,
} from '@/backend/lib/fees';

type ForecastMode = 'current' | 'at_cap';

function formatCurrency(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

const RevenueForecast = () => {
  const { data: counts, isLoading, error } = trpc.admin.getMetroCounts.useQuery();
  const [unit, setUnit] = useState<ForecastTimeUnit>('monthly');
  const [mode, setMode] = useState<ForecastMode>('current');

  const totals = useMemo(() => {
    if (!counts || counts.length === 0) return null;
    return forecastRevenueTotals({
      metros: counts,
      assumptions: DEFAULT_FORECAST_ASSUMPTIONS,
      unit,
      mode,
    });
  }, [counts, unit, mode]);

  const chartData: BarDatum[] = useMemo(() => {
    if (!totals) return [];
    return [
      { label: 'PM Sub', value: Number(totals.platemaker_subscriptions.toFixed(2)) },
      { label: 'PT Sub', value: Number(totals.platetaker_subscriptions.toFixed(2)) },
      { label: 'PM 10%', value: Number(totals.platemaker_rake.toFixed(2)) },
      { label: 'PT 10%', value: Number(totals.platetaker_fee.toFixed(2)) },
    ];
  }, [totals]);

  const promoMonthly = useMemo(
    () => calculatePromotionalCapRevenue(DEFAULT_FORECAST_ASSUMPTIONS.promoFreeSubscriberPool ?? 0),
    []
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gradient.purple} />
        <Text style={styles.loadingText}>Loading revenue forecast...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading revenue forecast</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (!counts || counts.length === 0 || !totals) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No metro areas found</Text>
      </View>
    );
  }

  return (
    <View style={styles.revenueForecast}>
      <Text style={styles.metroHeader}>Revenue Forecast</Text>
      <Text style={styles.metroSubheader}>
        4 streams: platemaker subs, platetaker subs, platemaker 10% rake, platetaker 10% fee
      </Text>

      <View style={styles.forecastControls}>
        {(['daily', 'weekly', 'monthly', 'quarterly', 'annual'] as ForecastTimeUnit[]).map(u => (
          <Text
            key={u}
            style={[styles.chip, unit === u && styles.chipActive]}
            onPress={() => setUnit(u)}
          >
            {u}
          </Text>
        ))}
      </View>

      <View style={styles.forecastControls}>
        {(['current', 'at_cap'] as ForecastMode[]).map(m => (
          <Text
            key={m}
            style={[styles.chip, mode === m && styles.chipActive]}
            onPress={() => setMode(m)}
          >
            {m === 'current' ? 'current' : 'at cap'}
          </Text>
        ))}
      </View>

      <BarChart data={chartData} height={190} barColor={monoGradients.purple[0]} />

      <View style={styles.forecastSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total ({mode}, {unit})</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.total)}</Text>
        </View>
        <Text style={styles.assumptionsTitle}>Assumptions</Text>
        <Text style={styles.assumptionsText}>
          Subs: {formatCurrency(SUBSCRIPTION_PRICES.MONTHLY)}/mo or {formatCurrency(SUBSCRIPTION_PRICES.ANNUAL)}/yr per paid member.
          {'\n'}GMV model: AOV ${DEFAULT_FORECAST_ASSUMPTIONS.averageOrderValue} and {DEFAULT_FORECAST_ASSUMPTIONS.ordersPerPlatetakerPerMonth} orders/platetaker/month.
          {'\n'}Promo pool: {DEFAULT_FORECAST_ASSUMPTIONS.promoFreeSubscriberPool ?? 0} free slots convert → {formatCurrency(promoMonthly)}/mo when paid.
        </Text>
      </View>
    </View>
  );
};

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
            progress={metro.platemaker_count / maxCap} 
            label={`Makers: ${metro.platemaker_count}/${maxCap}`}
            color="green"
          />
          <ProgressBar 
            progress={metro.platetaker_count / maxCap} 
            label={`Takers: ${metro.platetaker_count}/${maxCap}`}
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

const AuditLogsView = () => {
  const [limit, setLimit] = useState(20);
  const { data: logs, isLoading, error, refetch } = trpc.admin.getAuditLogs.useQuery({ limit });
  const { data: stats } = trpc.admin.getCleanupStats.useQuery();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gradient.purple} />
        <Text style={styles.loadingText}>Loading security logs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading audit logs</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.auditLogsContainer}>
      <Text style={styles.metroHeader}>System Oversight</Text>
      
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>Pending Media Deletions</Text>
        <Text style={styles.statValue}>{stats?.pendingCleanups ?? 0}</Text>
      </View>

      <Text style={styles.subHeader}>Security Audit Trail</Text>
      {logs && logs.length > 0 ? (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const profile = item.profiles as { username?: string; email?: string } | null;
            const actionLabel = item.action?.replace(/_/g, ' ') || 'Unknown Action';
            
            return (
              <View style={styles.logItem}>
                <Text style={styles.logAction}>{actionLabel}</Text>
                <Text style={styles.logMeta}>
                  Table: {item.table_name || 'N/A'} | By: {profile?.username || profile?.email || 'System'}
                </Text>
                <Text style={styles.logTime}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No audit logs found</Text>
        </View>
      )}
    </View>
  );
};

const AdminPromotionView = () => {
  const [targetUserId, setTargetUserId] = useState('');
  const utils = trpc.useUtils();
  
  const promoteMutation = trpc.admin.promoteToAdmin.useMutation({
    onSuccess: (data) => {
      Alert.alert("Success", data.message || "User has been promoted to Admin and logged.");
      setTargetUserId('');
      // Invalidate relevant queries
      utils.admin.getAuditLogs.invalidate();
    },
    onError: (err) => {
      Alert.alert("Promotion Failed", err.message || "Failed to promote user to admin");
    },
  });

  const handlePromote = () => {
    if (!targetUserId.trim()) {
      Alert.alert("Error", "Please enter a User UUID");
      return;
    }
    
    Alert.alert(
      "Confirm Promotion",
      "Warning: This grants full access to system logs and price overrides. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Grant Admin", 
          style: "destructive",
          onPress: () => promoteMutation.mutate({ userId: targetUserId.trim() })
        },
      ]
    );
  };

  return (
    <View style={styles.promotionContainer}>
      <Text style={styles.metroHeader}>Promote User to Admin</Text>
      <Text style={styles.promotionWarning}>
        Warning: This grants full access to system logs and price overrides.
      </Text>
      
      <TextInput
        placeholder="Enter User UUID"
        value={targetUserId}
        onChangeText={setTargetUserId}
        style={styles.promotionInput}
        placeholderTextColor={Colors.gray[400]}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity 
        onPress={handlePromote}
        disabled={promoteMutation.isLoading || !targetUserId.trim()}
        style={[
          styles.promotionButton,
          (promoteMutation.isLoading || !targetUserId.trim()) && styles.promotionButtonDisabled
        ]}
      >
        {promoteMutation.isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.promotionButtonText}>Grant Admin Privileges</Text>
        )}
      </TouchableOpacity>
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
          <RevenueForecast />
          <MetroMonitor />
          <CityMaxAlerts />
          <UserManagement />
          <AdminPromotionView />
          <AuditLogsView />
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
  revenueForecast: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  forecastControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    color: Colors.gray[700],
    fontSize: 12,
    fontWeight: '600',
  },
  chipActive: {
    backgroundColor: Colors.gradient.purple + '1A',
    borderColor: Colors.gradient.purple,
    color: Colors.gray[900],
  },
  forecastSummary: {
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.gray[700],
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.gray[900],
    fontWeight: '700',
  },
  assumptionsTitle: {
    fontSize: 12,
    color: Colors.gray[700],
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  assumptionsText: {
    fontSize: 12,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  auditLogsContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  statCard: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    color: Colors.gray[600],
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.error,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 15,
    color: Colors.gray[900],
  },
  logItem: {
    backgroundColor: Colors.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gradient.purple,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logAction: {
    fontWeight: 'bold',
    fontSize: 14,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  logMeta: {
    fontSize: 12,
    color: Colors.gray[600],
    marginTop: 4,
  },
  logTime: {
    fontSize: 10,
    color: Colors.gray[500],
    marginTop: 4,
  },
  promotionContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  promotionWarning: {
    color: Colors.error,
    marginBottom: 15,
    fontSize: 12,
    fontWeight: '500',
  },
  promotionInput: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 14,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  promotionButton: {
    backgroundColor: Colors.gradient.purple,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  promotionButtonDisabled: {
    opacity: 0.6,
  },
  promotionButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
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
