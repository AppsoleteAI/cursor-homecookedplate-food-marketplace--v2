-- One public identifier per account, and one Stripe identity per account.
-- A deleted account keeps its identifier reserved. The next account gets a new one.
-- Run this once in the Supabase SQL editor. Running it again is safe.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_code text,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_bank_payout_status text,
  ADD COLUMN IF NOT EXISTS stripe_bank_payout_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_account_code
  ON public.profiles(account_code)
  WHERE account_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_account_unique
  ON public.profiles(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_unique
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.account_identifiers (
  code text PRIMARY KEY,
  profile_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('platemaker', 'platetaker')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_identity_claims (
  stripe_id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('connect_account', 'customer')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_identity_profile_kind
  ON public.stripe_identity_claims(profile_id, kind)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.account_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_identity_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_account_identifier" ON public.account_identifiers;
CREATE POLICY "read_own_account_identifier"
  ON public.account_identifiers
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_reserved_identifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'An account identifier cannot be deleted';
  END IF;
  IF OLD.code IS DISTINCT FROM NEW.code OR OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'An account identifier cannot be changed';
  END IF;
  IF OLD.profile_id IS NULL AND NEW.profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'This identifier is already reserved';
  END IF;
  IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS NOT NULL AND OLD.profile_id IS DISTINCT FROM NEW.profile_id THEN
    RAISE EXCEPTION 'This identifier belongs to another account';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_reserved_identifier ON public.account_identifiers;
CREATE TRIGGER protect_reserved_identifier
  BEFORE UPDATE OR DELETE ON public.account_identifiers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_reserved_identifier();

CREATE OR REPLACE FUNCTION public.protect_stripe_identity_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A Stripe identity cannot be reused';
  END IF;
  IF OLD.stripe_id IS DISTINCT FROM NEW.stripe_id OR OLD.kind IS DISTINCT FROM NEW.kind THEN
    RAISE EXCEPTION 'A Stripe identity cannot be changed';
  END IF;
  IF OLD.profile_id IS NULL AND NEW.profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'This Stripe identity is already reserved';
  END IF;
  IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS NOT NULL AND OLD.profile_id IS DISTINCT FROM NEW.profile_id THEN
    RAISE EXCEPTION 'This Stripe identity belongs to another account';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_stripe_identity_claim ON public.stripe_identity_claims;
CREATE TRIGGER protect_stripe_identity_claim
  BEFORE UPDATE OR DELETE ON public.stripe_identity_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_stripe_identity_claim();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payout_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_last_error text,
  ADD COLUMN IF NOT EXISTS dispute_fee_withheld_cents integer,
  ADD COLUMN IF NOT EXISTS dispute_fee_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_transfer_cents integer;

COMMENT ON COLUMN public.profiles.account_code IS 'Public PlateMaker or PlateTaker identifier. One code, one account. A new account gets a new code.';
COMMENT ON COLUMN public.profiles.stripe_payouts_enabled IS 'True only after Stripe reports payouts_enabled. An account id alone does not allow selling.';
COMMENT ON COLUMN public.transactions.payout_release_at IS 'Transfer is created at this time. It is set when the order is cleared, or 7 days after the cook confirms handoff if the buyer never confirms, or 7 days after a shop charge that is still open. The transfer is 7 calendar days after that moment.';
COMMENT ON COLUMN public.transactions.stripe_transfer_cents IS 'Cents actually sent on the Transfer, after any dispute-fee withhold.';

CREATE OR REPLACE FUNCTION public.protect_membership_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked text[] := ARRAY[
    'membership_tier',
    'stripe_subscription_id',
    'stripe_customer_id',
    'stripe_account_id',
    'stripe_payouts_enabled',
    'stripe_bank_payout_status',
    'stripe_bank_payout_at',
    'account_code',
    'trial_ends_at',
    'trial_started_at',
    'apple_original_transaction_id',
    'apple_expires_at',
    'apple_revoked_at',
    'apple_auto_renew',
    'apple_checked_at',
    'google_purchase_token',
    'google_expires_at',
    'google_checked_at',
    'is_admin',
    'role',
    'selling_removed',
    'final_payout_at',
    'ordering_removed',
    'dispute_fee_owed_cents',
    'kitchen_permit',
    'metro_area',
    'two_factor_enabled',
    'is_paused'
  ];
  column_name text;
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' AND auth.role() IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;
  FOREACH column_name IN ARRAY locked LOOP
    IF old_row ? column_name AND new_row ? column_name AND (old_row -> column_name) IS DISTINCT FROM (new_row -> column_name) THEN
      RAISE EXCEPTION 'This account cannot change membership or payment columns';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
