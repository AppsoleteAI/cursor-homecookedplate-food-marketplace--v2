-- Migration: Add stripe_account_id to profiles table
-- This enables Stripe Connect marketplace functionality
-- Run this SQL in your Supabase SQL Editor

-- Add the stripe_account_id column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id 
ON public.profiles(stripe_account_id);

-- Add a comment explaining the column
COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect account ID for PlateMakers (sellers). Used for marketplace payments where the platform takes a fee and transfers funds to the seller.';
