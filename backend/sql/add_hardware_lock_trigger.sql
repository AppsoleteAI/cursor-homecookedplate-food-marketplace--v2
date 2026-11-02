-- Lifetime membership stays on this profile.
-- An App Store re-download creates a new binding token. This account may replace device_id.
-- Another account cannot take that token: profiles.device_id is UNIQUE.
-- The previous function rejected every device_id change, including a re-download.
-- On a database that already has the old function, run backend/sql/allow_lifetime_device_rebind.sql.

CREATE OR REPLACE FUNCTION public.enforce_lifetime_hardware_lock()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS enforce_lifetime_hardware_lock_trigger ON public.profiles;

CREATE TRIGGER enforce_lifetime_hardware_lock_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.membership_tier = 'lifetime')
  EXECUTE FUNCTION public.enforce_lifetime_hardware_lock();

-- Add comments for documentation
COMMENT ON FUNCTION public.enforce_lifetime_hardware_lock() IS 'Lifetime membership stays on the same profile. A re-download may replace device_id. Transfer to another account is blocked by the unique device_id constraint.';
COMMENT ON TRIGGER enforce_lifetime_hardware_lock_trigger ON public.profiles IS 'Fires BEFORE UPDATE on profiles when membership_tier is lifetime. Allows this account to replace device_id after a re-download.';
