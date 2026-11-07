import React, { PropsWithChildren } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { sellerScreenEntry } from '@/lib/role-entry';
import { Colors } from '@/constants/colors';

type GuardProps = PropsWithChildren;

function LoadingFallback() {
  return (
    <View style={styles.container} testID="guard-loading">
      <ActivityIndicator color={Colors.gray[400]} />
    </View>
  );
}

export function useSellerGate() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const entry = sellerScreenEntry({
    loading: isLoading,
    signedIn: isAuthenticated,
    role: user?.role,
    isAdmin: user?.isAdmin === true,
  });
  if (entry === 'wait') return <LoadingFallback />;
  if (entry === 'sign-in') return <Redirect href="/(auth)/login" />;
  if (entry === 'home') return <Redirect href="/(tabs)/(home)/home" />;
  return null;
}

export function SellerOnly({ children }: GuardProps) {
  const gate = useSellerGate();
  if (gate) return gate;
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