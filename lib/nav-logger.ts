/**
 * Navigation Logger for Android Logcat
 * 
 * This utility provides structured logging for navigation events that can be
 * easily filtered in Android logcat using:
 * 
 *   adb logcat | grep "NAV_LOGGER"
 * 
 * Or for errors only:
 *   adb logcat *:E | grep "NAV_LOGGER"
 */

import { Platform } from 'react-native';

export type NavLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface NavLogData {
  level: NavLogLevel;
  event: string;
  location: string;
  message: string;
  data?: Record<string, any>;
  timestamp?: number;
  route?: string;
  previousRoute?: string;
  error?: Error | string;
}

const LOG_TAG = '[NAV_LOGGER]';
const PACKAGE_NAME = 'com.rork.homecookedplate';

/**
 * Formats a navigation log entry for logcat
 */
function formatLogcatMessage(data: NavLogData): string {
  const timestamp = data.timestamp || Date.now();
  const timeStr = new Date(timestamp).toISOString();
  
  const parts = [
    LOG_TAG,
    `[${data.level}]`,
    `[${data.event}]`,
    `[${data.location}]`,
    data.message,
  ];

  if (data.route) {
    parts.push(`→ Route: ${data.route}`);
  }
  
  if (data.previousRoute) {
    parts.push(`← From: ${data.previousRoute}`);
  }

  if (data.error) {
    const errorMsg = data.error instanceof Error ? data.error.message : String(data.error);
    parts.push(`❌ Error: ${errorMsg}`);
  }

  if (data.data && Object.keys(data.data).length > 0) {
    parts.push(`📊 Data: ${JSON.stringify(data.data)}`);
  }

  return `${parts.join(' ')} [${timeStr}]`;
}

/**
 * Logs a navigation event to console (which appears in logcat on Android)
 */
export function logNavEvent(data: NavLogData): void {
  const message = formatLogcatMessage(data);
  
  // Use appropriate console method based on level
  switch (data.level) {
    case 'ERROR':
      console.error(message);
      if (data.error instanceof Error) {
        console.error(LOG_TAG, 'Stack trace:', data.error.stack);
      }
      break;
    case 'WARN':
      console.warn(message);
      break;
    case 'INFO':
      console.log(message);
      break;
    case 'DEBUG':
    default:
      if (__DEV__) {
        console.log(message);
      }
      break;
  }

  // Also log to standard console for non-Android platforms
  if (Platform.OS !== 'android' && __DEV__) {
    console.log(LOG_TAG, data);
  }
}

/**
 * Helper functions for common navigation events
 */
export const navLogger = {
  /**
   * Log navigation initialization
   */
  init: (location: string, data?: Record<string, any>) => {
    logNavEvent({
      level: 'INFO',
      event: 'NAV_INIT',
      location,
      message: 'Navigation system initializing',
      data,
    });
  },

  /**
   * Log route change
   */
  routeChange: (
    location: string,
    route: string,
    previousRoute?: string,
    data?: Record<string, any>
  ) => {
    logNavEvent({
      level: 'INFO',
      event: 'ROUTE_CHANGE',
      location,
      message: `Navigating to ${route}`,
      route,
      previousRoute,
      data,
    });
  },

  /**
   * Log redirect
   */
  redirect: (
    location: string,
    from: string,
    to: string,
    reason?: string,
    data?: Record<string, any>
  ) => {
    logNavEvent({
      level: 'INFO',
      event: 'REDIRECT',
      location,
      message: `Redirecting from ${from} to ${to}${reason ? ` (${reason})` : ''}`,
      route: to,
      previousRoute: from,
      data: { ...data, reason },
    });
  },

  /**
   * Log navigation error
   */
  error: (
    location: string,
    error: Error | string,
    route?: string,
    data?: Record<string, any>
  ) => {
    logNavEvent({
      level: 'ERROR',
      event: 'NAV_ERROR',
      location,
      message: 'Navigation error occurred',
      route,
      error,
      data,
    });
  },

  /**
   * Log navigation warning
   */
  warn: (
    location: string,
    message: string,
    route?: string,
    data?: Record<string, any>
  ) => {
    logNavEvent({
      level: 'WARN',
      event: 'NAV_WARN',
      location,
      message,
      route,
      data,
    });
  },

  /**
   * Log navigation state change
   */
  stateChange: (
    location: string,
    state: string,
    route?: string,
    data?: Record<string, any>
  ) => {
    logNavEvent({
      level: 'DEBUG',
      event: 'STATE_CHANGE',
      location,
      message: `Navigation state: ${state}`,
      route,
      data,
    });
  },

  /**
   * Log navigation container ready
   */
  containerReady: (location: string, platform: string, data?: Record<string, any>) => {
    logNavEvent({
      level: 'INFO',
      event: 'CONTAINER_READY',
      location,
      message: 'NavigationContainer ready',
      data: { ...data, platform },
    });
  },

  /**
   * Log auth-based navigation decision
   */
  authDecision: (
    location: string,
    isAuthenticated: boolean,
    userRole?: string,
    targetRoute?: string,
    data?: Record<string, any>
  ) => {
    logNavEvent({
      level: 'INFO',
      event: 'AUTH_DECISION',
      location,
      message: `Auth decision: ${isAuthenticated ? 'authenticated' : 'unauthenticated'}${userRole ? ` (${userRole})` : ''}`,
      route: targetRoute,
      data: { ...data, isAuthenticated, userRole },
    });
  },
};

/**
 * Get logcat filter command for this app
 */
export function getLogcatCommand(): string {
  return `adb logcat | grep "${LOG_TAG}"`;
}

/**
 * Get logcat filter command for errors only
 */
export function getLogcatErrorCommand(): string {
  return `adb logcat *:E | grep "${LOG_TAG}"`;
}

/**
 * Get logcat filter command for package-specific logs
 */
export function getLogcatPackageCommand(): string {
  return `adb logcat | grep -E "(${LOG_TAG}|${PACKAGE_NAME})"`;
}
