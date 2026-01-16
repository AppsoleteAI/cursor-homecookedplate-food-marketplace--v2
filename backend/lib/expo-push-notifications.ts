/**
 * Expo Push Notification Service
 * Sends push notifications via Expo Push Notification API
 */

interface ExpoPushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoPushMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
}

interface ExpoPushResponse {
  data: {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: {
      error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
    };
  }[];
}

/**
 * Sends a push notification to a device using Expo Push Notification API
 * @param pushToken - Expo push token (e.g., ExponentPushToken[...])
 * @param notification - Notification content
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function sendExpoPushNotification(
  pushToken: string,
  notification: ExpoPushNotification
): Promise<boolean> {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
    console.warn('[Expo Push] Invalid push token format:', pushToken);
    return false;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: notification.sound || 'default',
    title: notification.title,
    body: notification.body,
    badge: notification.badge,
    data: notification.data || {},
  };

  try {
    const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };

    // Add authorization header if access token is provided
    if (expoAccessToken) {
      headers['Authorization'] = `Bearer ${expoAccessToken}`;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Expo Push] API error:', response.status, errorText);
      return false;
    }

    const result: ExpoPushResponse = await response.json();

    if (result.data && result.data.length > 0) {
      const status = result.data[0].status;
      if (status === 'ok') {
        console.log('[Expo Push] Notification sent successfully:', result.data[0].id);
        return true;
      } else {
        console.error('[Expo Push] Error sending notification:', result.data[0].message, result.data[0].details);
        return false;
      }
    }

    console.error('[Expo Push] Unexpected response format:', result);
    return false;
  } catch (error) {
    console.error('[Expo Push] Failed to send notification:', error);
    return false;
  }
}
