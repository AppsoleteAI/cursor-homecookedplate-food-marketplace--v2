import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // 1. Wait for Auth to initialize
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loader} testID="index-loading">
          <ActivityIndicator color={Colors.gray[400]} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // 2. Declarative Redirects (Native-Safe)
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Role-based routing for authenticated users
  if (user?.role === 'platemaker') {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(tabs)/(home)/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 16,
  },
});
