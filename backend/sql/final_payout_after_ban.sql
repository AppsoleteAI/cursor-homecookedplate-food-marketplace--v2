-- Final payout for a PlateMaker whose selling is removed.
-- The Worker sets final_payout_at to 30 days after removal.
-- Ran in the SQL editor on 8 November 2026. Result: Success, no rows.
-- Do not run it again.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS final_payout_at timestamptz;

COMMENT ON COLUMN public.profiles.final_payout_at IS
  'When selling stays removed, held cook payouts transfer at this time. Pending chargebacks stay held as disputed. Fees still owed are withheld from the transfer.';

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
