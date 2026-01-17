/**
 * Admin System Alerts Utility
 * 
 * Standard utility for logging critical system events to admin_system_alerts table.
 * This is the source of truth for all system notifications and "City Max Alerts".
 * 
 * @param alertType - Type of alert (metro_cap_reached, payment_error, etc.)
 * @param message - Alert message
 * @param metadata - Optional additional structured data
 * @param severity - Alert severity (default: 'medium')
 */

import { supabaseAdmin } from './supabase';

export type AlertType = 
  | 'metro_cap_reached'
  | 'payment_error'
  | 'subscription_error'
  | 'webhook_error'
  | 'system_error'
  | 'maintenance_mode'
  | 'security_alert';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

interface LogAdminAlertOptions {
  metadata?: Record<string, any>;
  severity?: AlertSeverity;
  title?: string;
}

/**
 * Log an admin alert to the admin_system_alerts table
 * 
 * @param alertType - Type of alert
 * @param message - Alert message
 * @param options - Optional parameters (metadata, severity, title)
 * @returns Promise<boolean> - true if logged successfully, false otherwise
 */
export async function logAdminAlert(
  alertType: AlertType,
  message: string,
  options?: LogAdminAlertOptions
): Promise<boolean> {
  try {
    // Generate default title if not provided
    const title = options?.title || getDefaultTitle(alertType, message);
    const severity = options?.severity || 'medium';
    const metadata = options?.metadata || {};

    const { error } = await supabaseAdmin
      .from('admin_system_alerts')
      .insert({
        alert_type: alertType,
        severity,
        title,
        message,
        metadata,
      });

    if (error) {
      console.error('[Admin Alerts] Failed to log alert:', error);
      return false;
    }

    console.log(`[Admin Alerts] Logged ${alertType} alert: ${title}`);
    return true;
  } catch (error) {
    console.error('[Admin Alerts] Error logging alert:', error);
    return false;
  }
}

/**
 * Generate default title based on alert type
 */
function getDefaultTitle(alertType: AlertType, message: string): string {
  const titles: Record<AlertType, string> = {
    metro_cap_reached: 'Metro Cap Reached',
    payment_error: 'Payment Error',
    subscription_error: 'Subscription Error',
    webhook_error: 'Webhook Error',
    system_error: 'System Error',
    maintenance_mode: 'Maintenance Mode',
    security_alert: 'Security Alert',
  };

  return titles[alertType] || 'System Alert';
}
