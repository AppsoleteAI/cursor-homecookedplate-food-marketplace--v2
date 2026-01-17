import React, { useState } from 'react';
import { AdminOnly } from '@/components/RoleGuard';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, monoGradients } from '@/constants/colors';
import { GradientButton } from '@/components/GradientButton';
import { trpc } from '@/lib/trpc';

export default function PanicDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  const toggleMaintenanceMutation = trpc.admin.toggleGlobalMaintenance.useMutation({
    onSuccess: (data) => {
      Alert.alert(
        'Success',
        data.message,
        [{ text: 'OK' }]
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to toggle maintenance mode');
    },
  });

  const resetCountsMutation = trpc.admin.resetAllCounts.useMutation({
    onSuccess: (data) => {
      Alert.alert(
        'Success',
        data.message,
        [{ text: 'OK' }]
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to reset counts');
    },
  });

  const triggerGlobalPanic = () => {
    Alert.alert(
      'GLOBAL PANIC',
      'This will deactivate all metros. New signups will be blocked. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SHUT DOWN',
          style: 'destructive',
          onPress: () => {
            toggleMaintenanceMutation.mutate({ shouldActivate: false });
          },
        },
      ]
    );
  };

  const activateAllMetros = () => {
    Alert.alert(
      'Activate All Metros',
      'This will activate all metros. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: () => {
            toggleMaintenanceMutation.mutate({ shouldActivate: true });
          },
        },
      ]
    );
  };

  const resetAllCounts = () => {
    Alert.alert(
      'Emergency Reset',
      'This will reset all metro counts (maker_count and taker_count) to 0 for all metros. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All Counts',
          style: 'destructive',
          onPress: () => {
            resetCountsMutation.mutate();
          },
        },
      ]
    );
  };

  const isLoading = toggleMaintenanceMutation.isPending || resetCountsMutation.isPending;

  return (
    <AdminOnly>
      <View style={styles.container}>
        <View style={styles.staticHeader}>
          <LinearGradient
            colors={monoGradients.red}
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
              <Text style={styles.title}>🚨 Panic Dashboard</Text>
              <Text style={styles.subtitle}>Emergency system control</Text>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
        >
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Global Maintenance Mode</Text>
            <Text style={styles.sectionDescription}>
              Toggle all metros on or off. When deactivated, new signups will be blocked for all metro areas.
            </Text>

            <View style={styles.buttonContainer}>
              <GradientButton
                title="ACTIVATE PANIC BUTTON"
                onPress={triggerGlobalPanic}
                loading={toggleMaintenanceMutation.isPending}
                baseColor="red"
                disabled={isLoading}
              />
            </View>

            <View style={styles.buttonContainer}>
              <GradientButton
                title="Activate All Metros"
                onPress={activateAllMetros}
                loading={toggleMaintenanceMutation.isPending}
                baseColor="green"
                disabled={isLoading}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Emergency Reset</Text>
            <Text style={styles.sectionDescription}>
              Reset all metro counts (maker_count and taker_count) to 0 for all metros. Use with extreme caution.
            </Text>

            <View style={styles.buttonContainer}>
              <GradientButton
                title="Reset All Metro Counts"
                onPress={resetAllCounts}
                loading={resetCountsMutation.isPending}
                baseColor="red"
                disabled={isLoading}
              />
            </View>
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.gradient.red[0]} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}
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
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  loadingOverlay: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[600],
  },
});
