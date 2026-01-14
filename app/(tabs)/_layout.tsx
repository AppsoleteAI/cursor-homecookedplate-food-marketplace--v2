import { Tabs, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/hooks/auth-context";
import { useCart } from "@/hooks/cart-context";

export default function TabLayout() {
  const { user, isAuthenticated } = useAuth();
  const { totalItems } = useCart();
  const router = useRouter();
  const isPlatemaker = user?.role === 'platemaker';

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
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