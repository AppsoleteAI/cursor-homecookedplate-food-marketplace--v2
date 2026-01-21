-- Migration: Add city-level settings to metro_geofences table
-- Run this SQL in your Supabase SQL Editor
-- Adds is_active and trial_days columns for dynamic city-level configuration

-- Add is_active column (default true for existing metros)
ALTER TABLE public.metro_geofences
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- Add trial_days column (default 90 for existing metros, matches current behavior)
ALTER TABLE public.metro_geofences
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 90 NOT NULL CHECK (trial_days >= 0);

-- Update existing rows to have defaults if they were created before this migration
UPDATE public.metro_geofences
SET 
  is_active = COALESCE(is_active, true),
  trial_days = COALESCE(trial_days, 90)
WHERE is_active IS NULL OR trial_days IS NULL;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_metro_geofences_is_active ON public.metro_geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_metro_geofences_trial_days ON public.metro_geofences(trial_days);

-- Add comments for documentation
COMMENT ON COLUMN public.metro_geofences.is_active IS 'Whether this metro area is currently active for signups. Inactive metros will block signups entirely.';
COMMENT ON COLUMN public.metro_geofences.trial_days IS 'Number of days for early bird trial period. Overrides hardcoded values. Default is 90 days.';

-- Function: Automatically create metro_area_counts entry when a new metro_geofences entry is added
-- This trigger handles metadata creation for new cities automatically
CREATE OR REPLACE FUNCTION public.seed_metro_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically create corresponding metro_area_counts entry for new metro
  INSERT INTO public.metro_area_counts (metro_name, platemaker_count, platetaker_count, max_cap)
  VALUES (NEW.metro_name, 0, 0, 100)
  ON CONFLICT (metro_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to seed metro counts when a new metro_geofences entry is created
DROP TRIGGER IF EXISTS seed_metro_counts_trigger ON public.metro_geofences;

CREATE TRIGGER seed_metro_counts_trigger
  AFTER INSERT ON public.metro_geofences
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_metro_counts();

-- Add comment for documentation
COMMENT ON FUNCTION public.seed_metro_counts IS 'Trigger function that automatically creates metro_area_counts entry when a new metro_geofences entry is added. Handles metadata creation for new cities automatically.';
