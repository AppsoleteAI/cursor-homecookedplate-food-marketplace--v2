-- Migration: Create admin_system_alerts table for logging critical system events
-- Use this table for logging metro cap reached, payment errors, and other system alerts

CREATE TABLE IF NOT EXISTS public.admin_system_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type text NOT NULL CHECK (alert_type IN (
    'metro_cap_reached',
    'payment_error',
    'subscription_error',
    'webhook_error',
    'system_error',
    'maintenance_mode',
    'security_alert'
  )),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_alert_type ON public.admin_system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_severity ON public.admin_system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_resolved ON public.admin_system_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_created_at ON public.admin_system_alerts(created_at DESC);

-- Enable RLS (only admins can read)
ALTER TABLE public.admin_system_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view alerts
CREATE POLICY "admins_can_view_alerts" ON public.admin_system_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Service role (supabaseAdmin) can insert alerts (for system logging)
CREATE POLICY "service_role_can_insert_alerts" ON public.admin_system_alerts
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Policy: Admins can update alerts (to mark as resolved)
CREATE POLICY "admins_can_update_alerts" ON public.admin_system_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

COMMENT ON TABLE public.admin_system_alerts IS 'Logs critical system events for admin monitoring. Used for metro cap reached notifications, payment errors, and other system alerts.';
COMMENT ON COLUMN public.admin_system_alerts.alert_type IS 'Type of alert: metro_cap_reached, payment_error, subscription_error, webhook_error, system_error, maintenance_mode, security_alert';
COMMENT ON COLUMN public.admin_system_alerts.severity IS 'Alert severity level: low, medium, high, critical';
COMMENT ON COLUMN public.admin_system_alerts.metadata IS 'Additional structured data about the alert (JSON)';
COMMENT ON COLUMN public.admin_system_alerts.resolved IS 'Whether the alert has been resolved by an admin';
