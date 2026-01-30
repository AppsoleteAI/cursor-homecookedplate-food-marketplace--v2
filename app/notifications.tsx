import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Bell, ShoppingBag, MessageSquare, DollarSign, Star, Mail, Smartphone } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useNotifications } from '@/hooks/notifications-context';
import { SkeletonNotificationsList } from '@/components/SkeletonNotificationsList';

export default function NotificationsScreen() {
  const { preferences, isLoading, hasPermission, updatePreference } = useNotifications();

  const notificationSettings = [
    {
      icon: ShoppingBag,
      title: 'Order Updates',
      description: 'Get notified about order status changes',
      key: 'orderUpdates' as const,
    },
    {
      icon: MessageSquare,
      title: 'New Messages',
      description: 'Receive alerts for new messages',
      key: 'newMessages' as const,
    },
    {
      icon: DollarSign,
      title: 'Payment Alerts',
      description: 'Notifications for payments and earnings',
      key: 'paymentAlerts' as const,
    },
    {
      icon: Star,
      title: 'Reviews & Ratings',
      description: 'Get notified when you receive reviews',
      key: 'reviewsRatings' as const,
    },
    {
      icon: Bell,
      title: 'Promotions',
      description: 'Special offers and promotional content',
      key: 'promotions' as const,
    },
  ];

  const channelSettings = [
    {
      icon: Mail,
      title: 'Email Notifications',
      description: 'Receive notifications via email',
      key: 'emailNotifications' as const,
    },
    {
      icon: Smartphone,
      title: 'Push Notifications',
      description: Platform.OS === 'web' 
        ? 'Push notifications are not available on web'
        : hasPermission 
          ? 'Receive push notifications on your device'
          : 'Enable push notifications (permission required)',
      key: 'pushNotifications' as const,
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Notifications',
            headerShown: false,
          }}
        />
        <SkeletonNotificationsList />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: false,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Types</Text>
            <Text style={styles.sectionDescription}>
              Choose which notifications you want to receive
            </Text>
            {notificationSettings.map((setting, index) => (
              <View key={index} style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.iconContainer}>
                    <setting.icon size={20} color={Colors.gradient.green} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>{setting.title}</Text>
                    <Text style={styles.settingDescription}>{setting.description}</Text>
                  </View>
                </View>
                <Switch
                  value={preferences[setting.key]}
                  onValueChange={(value) => updatePreference(setting.key, value)}
                  trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                  thumbColor={Colors.white}
                  testID={`switch-${setting.key}`}
                />
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Channels</Text>
            <Text style={styles.sectionDescription}>
              Select how you want to receive notifications
            </Text>
            {channelSettings.map((setting, index) => (
              <View key={index} style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.iconContainer}>
                    <setting.icon size={20} color={Colors.gradient.green} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>{setting.title}</Text>
                    <Text style={styles.settingDescription}>{setting.description}</Text>
                  </View>
                </View>
                <Switch
                  value={preferences[setting.key]}
                  onValueChange={(value) => updatePreference(setting.key, value)}
                  trackColor={{ false: Colors.gray[300], true: Colors.gradient.green }}
                  thumbColor={Colors.white}
                  disabled={Platform.OS === 'web' && setting.key === 'pushNotifications'}
                  testID={`switch-${setting.key}`}
                />
              </View>
            ))}
          </View>

          {Platform.OS !== 'web' && !hasPermission && (
            <View style={styles.permissionBanner}>
              <Bell size={20} color={Colors.gradient.yellow} />
              <Text style={styles.permissionText}>
                Enable push notifications in your device settings to receive real-time alerts
              </Text>
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>About Notifications</Text>
            <Text style={styles.infoText}>
              • Order Updates: Track your orders from preparation to delivery{'\n'}
              • New Messages: Stay connected with customers and sellers{'\n'}
              • Payment Alerts: Get instant updates on transactions{'\n'}
              • Reviews & Ratings: Know when someone reviews your meals{'\n'}
              • Promotions: Receive exclusive deals and offers
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 16,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gradient.green + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray[900],
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.gradient.yellow + '15',
    borderRadius: 12,
    marginBottom: 24,
  },
  permissionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray[800],
    lineHeight: 20,
  },
  infoSection: {
    padding: 16,
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.gray[700],
    lineHeight: 22,
  },
});
