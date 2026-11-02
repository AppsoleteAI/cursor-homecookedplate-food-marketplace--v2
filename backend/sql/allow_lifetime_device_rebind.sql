-- Run this in the Supabase SQL editor.
-- The live function used to reject every device_id change on a lifetime profile.
-- That rejection blocked an App Store re-download, which creates a new binding token.
-- This account may replace its own device_id. Another account still cannot take the token:
-- profiles.device_id is UNIQUE.

CREATE OR REPLACE FUNCTION public.enforce_lifetime_hardware_lock()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.enforce_lifetime_hardware_lock() IS 'Lifetime membership stays on the same profile. A re-download may replace device_id. Transfer to another account is blocked by the unique device_id constraint.';
