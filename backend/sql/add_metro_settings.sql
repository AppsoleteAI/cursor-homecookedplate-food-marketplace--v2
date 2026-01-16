-- Migration: Add metro settings (is_active, trial_days) and expo_push_token to profiles
-- Run this SQL in your Supabase SQL Editor

-- Add metro settings columns to metro_area_counts table
ALTER TABLE public.metro_area_counts
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 90 NOT NULL CHECK (trial_days > 0);

-- Add expo_push_token column to profiles table for push notifications
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS expo_push_token text;

-- Create index for expo_push_token lookups (for push notification queries)
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token ON public.profiles(expo_push_token) 
WHERE expo_push_token IS NOT NULL;

-- Initialize existing metros with default settings (if they don't have them)
UPDATE public.metro_area_counts
SET 
  is_active = COALESCE(is_active, true),
  trial_days = COALESCE(trial_days, 90)
WHERE is_active IS NULL OR trial_days IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.metro_area_counts.is_active IS 'Controls whether the metro area is open for new signups (true) or closed (false)';
COMMENT ON COLUMN public.metro_area_counts.trial_days IS 'Trial period length in days for early bird members in this metro (default: 90)';
COMMENT ON COLUMN public.profiles.expo_push_token IS 'Expo push notification token for sending push notifications to the user';
