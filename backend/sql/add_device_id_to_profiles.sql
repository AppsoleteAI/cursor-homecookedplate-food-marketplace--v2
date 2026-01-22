-- Migration: Add device_id column to profiles table for Lifetime Promo tracking
-- Run this SQL in your Supabase SQL Editor

-- Add device_id column with unique constraint to prevent transfers
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS device_id text UNIQUE;

-- Create index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);

-- Update membership_tier check constraint to include 'lifetime'
-- First, drop the existing constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_membership_tier_check;

-- Recreate with 'lifetime' option
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_membership_tier_check 
CHECK (membership_tier IN ('free', 'premium', 'lifetime'));

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.device_id IS 'Unique device identifier for Lifetime Promo memberships. Prevents transfer of lifetime memberships between devices/users.';
COMMENT ON COLUMN public.profiles.membership_tier IS 'User membership tier: free, premium, or lifetime';
