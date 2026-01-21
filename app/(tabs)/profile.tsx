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
import { Colors, monoGradients } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MembershipPromoBanner } from '@/components/MembershipPromoBanner';
import * as WebBrowser from 'expo-web-browser';
import { trpc } from '@/lib/trpc';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      Alert.alert('Success', 'Food safety acknowledgment updated');
    },
  });

  const handleAcknowledgmentUpdate = async (acknowledged: boolean) => {
    if (!user || user.role !== 'platemaker') return;
    try {
      await updateProfileMutation.mutateAsync({
        foodSafetyAcknowledged: acknowledged,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update acknowledgment';
      Alert.alert('Error', errorMessage);
    }
  };

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

  const menuItems: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    onPress: () => void;
    subtitle?: string;
  }> = [
    {
      icon: 'star-outline',
      title: 'Membership',
      onPress: () => router.push('/membership'),
      subtitle: membershipTier === 'premium' ? 'Premium Member' : 'Free Member',
    },
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy & Security',
      onPress: () => router.push('/privacy-security'),
    },
    {
      icon: 'document-text-outline',
      title: 'Legal & Safety',
      onPress: () => router.push('/legal'),
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & Support',
      onPress: () => router.push('/help-support'),
    },
    {
      icon: 'settings-outline',
      title: 'Settings',
      onPress: () => router.push('/settings'),
    },
  ];

  const membershipTier = user?.membershipTier || 'free';
  const userLocation = user?.phone || user?.bio || null; // Using profile location if available

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Promo Banner */}
        {membershipTier === 'free' && (
          <MembershipPromoBanner
            userLocation={userLocation}
            membershipTier={membershipTier}
          />
        )}

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
          
          {/* Membership Badge */}
          <View style={styles.membershipBadgeContainer}>
            <LinearGradient
              colors={membershipTier === 'premium' ? monoGradients.gold : [Colors.gray[400], Colors.gray[500]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.membershipBadge}
            >
              <Ionicons
                name={membershipTier === 'premium' ? 'diamond' : 'person'}
                size={16}
                color={Colors.white}
              />
              <Text style={styles.membershipText}>
                {membershipTier === 'premium' ? 'Premium' : 'Free'}
              </Text>
            </LinearGradient>
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

        {user?.role === 'platemaker' && (
          <View style={styles.foodSafetySection}>
            <View style={styles.foodSafetyHeader}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.gradient.green} />
              <Text style={styles.foodSafetyTitle}>Food Safety Acknowledgment</Text>
            </View>
            <View style={styles.foodSafetyContent}>
              <Text style={styles.foodSafetyDescription}>
                We recommend every Platemaker review{' '}
                <Text
                  style={styles.foodSafetyLink}
                  onPress={() => WebBrowser.openBrowserAsync('https://cottagefoodlaws.com')}
                >
                  cottagefoodlaws.com
                </Text>
                {' '}and do your due diligence to meet all food safety requirements from your local, county, state and federal laws before selling food items on the HomeCookedPlate App.
              </Text>
              <View style={styles.acknowledgmentStatusContainer}>
                <View style={styles.acknowledgmentStatusRow}>
                  <Ionicons
                    name={user.foodSafetyAcknowledged ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={user.foodSafetyAcknowledged ? Colors.gradient.green : Colors.gradient.orange}
                  />
                  <Text style={styles.acknowledgmentStatusText}>
                    Status: {user.foodSafetyAcknowledged ? 'Acknowledged' : 'Not Acknowledged'}
                  </Text>
                </View>
                {!user.foodSafetyAcknowledged && (
                  <TouchableOpacity
                    style={styles.acknowledgmentButton}
                    onPress={() => handleAcknowledgmentUpdate(true)}
                    disabled={updateProfileMutation.isLoading}
                  >
                    <Text style={styles.acknowledgmentButtonText}>
                      {updateProfileMutation.isLoading ? 'Updating...' : 'Acknowledge Now'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.acknowledgmentDisclaimerBox}>
                <Text style={styles.acknowledgmentDisclaimerText}>
                  I understand that HomeCookedPlate does not allow anyone to violate their local, county, state and/or federal food laws on the HomeCookedPlate App.
                </Text>
              </View>
            </View>
          </View>
        )}

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
    flex: 1,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.gray[900],
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: Colors.gray[600],
    marginTop: 2,
  },
  membershipBadgeContainer: {
    marginTop: 12,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  membershipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
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
  foodSafetySection: {
    marginHorizontal: 24,
    marginVertical: 24,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  foodSafetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  foodSafetyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  foodSafetyContent: {
    gap: 16,
  },
  foodSafetyDescription: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  foodSafetyLink: {
    color: Colors.gradient.green,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  acknowledgmentStatusContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  acknowledgmentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  acknowledgmentStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  acknowledgmentButton: {
    backgroundColor: Colors.gradient.green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  acknowledgmentButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  acknowledgmentDisclaimerBox: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 8,
    padding: 12,
  },
  acknowledgmentDisclaimerText: {
    fontSize: 13,
    color: Colors.gray[700],
    lineHeight: 18,
    fontStyle: 'italic',
  },
});