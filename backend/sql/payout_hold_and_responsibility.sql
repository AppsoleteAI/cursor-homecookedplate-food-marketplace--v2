-- Marketplace payout hold and platemaker responsibility.
-- Matches the live transactions table, which stores cent amounts and
-- does not yet have a status column.
-- Selling removal counts are a rolling 30-day window in the app, not in this SQL.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS buyer_id uuid,
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS meal_id uuid,
  ADD COLUMN IF NOT EXISTS base_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS buyer_payment numeric(10,2),
  ADD COLUMN IF NOT EXISTS seller_payout numeric(10,2),
  ADD COLUMN IF NOT EXISTS app_revenue numeric(10,2),
  ADD COLUMN IF NOT EXISTS buyer_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS seller_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS total_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS stripe_application_fee_id text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payout_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.transactions ALTER COLUMN base_amount_cents SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN taker_fee_cents SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN maker_fee_cents SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN total_captured_cents SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN platform_revenue_cents SET DEFAULT 0;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_intent_id_key;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'held', 'settled', 'disputed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment_intent_order
  ON public.transactions(payment_intent_id, order_id);

CREATE INDEX IF NOT EXISTS idx_transactions_held_release
  ON public.transactions(payout_release_at)
  WHERE status = 'held';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selling_removed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selling_removed_reason text;

CREATE OR REPLACE FUNCTION public.protect_selling_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.selling_removed := OLD.selling_removed;
    NEW.selling_removed_reason := OLD.selling_removed_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_selling_removed ON public.profiles;
CREATE TRIGGER protect_selling_removed
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_selling_removed();

CREATE TABLE IF NOT EXISTS public.platemaker_responsibility_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platemaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('refund', 'chargeback', 'complaint', 'government_request')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  stripe_dispute_id text,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_responsibility_dispute
  ON public.platemaker_responsibility_events(stripe_dispute_id)
  WHERE stripe_dispute_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_responsibility_platemaker_created
  ON public.platemaker_responsibility_events(platemaker_id, created_at DESC);

ALTER TABLE public.platemaker_responsibility_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cook_reads_own_responsibility" ON public.platemaker_responsibility_events;
CREATE POLICY "cook_reads_own_responsibility"
  ON public.platemaker_responsibility_events
  FOR SELECT
  USING (platemaker_id = auth.uid() OR public.is_admin() = true);

CREATE TABLE IF NOT EXISTS public.platemaker_admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platemaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('platemaker', 'admin')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_messages_platemaker
  ON public.platemaker_admin_messages(platemaker_id, created_at);

ALTER TABLE public.platemaker_admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cook_reads_own_admin_messages" ON public.platemaker_admin_messages;
CREATE POLICY "cook_reads_own_admin_messages"
  ON public.platemaker_admin_messages
  FOR SELECT
  USING (platemaker_id = auth.uid() OR public.is_admin() = true);

COMMENT ON COLUMN public.transactions.payout_release_at IS 'Stripe transfer to the cook is created at this time, 7 days after payment, if the sale is still held.';
COMMENT ON COLUMN public.profiles.selling_removed IS 'Set by the service role when refund, chargeback, complaint, or government-request thresholds are hit.';
