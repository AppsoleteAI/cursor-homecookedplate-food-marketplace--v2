-- StoreKit membership. The service role writes this after the signed
-- transaction verifies. A member cannot point the account at another Apple purchase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_apple_original_transaction
  ON public.profiles(apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_apple_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.apple_original_transaction_id := OLD.apple_original_transaction_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_apple_subscription ON public.profiles;
CREATE TRIGGER protect_apple_subscription
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_apple_subscription();

COMMENT ON COLUMN public.profiles.apple_original_transaction_id IS 'Apple original transaction id for the membership signed by StoreKit. One Apple subscription can belong to one profile.';
