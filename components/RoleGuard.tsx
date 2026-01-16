import React, { PropsWithChildren } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { Colors } from '@/constants/colors';

type GuardProps = PropsWithChildren;

function LoadingFallback() {
  return (
    <View style={styles.container} testID="guard-loading">
      <ActivityIndicator color={Colors.gray[400]} />
    </View>
  );
}

export function SellerOnly({ children }: GuardProps) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <LoadingFallback />;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const isSeller = user?.role === 'platemaker';
  const isAdmin = user?.isAdmin === true;

  if (!isSeller && !isAdmin) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  return <>{children}</>;
}

export function BuyerOnly({ children }: GuardProps) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <LoadingFallback />;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const isBuyer = user?.role === 'platetaker';
  const isAdmin = user?.isAdmin === true;

  if (!isBuyer && !isAdmin) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <>{children}</>;
}

export function AdminOnly({ children }: GuardProps) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <LoadingFallback />;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.isAdmin !== true) {
    return <Redirect href="/(tabs)/(home)/home" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});