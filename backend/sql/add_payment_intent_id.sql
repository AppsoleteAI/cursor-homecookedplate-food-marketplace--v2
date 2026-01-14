-- Add payment_intent_id column to orders table
-- This is required to link orders to Stripe payment intents for webhook verification

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_intent_id text;

-- Create an index for fast lookups during webhook processing
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id 
ON public.orders(payment_intent_id) 
WHERE payment_intent_id IS NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.orders.payment_intent_id IS 
'Stripe payment intent ID used to verify payment completion via webhooks';
