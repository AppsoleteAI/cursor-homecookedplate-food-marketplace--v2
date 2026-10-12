-- Play Billing membership. The service role writes this after Google
-- verifies the purchase token. A member cannot point the account at another Play purchase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_purchase_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_purchase_token
  ON public.profiles(google_purchase_token)
  WHERE google_purchase_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_google_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.google_purchase_token := OLD.google_purchase_token;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_google_subscription ON public.profiles;
CREATE TRIGGER protect_google_subscription
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_google_subscription();

COMMENT ON COLUMN public.profiles.google_purchase_token IS 'Google Play purchase token for the membership. One Play subscription can belong to one profile.';
