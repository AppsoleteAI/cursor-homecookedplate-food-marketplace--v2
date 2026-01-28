import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { useAuth } from '@/hooks/auth-context';

let Notifications: any = null;
const originalConsoleError = console.error;

try {
  console.error = () => {};
  Notifications = require('expo-notifications');
  console.error = originalConsoleError;
  
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (error) {
  console.error = originalConsoleError;
  Notifications = null;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  newMessages: boolean;
  paymentAlerts: boolean;
  reviewsRatings: boolean;
  promotions: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

interface NotificationsState {
  preferences: NotificationPreferences;
  isLoading: boolean;
  hasPermission: boolean;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  sendTestNotification: (type: string) => Promise<void>;
  sendOrderUpdateNotification: (orderId: string, status: string, mealName: string) => Promise<void>;
  sendNewMessageNotification: (senderName: string, message: string) => Promise<void>;
  sendPaymentNotification: (amount: number, type: 'received' | 'sent') => Promise<void>;
  sendReviewNotification: (mealName: string, rating: number) => Promise<void>;
  sendPromotionNotification: (title: string, description: string) => Promise<void>;
}

const STORAGE_KEY = '@notification_preferences';

const defaultPreferences: NotificationPreferences = {
  orderUpdates: true,
  newMessages: true,
  paymentAlerts: true,
  reviewsRatings: true,
  promotions: false,
  emailNotifications: true,
  pushNotifications: true,
};



export const [NotificationsProvider, useNotifications] = createContextHook<NotificationsState>(() => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const mountedRef = useRef<boolean>(true);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Internal Gating: Only perform expensive operations after authentication
  // This reduces TTR on login screen by deferring AsyncStorage and permission checks
  useEffect(() => {
    mountedRef.current = true;
    
    // Gate: Wait for auth to finish loading, then only proceed if authenticated
    if (authLoading) {
      return; // Wait for auth state to resolve
    }
    
    if (!isAuthenticated) {
      // Not authenticated - skip expensive operations, just set loading to false
      if (mountedRef.current) {
        setIsLoading(false);
      }
      return;
    }
    
    // Authenticated - proceed with expensive operations
    setTimeout(() => {
      loadPreferences();
      checkPermission();
    }, 0);
    
    return () => {
      mountedRef.current = false;
    };
  }, [isAuthenticated, authLoading]);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        if (mountedRef.current) {
          setPreferences(JSON.parse(stored));
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  };

  const checkPermission = async () => {
    if (Platform.OS === 'web' || !Notifications) {
      setHasPermission(false);
      return;
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (mountedRef.current) {
        setHasPermission(status === 'granted');
      }
    } catch (error) {
      console.error('Failed to check notification permission:', error);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !Notifications) {
      Alert.alert(
        'Push Notifications',
        'Push notifications are not available in Expo Go (SDK 53+) or on web. Use a development build to enable notifications.',
        [{ text: 'OK' }]
      );
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';
      if (mountedRef.current) {
        setHasPermission(granted);
      }

      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive push notifications.',
          [{ text: 'OK' }]
        );
      }

      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  const sendTestNotification = useCallback(async (type: string) => {
    if (Platform.OS === 'web' || !hasPermission || !Notifications) {
      return;
    }

    try {
      const notificationMessages: Record<string, { title: string; body: string }> = {
        orderUpdates: {
          title: 'Order Update',
          body: 'Your order has been confirmed and is being prepared!',
        },
        newMessages: {
          title: 'New Message',
          body: 'You have a new message from a customer.',
        },
        paymentAlerts: {
          title: 'Payment Received',
          body: 'You received a payment of $25.00',
        },
        reviewsRatings: {
          title: 'New Review',
          body: 'Someone left a 5-star review on your meal!',
        },
        promotions: {
          title: 'Special Offer',
          body: 'Get 20% off your next order!',
        },
        pushNotifications: {
          title: 'Notifications Enabled',
          body: 'You will now receive push notifications',
        },
      };

      const message = notificationMessages[type] || {
        title: 'Notification',
        body: 'Notifications are now enabled',
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  }, [hasPermission]);

  const updatePreference = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (key === 'pushNotifications' && value && !hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }

    const newPreferences = { ...preferences, [key]: value } as NotificationPreferences;
    await savePreferences(newPreferences);

    if (value && (key === 'pushNotifications' || preferences.pushNotifications)) {
      await sendTestNotification(key);
    }
  }, [preferences, hasPermission, requestPermission, sendTestNotification]);

  const sendOrderUpdateNotification = useCallback(async (orderId: string, status: string, mealName: string) => {
    if (!preferences.orderUpdates) {
      return;
    }

    const statusMessages: Record<string, string> = {
      accepted: `Your order for ${mealName} has been accepted!`,
      preparing: `${mealName} is being prepared`,
      ready: `Your ${mealName} is ready for pickup!`,
      completed: `Order completed. Enjoy your ${mealName}!`,
      cancelled: `Your order for ${mealName} was cancelled`,
    };

    const body = statusMessages[status] || `Order status updated: ${status}`;

    if (Platform.OS === 'web' || !hasPermission || !Notifications) {
      return;
    }

    if (preferences.pushNotifications) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Order Update',
            body,
            sound: true,
            data: { orderId, type: 'order_update' },
          },
          trigger: null,
        });
      } catch (error) {
        console.error('[Notifications] Failed to send order update:', error);
      }
    }
  }, [preferences, hasPermission]);

  const sendNewMessageNotification = useCallback(async (senderName: string, message: string) => {
    if (!preferences.newMessages) {
      return;
    }

    const body = `${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

    if (Platform.OS === 'web' || !hasPermission || !Notifications) {
      return;
    }

    if (preferences.pushNotifications) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Message',
            body,
            sound: true,
            data: { senderName, type: 'new_message' },
          },
          trigger: null,
        });
      } catch (error) {
        console.error('[Notifications] Failed to send message notification:', error);
      }
    }
  }, [preferences, hasPermission]);

  const sendPaymentNotification = useCallback(async (amount: number, type: 'received' | 'sent') => {
    if (!preferences.paymentAlerts) {
      return;
    }

    const body = type === 'received' 
      ? `You received a payment of ${amount.toFixed(2)}`
      : `Payment of ${amount.toFixed(2)} was processed`;

    if (Platform.OS === 'web' || !hasPermission || !Notifications) {
      return;
    }

    if (preferences.pushNotifications) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: type === 'received' ? 'Payment Received' : 'Payment Processed',
            body,
            sound: true,
            data: { amount, type: 'payment' },
          },
          trigger: null,
        });
      } catch (error) {
        console.error('[Notifications] Failed to send payment notification:', error);
      }
    }
  }, [preferences, hasPermission]);

  const sendReviewNotification = useCallback(async (mealName: string, rating: number) => {
    if (!preferences.reviewsRatings) {
      return;
    }

    const stars = '⭐'.repeat(rating);
    const body = `New ${stars} review on your ${mealName}!`;

    if (Platform.OS === 'web' || !hasPermission || !Notifications) {
      return;
    }

    if (preferences.pushNotifications) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Review',
            body,
            sound: true,
            data: { mealName, rating, type: 'review' },
          },
          trigger: null,
        });
      } catch (error) {
        console.error('[Notifications] Failed to send review notification:', error);
      }
    }
  }, [preferences, hasPermission]);

  const sendPromotionNotification = useCallback(async (title: string, description: string) => {
    if (!preferences.promotions) {
      return;
    }

    if (Platform.OS === 'web' || !hasPermission || !Notifications) {
      return;
    }

    if (preferences.pushNotifications) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎉 ${title}`,
            body: description,
            sound: true,
            data: { type: 'promotion' },
          },
          trigger: null,
        });
      } catch (error) {
        console.error('[Notifications] Failed to send promotion notification:', error);
      }
    }
  }, [preferences, hasPermission]);

  return useMemo(() => ({
    preferences,
    isLoading,
    hasPermission,
    updatePreference,
    requestPermission,
    sendTestNotification,
    sendOrderUpdateNotification,
    sendNewMessageNotification,
    sendPaymentNotification,
    sendReviewNotification,
    sendPromotionNotification,
  }), [preferences, isLoading, hasPermission, updatePreference, requestPermission, sendTestNotification, sendOrderUpdateNotification, sendNewMessageNotification, sendPaymentNotification, sendReviewNotification, sendPromotionNotification]);
});
