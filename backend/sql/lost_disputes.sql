-- Lost card disputes. The cook pays the $15 fee. A PlateTaker is banned at
-- 4 lost disputes in a rolling 12 months, or on the 3rd when 2 fall within 60 days.
-- Service role writes these columns. The account cannot clear them.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ordering_removed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordering_removed_reason text,
  ADD COLUMN IF NOT EXISTS dispute_fee_owed_cents integer NOT NULL DEFAULT 0;

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
    NEW.ordering_removed := OLD.ordering_removed;
    NEW.ordering_removed_reason := OLD.ordering_removed_reason;
    NEW.dispute_fee_owed_cents := OLD.dispute_fee_owed_cents;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.platetaker_lost_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platetaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platemaker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  stripe_dispute_id text NOT NULL,
  fee_cents integer NOT NULL DEFAULT 1500,
  fee_collected text NOT NULL DEFAULT 'owed' CHECK (fee_collected IN ('stripe', 'owed')),
  fee_half_refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lost_disputes_stripe
  ON public.platetaker_lost_disputes(stripe_dispute_id);

CREATE INDEX IF NOT EXISTS idx_lost_disputes_platetaker_created
  ON public.platetaker_lost_disputes(platetaker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lost_disputes_platemaker
  ON public.platetaker_lost_disputes(platemaker_id, created_at DESC);

ALTER TABLE public.platetaker_lost_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties_read_own_lost_disputes" ON public.platetaker_lost_disputes;
CREATE POLICY "parties_read_own_lost_disputes"
  ON public.platetaker_lost_disputes
  FOR SELECT
  USING (
    platetaker_id = auth.uid()
    OR platemaker_id = auth.uid()
    OR public.is_admin() = true
  );

CREATE TABLE IF NOT EXISTS public.cook_buyer_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platemaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platetaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platemaker_id, platetaker_id)
);

ALTER TABLE public.cook_buyer_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cook_reads_own_blocks" ON public.cook_buyer_blocks;
CREATE POLICY "cook_reads_own_blocks"
  ON public.cook_buyer_blocks
  FOR SELECT
  USING (platemaker_id = auth.uid() OR platetaker_id = auth.uid() OR public.is_admin() = true);

COMMENT ON COLUMN public.profiles.dispute_fee_owed_cents IS 'Uncollected $15 lost-dispute fees, in cents, withheld from the cook''s next payout.';
COMMENT ON COLUMN public.profiles.ordering_removed IS 'Permanent PlateTaker ban after lost card disputes. Set by the service role.';
