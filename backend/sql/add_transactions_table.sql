-- Migration: Create transactions table for financial records
-- This table records all successful Stripe payments with full fee breakdowns
-- Required for 20% take rate (double-sided 10% fee) financial architecture

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_intent_id text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  meal_id uuid REFERENCES public.meals(id) ON DELETE SET NULL,
  
  -- Financial breakdown (20% take rate model)
  base_price numeric(10,2) NOT NULL CHECK (base_price >= 0),
  buyer_payment numeric(10,2) NOT NULL CHECK (buyer_payment >= 0),
  seller_payout numeric(10,2) NOT NULL CHECK (seller_payout >= 0),
  app_revenue numeric(10,2) NOT NULL CHECK (app_revenue >= 0),
  
  -- Fee breakdown (double-sided 10% fee)
  buyer_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (buyer_fee >= 0),
  seller_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (seller_fee >= 0),
  total_fee numeric(10,2) NOT NULL CHECK (total_fee >= 0),
  
  -- Stripe details
  stripe_charge_id text,
  stripe_transfer_id text,
  stripe_application_fee_id text,
  currency text NOT NULL DEFAULT 'usd',
  
  -- Status and metadata
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'completed',
  quantity integer NOT NULL CHECK (quantity > 0),
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent_id ON public.transactions(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions (as buyer or seller)
CREATE POLICY "users_can_view_own_transactions" ON public.transactions
  FOR SELECT
  USING (
    buyer_id = auth.uid() OR seller_id = auth.uid()
  );

-- Policy: Service role can insert transactions (for webhook processing)
CREATE POLICY "service_role_can_insert_transactions" ON public.transactions
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Policy: Service role can update transactions (for status updates)
CREATE POLICY "service_role_can_update_transactions" ON public.transactions
  FOR UPDATE
  USING (true); -- Service role bypasses RLS

COMMENT ON TABLE public.transactions IS 'Financial records for all successful Stripe payments. Tracks 20% take rate (double-sided 10% fee) with full fee breakdowns.';
COMMENT ON COLUMN public.transactions.base_price IS 'Base meal price before fees';
COMMENT ON COLUMN public.transactions.buyer_payment IS 'Total amount buyer paid (base_price + buyer_fee)';
COMMENT ON COLUMN public.transactions.seller_payout IS 'Amount seller receives (base_price - seller_fee)';
COMMENT ON COLUMN public.transactions.app_revenue IS 'Total app revenue (buyer_fee + seller_fee = 20% of base_price)';
COMMENT ON COLUMN public.transactions.buyer_fee IS '10% fee charged to buyer';
COMMENT ON COLUMN public.transactions.seller_fee IS '10% fee deducted from seller';
COMMENT ON COLUMN public.transactions.total_fee IS 'Total fees collected (buyer_fee + seller_fee = 20% of base_price)';
