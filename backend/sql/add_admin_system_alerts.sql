-- Migration: admin_system_alerts for critical system events
-- Safe to re-run. An older empty table used event_type; the app writes alert_type.
-- CREATE TABLE IF NOT EXISTS does not add columns to a table that already exists.

CREATE TABLE IF NOT EXISTS public.admin_system_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Older shape: event_type. Rename it before adding alert_type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_system_alerts'
      AND column_name = 'event_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_system_alerts'
      AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE public.admin_system_alerts RENAME COLUMN event_type TO alert_type;
  END IF;
END $$;

ALTER TABLE public.admin_system_alerts
  ADD COLUMN IF NOT EXISTS alert_type text,
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.admin_system_alerts
SET
  alert_type = COALESCE(alert_type, 'system_error'),
  severity = COALESCE(severity, 'medium'),
  title = COALESCE(title, 'System alert'),
  message = COALESCE(message, '');

ALTER TABLE public.admin_system_alerts ALTER COLUMN alert_type SET NOT NULL;
ALTER TABLE public.admin_system_alerts ALTER COLUMN severity SET NOT NULL;
ALTER TABLE public.admin_system_alerts ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.admin_system_alerts ALTER COLUMN message SET NOT NULL;

-- Replace any older checks so the app's alert_type and severity values are allowed.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'admin_system_alerts'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_system_alerts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.admin_system_alerts
  ADD CONSTRAINT admin_system_alerts_alert_type_check
  CHECK (alert_type IN (
    'metro_cap_reached',
    'payment_error',
    'subscription_error',
    'webhook_error',
    'system_error',
    'maintenance_mode',
    'security_alert'
  ));

ALTER TABLE public.admin_system_alerts
  ADD CONSTRAINT admin_system_alerts_severity_check
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_alert_type ON public.admin_system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_severity ON public.admin_system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_resolved ON public.admin_system_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_admin_system_alerts_created_at ON public.admin_system_alerts(created_at DESC);

ALTER TABLE public.admin_system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_can_view_alerts" ON public.admin_system_alerts;
CREATE POLICY "admins_can_view_alerts" ON public.admin_system_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "service_role_can_insert_alerts" ON public.admin_system_alerts;
CREATE POLICY "service_role_can_insert_alerts" ON public.admin_system_alerts
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_can_update_alerts" ON public.admin_system_alerts;
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
