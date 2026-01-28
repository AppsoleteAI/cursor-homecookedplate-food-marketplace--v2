import { Tabs, Redirect } from "expo-router";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/hooks/auth-context";
import { useCart } from "@/hooks/cart-context";
import { navLogger } from "@/lib/nav-logger";

export default function TabLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { totalItems } = useCart();
  const isPlatemaker = user?.role === 'platemaker';

  // 1. Prevent logic execution while auth is still loading
  if (isLoading) {
    return null;
  }

  // 2. Fix Issue #9: Handle unauthenticated state gracefully
  // Instead of returning null (blank screen), we declaratively redirect.
  // This ensures that if a session expires, the user is kicked to login.
  if (!isAuthenticated) {
    navLogger.authDecision('app/(tabs)/_layout.tsx:REDIRECT', false, undefined, '/(auth)/login', {
      reason: 'session_expired_or_missing',
    });
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.gray[900],
        tabBarInactiveTintColor: Colors.gray[400],
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.gray[100],
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: () => (
            <Text testID="tab-icon-home" style={styles.emoji} accessibilityLabel="Home Tab Icon">🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarLabel: "Search",
          tabBarIcon: () => (
            <Text testID="tab-icon-search" style={styles.emoji} accessibilityLabel="Search Tab Icon">🔍</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="create-meal"
        options={{
          href: isPlatemaker ? undefined : null,
          title: "Create Meal",
          tabBarLabel: "Create Meal",
          tabBarIcon: () => (
            <Text testID="tab-icon-create" style={styles.emoji} accessibilityLabel="Create Meal Tab Icon">🍳</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          href: isPlatemaker ? undefined : null,
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: () => (
            <Text testID="tab-icon-dashboard" style={styles.emoji} accessibilityLabel="Dashboard Tab Icon">💰</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: isPlatemaker ? null : undefined,
          title: "Cart",
          tabBarLabel: "Cart",
          tabBarIcon: () => (
            <View>
              <Text testID="tab-icon-cart" style={styles.emoji} accessibilityLabel="Cart Tab Icon">🛒</Text>
              {totalItems > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalItems}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="buyer-dashboard"
        options={{
          href: isPlatemaker ? null : undefined,
          title: "Orders",
          tabBarLabel: "Orders",
          tabBarIcon: () => (
            <Text testID="tab-icon-buyer-dashboard" style={styles.emoji} accessibilityLabel="Buyer Dashboard Tab Icon">🍕</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: () => (
            <Text testID="tab-icon-profile" style={styles.emoji} accessibilityLabel="Profile Tab Icon">👤</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.gradient.red,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  emoji: {
    fontSize: 24,
    textAlign: 'center' as const,
  },
});