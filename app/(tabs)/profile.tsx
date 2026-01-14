import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        logout().then(() => router.replace('/(auth)/login'));
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline' as const,
      title: 'Edit Profile',
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: 'notifications-outline' as const,
      title: 'Notifications',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Privacy & Security',
      onPress: () => router.push('/privacy-security'),
    },
    {
      icon: 'document-text-outline' as const,
      title: 'Legal & Safety',
      onPress: () => router.push('/legal'),
    },
    {
      icon: 'help-circle-outline' as const,
      title: 'Help & Support',
      onPress: () => router.push('/help-support'),
    },
    {
      icon: 'settings-outline' as const,
      title: 'Settings',
      onPress: () => router.push('/settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image
            source={{ uri: (user?.profileImage ?? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400') }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user?.username || 'Guest User'}</Text>
          <Text style={styles.email}>{user?.email || 'guest@example.com'}</Text>
          <View style={[styles.roleTag, { 
            backgroundColor: user?.role === 'platemaker' ? Colors.gradient.green : Colors.gradient.yellow,
            borderWidth: 2,
            borderColor: user?.role === 'platemaker' ? Colors.gradient.yellow : Colors.gradient.green,
          }]}>
            <Text style={styles.roleText}>
              {user?.role === 'platemaker' ? 'platemaker' : 'platetaker'}
            </Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={22} color={Colors.gray[600]} />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity testID="logout-button" style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.gradient.red} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: Colors.gray[600],
    marginBottom: 12,
  },
  roleTag: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
  },
  roleText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[50],
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.gray[900],
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginVertical: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gradient.red,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gradient.red,
  },
});