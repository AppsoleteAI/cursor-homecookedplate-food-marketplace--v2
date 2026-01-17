/**
 * Admin System Alerts Utility
 * 
 * Logs critical system events directly to the database for Admin review.
 * Uses "City Max Alert" branding for high-priority notifications.
 * No external third-party dependencies (Slack/Discord).
 */

import { supabaseAdmin } from './supabase';

type AlertType =
  | 'metro_cap_reached'
  | 'payment_error'
  | 'subscription_error'
  | 'webhook_error'
  | 'system_error'
  | 'maintenance_mode'
  | 'security_alert';

type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

interface LogAdminAlertOptions {
  severity?: AlertSeverity;
  metadata?: Record<string, any>;
  title?: string;
}

/**
 * Logs a critical system event to the admin_system_alerts table with City Max Alert branding.
 * 
 * @param type - Type of alert (must match admin_system_alerts.alert_type constraint)
 * @param message - Human-readable message (will be prefixed with "🚨 City Max Alert: ")
 * @param options - Optional severity, metadata, and title
 * @returns Promise that resolves when alert is logged (or fails gracefully)
 * 
 * @example
 * await logAdminAlert(
 *   'metro_cap_reached',
 *   'New York metro has reached capacity for platemakers (100/100)',
 *   { severity: 'high', metadata: { metro_name: 'New York', role: 'platemaker' } }
 * );
 */
export async function logAdminAlert(
  type: AlertType,
  message: string,
  options: LogAdminAlertOptions = {}
): Promise<void> {
  const {
    severity = 'high',
    metadata = {},
    title,
  } = options;

  // Prefix message with City Max Alert branding
  const brandedMessage = `🚨 City Max Alert: ${message}`;

  // Enrich metadata with timestamp and source
  const enrichedMetadata = {
    ...metadata,
    timestamp: new Date().toISOString(),
    source: 'backend-alert-utility',
  };

  // Generate title if not provided
  const alertTitle = title || `${type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;

  try {
    const { error } = await supabaseAdmin
      .from('admin_system_alerts')
      .insert({
        alert_type: type,
        message: brandedMessage,
        title: alertTitle,
        severity,
        metadata: enrichedMetadata,
      });

    if (error) {
      console.error('[Alerts] Failed to log admin alert:', error);
      // Don't throw - alerts are non-critical logging operations
    } else {
      console.log(`[Alerts] City Max Alert logged: ${type} - ${alertTitle}`);
    }
  } catch (error) {
    console.error('[Alerts] Unexpected error logging admin alert:', error);
    // Fail gracefully - don't throw exceptions for logging operations
  }
}
