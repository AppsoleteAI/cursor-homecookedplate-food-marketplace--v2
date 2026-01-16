-- Migration: Add max_cap column to metro_area_counts table
-- Run this SQL in your Supabase SQL Editor
-- Adds per-metro cap override capability (default 100)

-- Add max_cap column with default value of 100
ALTER TABLE public.metro_area_counts
ADD COLUMN IF NOT EXISTS max_cap integer DEFAULT 100 NOT NULL CHECK (max_cap >= 0);

-- Update existing rows to have max_cap = 100 if they don't have it set
UPDATE public.metro_area_counts
SET max_cap = 100
WHERE max_cap IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.metro_area_counts.max_cap IS 'Maximum allowed users per role per metro (default 100). Admins can override this per metro.';

-- Function: Notify when metro cap is reached (for webhook triggering)
-- This function will be called by a trigger when counts hit max_cap
CREATE OR REPLACE FUNCTION public.notify_metro_cap_reached()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  webhook_url text;
  payload jsonb;
  metro_role text;
BEGIN
  -- Check if maker_count reached max_cap
  IF NEW.maker_count = NEW.max_cap AND OLD.maker_count < NEW.max_cap THEN
    metro_role := 'platemaker';
    
    -- Create notification for admin users
    INSERT INTO public.notifications (user_id, title, body, type, created_at)
    SELECT 
      p.id,
      'Metro Cap Reached',
      format('Metro "%s" has reached the maximum capacity (%s/%s) for %s.', 
        NEW.metro_name, NEW.maker_count, NEW.max_cap, metro_role),
      'metro_cap_reached',
      now()
    FROM public.profiles p
    WHERE p.is_admin = true;
    
    -- Log for monitoring
    RAISE NOTICE '[METRO_CAP] Metro "%s" reached max_cap (%s/%s) for %s', 
      NEW.metro_name, NEW.maker_count, NEW.max_cap, metro_role;
  END IF;

  -- Check if taker_count reached max_cap
  IF NEW.taker_count = NEW.max_cap AND OLD.taker_count < NEW.max_cap THEN
    metro_role := 'platetaker';
    
    -- Create notification for admin users
    INSERT INTO public.notifications (user_id, title, body, type, created_at)
    SELECT 
      p.id,
      'Metro Cap Reached',
      format('Metro "%s" has reached the maximum capacity (%s/%s) for %s.', 
        NEW.metro_name, NEW.taker_count, NEW.max_cap, metro_role),
      'metro_cap_reached',
      now()
    FROM public.profiles p
    WHERE p.is_admin = true;
    
    -- Log for monitoring
    RAISE NOTICE '[METRO_CAP] Metro "%s" reached max_cap (%s/%s) for %s', 
      NEW.metro_name, NEW.taker_count, NEW.max_cap, metro_role;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to fire on UPDATE of metro_area_counts
DROP TRIGGER IF EXISTS metro_cap_reached_trigger ON public.metro_area_counts;

CREATE TRIGGER metro_cap_reached_trigger
  AFTER UPDATE ON public.metro_area_counts
  FOR EACH ROW
  WHEN (
    (NEW.maker_count = NEW.max_cap AND OLD.maker_count < NEW.max_cap) OR
    (NEW.taker_count = NEW.max_cap AND OLD.taker_count < NEW.max_cap)
  )
  EXECUTE FUNCTION public.notify_metro_cap_reached();

-- Add comment for documentation
COMMENT ON FUNCTION public.notify_metro_cap_reached IS 'Trigger function that creates admin notifications when metro area count reaches max_cap. Triggers when maker_count or taker_count hits max_cap exactly.';
