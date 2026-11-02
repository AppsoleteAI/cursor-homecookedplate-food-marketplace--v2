-- App Store and Play membership dates, and the home-kitchen permit for cooked plates.
-- The service role writes the store columns after Apple or Google verifies the purchase.
-- A member cannot change those columns or the permit from the client.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apple_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS apple_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS apple_auto_renew boolean,
  ADD COLUMN IF NOT EXISTS apple_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS kitchen_permit jsonb;

CREATE OR REPLACE FUNCTION public.protect_apple_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.apple_original_transaction_id := OLD.apple_original_transaction_id;
    NEW.apple_expires_at := OLD.apple_expires_at;
    NEW.apple_revoked_at := OLD.apple_revoked_at;
    NEW.apple_auto_renew := OLD.apple_auto_renew;
    NEW.apple_checked_at := OLD.apple_checked_at;
    NEW.google_expires_at := OLD.google_expires_at;
    NEW.google_checked_at := OLD.google_checked_at;
    NEW.kitchen_permit := OLD.kitchen_permit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_apple_subscription ON public.profiles;
CREATE TRIGGER protect_apple_subscription
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_apple_subscription();

COMMENT ON COLUMN public.profiles.apple_expires_at IS 'When the App Store membership period ends. Premium ends at this time unless another paid plan still covers the account.';
COMMENT ON COLUMN public.profiles.apple_revoked_at IS 'When Apple refunded or revoked the membership. Premium from this subscription is off.';
COMMENT ON COLUMN public.profiles.apple_auto_renew IS 'True while Apple will bill another period. Account deletion waits until this is false.';
COMMENT ON COLUMN public.profiles.kitchen_permit IS 'Issued home-kitchen permit for cooked plates. The public menu hides plates until this record passes the permit check.';
