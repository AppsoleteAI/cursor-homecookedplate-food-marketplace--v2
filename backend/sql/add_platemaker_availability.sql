-- ============================================================================
-- Add Platemaker Availability and Order Management Fields
-- ============================================================================
-- This migration adds:
-- 1. available_for_orders toggle to profiles table (for platemakers)
-- 2. available_updated_at timestamp to track when availability changed
-- 3. estimated_completion_time to orders table (optional ETA from platemaker)
-- ============================================================================

-- Add availability toggle to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS available_for_orders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS available_updated_at timestamptz DEFAULT now();

-- Add estimated completion time to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS estimated_completion_time timestamptz;

-- Create index for faster availability queries (only for platemakers)
CREATE INDEX IF NOT EXISTS idx_profiles_available_for_orders 
ON public.profiles(available_for_orders) 
WHERE role = 'platemaker';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.available_for_orders IS 'Toggle for platemakers to indicate if they are accepting new orders';
COMMENT ON COLUMN public.profiles.available_updated_at IS 'Timestamp when availability status was last changed';
COMMENT ON COLUMN public.orders.estimated_completion_time IS 'Optional ETA provided by platemaker when accepting an order';
