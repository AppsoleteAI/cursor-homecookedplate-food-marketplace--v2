import { adminProcedure } from "../../../create-context";

export const getSystemAlertsProcedure = adminProcedure.query(async ({ ctx }) => {
  // Query admin_system_alerts table - ordered by most recent first
  // Limit to 50 most recent alerts to prevent overwhelming the UI
  const { data: alerts, error } = await ctx.supabase
    .from('admin_system_alerts')
    .select('id, alert_type, severity, title, message, metadata, created_at, resolved')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch system alerts: ${error.message}`);
  }

  // Return alerts with formatted dates
  return (alerts || []).map(alert => ({
    id: alert.id,
    alertType: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    metadata: alert.metadata || {},
    createdAt: alert.created_at,
    resolved: alert.resolved || false,
  }));
});
