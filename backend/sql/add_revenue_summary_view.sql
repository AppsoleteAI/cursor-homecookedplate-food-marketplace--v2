-- Migration: Create revenue_summary view for financial dashboarding
-- This view is the source of truth for all financial reporting
-- Metro performance is tied to seller_id's metro_area in the profiles table

CREATE OR REPLACE VIEW public.revenue_summary AS
SELECT
  -- Transaction identifiers
  t.id AS transaction_id,
  t.payment_intent_id,
  t.order_id,
  
  -- Order relations (Financial Source of Truth)
  t.buyer_id,                    -- Platetaker
  t.seller_id,                   -- Platemaker
  p_seller.metro_area,          -- Metro area from seller's profile (source of truth for metro performance)
  
  -- Financial breakdown (20% take rate: 10% on top + 10% deducted)
  t.base_price,                  -- Order total_price (base before fees)
  t.buyer_payment,              -- Base + 10% (what Platetaker paid)
  t.seller_payout,              -- Base - 10% (what Platemaker receives)
  t.app_revenue,                -- 20% of base (10% buyer fee + 10% seller fee)
  t.buyer_fee,                  -- 10% of base (charged to buyer)
  t.seller_fee,                 -- 10% of base (deducted from seller)
  t.total_fee,                  -- Total fees (buyer_fee + seller_fee = 20% of base)
  
  -- Stripe identifiers
  t.stripe_charge_id,
  t.stripe_transfer_id,
  t.stripe_application_fee_id,
  
  -- Transaction metadata
  t.currency,
  t.quantity,
  t.status AS transaction_status,
  t.created_at AS transaction_date,
  
  -- Order details
  o.status AS order_status,
  o.total_price AS order_total_price,
  o.created_at AS order_date,
  
  -- Seller profile details
  p_seller.username AS seller_username,
  p_seller.business_name AS seller_business_name,
  p_seller.role AS seller_role,
  
  -- Buyer profile details
  p_buyer.username AS buyer_username,
  p_buyer.role AS buyer_role

FROM public.transactions t
-- Join orders for order details
INNER JOIN public.orders o ON t.order_id = o.id
-- Join seller profile to get metro_area (source of truth for metro performance reporting)
INNER JOIN public.profiles p_seller ON t.seller_id = p_seller.id
-- Join buyer profile for buyer details
INNER JOIN public.profiles p_buyer ON t.buyer_id = p_buyer.id
WHERE t.status = 'completed'; -- Only include completed transactions

-- Grant access to authenticated users (they can only see their own data via RLS)
GRANT SELECT ON public.revenue_summary TO authenticated;

-- Enable RLS on the view (inherits from underlying tables)
ALTER VIEW public.revenue_summary SET (security_invoker = true);

COMMENT ON VIEW public.revenue_summary IS 'Source of truth for all financial dashboarding. Aggregates transaction data with order and profile details. Metro performance is tied to seller metro_area.';
COMMENT ON COLUMN public.revenue_summary.metro_area IS 'Metro area from seller profile - used for metro performance reporting';
COMMENT ON COLUMN public.revenue_summary.buyer_id IS 'Platetaker (buyer) user ID';
COMMENT ON COLUMN public.revenue_summary.seller_id IS 'Platemaker (seller) user ID';
COMMENT ON COLUMN public.revenue_summary.base_price IS 'Order total_price - base amount before fees';
COMMENT ON COLUMN public.revenue_summary.buyer_payment IS 'Base + 10% (what Platetaker paid)';
COMMENT ON COLUMN public.revenue_summary.seller_payout IS 'Base - 10% (what Platemaker receives)';
COMMENT ON COLUMN public.revenue_summary.app_revenue IS '20% of base (10% buyer fee + 10% seller fee)';
