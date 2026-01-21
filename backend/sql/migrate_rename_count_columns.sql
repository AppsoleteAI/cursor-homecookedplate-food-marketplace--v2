-- Migration: Rename maker_count/taker_count to platemaker_count/platetaker_count
-- This is an ATOMIC migration that must run in a single transaction
-- Run this SQL in your Supabase SQL Editor
-- CRITICAL: All changes happen atomically - no partial state possible

BEGIN;

-- ============================================================================
-- STEP 1: Drop all triggers that depend on these columns
-- ============================================================================
-- Drop triggers first (no dependencies on functions at this point)
DROP TRIGGER IF EXISTS metro_cap_reached_trigger ON public.metro_area_counts;
DROP TRIGGER IF EXISTS seed_metro_counts_trigger ON public.metro_geofences;

-- ============================================================================
-- STEP 2: Rename columns in both tables (ATOMIC)
-- ============================================================================
-- Rename columns in metro_area_counts table
ALTER TABLE public.metro_area_counts
  RENAME COLUMN maker_count TO platemaker_count;

ALTER TABLE public.metro_area_counts
  RENAME COLUMN taker_count TO platetaker_count;

-- Rename columns in metro_promo_tracking table (for consistency)
ALTER TABLE public.metro_promo_tracking
  RENAME COLUMN maker_count TO platemaker_count;

ALTER TABLE public.metro_promo_tracking
  RENAME COLUMN taker_count TO platetaker_count;

-- ============================================================================
-- STEP 3: Recreate all functions with updated column references
-- ============================================================================

-- Function: Atomically increment metro area count for a specific role
-- Updated to use platemaker_count/platetaker_count
CREATE OR REPLACE FUNCTION public.increment_metro_count(
  metro_name_param text,
  user_role text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
  current_platemaker_count integer;
  current_platetaker_count integer;
  metro_max_cap integer;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT platemaker_count, platetaker_count, max_cap
  INTO current_platemaker_count, current_platetaker_count, metro_max_cap
  FROM public.metro_area_counts
  WHERE metro_name = metro_name_param
  FOR UPDATE;

  -- If row doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO public.metro_area_counts (metro_name, platemaker_count, platetaker_count)
    VALUES (metro_name_param, 0, 0)
    ON CONFLICT (metro_name) DO NOTHING;
    
    -- Read the inserted row (including max_cap default)
    SELECT platemaker_count, platetaker_count, max_cap
    INTO current_platemaker_count, current_platetaker_count, metro_max_cap
    FROM public.metro_area_counts
    WHERE metro_name = metro_name_param;
    
    current_platemaker_count := 0;
    current_platetaker_count := 0;
  END IF;

  -- Use default max_cap if NULL (shouldn't happen, but safety check)
  IF metro_max_cap IS NULL THEN
    metro_max_cap := 100;
  END IF;

  -- Increment the appropriate count based on role
  IF user_role = 'platemaker' THEN
    UPDATE public.metro_area_counts
    SET 
      platemaker_count = platemaker_count + 1,
      updated_at = now()
    WHERE metro_name = metro_name_param
    RETURNING platemaker_count INTO new_count;
  ELSIF user_role = 'platetaker' THEN
    UPDATE public.metro_area_counts
    SET 
      platetaker_count = platetaker_count + 1,
      updated_at = now()
    WHERE metro_name = metro_name_param
    RETURNING platetaker_count INTO new_count;
  ELSE
    RAISE EXCEPTION 'Invalid role: %. Must be platemaker or platetaker', user_role;
  END IF;

  -- Return status string based on whether cap was reached
  IF new_count <= metro_max_cap THEN
    RETURN 'SUCCESS';
  ELSE
    RETURN 'CAP_REACHED';
  END IF;
END;
$$;

-- Function: Notify when metro cap is reached (for admin notifications)
-- Updated to use platemaker_count/platetaker_count
CREATE OR REPLACE FUNCTION public.notify_metro_cap_reached()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  metro_role text;
BEGIN
  -- Check if platemaker_count reached max_cap
  IF NEW.platemaker_count = NEW.max_cap AND OLD.platemaker_count < NEW.max_cap THEN
    metro_role := 'platemaker';
    
    -- Create notification for admin users
    INSERT INTO public.notifications (user_id, title, body, type, created_at)
    SELECT 
      p.id,
      'Metro Cap Reached',
      format('Metro "%s" has reached the maximum capacity (%s/%s) for %s.', 
        NEW.metro_name, NEW.platemaker_count, NEW.max_cap, metro_role),
      'metro_cap_reached',
      now()
    FROM public.profiles p
    WHERE p.is_admin = true;
    
    -- Log for monitoring
    RAISE NOTICE '[METRO_CAP] Metro "%s" reached max_cap (%s/%s) for %s', 
      NEW.metro_name, NEW.platemaker_count, NEW.max_cap, metro_role;
  END IF;

  -- Check if platetaker_count reached max_cap
  IF NEW.platetaker_count = NEW.max_cap AND OLD.platetaker_count < NEW.max_cap THEN
    metro_role := 'platetaker';
    
    -- Create notification for admin users
    INSERT INTO public.notifications (user_id, title, body, type, created_at)
    SELECT 
      p.id,
      'Metro Cap Reached',
      format('Metro "%s" has reached the maximum capacity (%s/%s) for %s.', 
        NEW.metro_name, NEW.platetaker_count, NEW.max_cap, metro_role),
      'metro_cap_reached',
      now()
    FROM public.profiles p
    WHERE p.is_admin = true;
    
    -- Log for monitoring
    RAISE NOTICE '[METRO_CAP] Metro "%s" reached max_cap (%s/%s) for %s', 
      NEW.metro_name, NEW.platetaker_count, NEW.max_cap, metro_role;
  END IF;

  RETURN NEW;
END;
$$;

-- Function: Notify when metro cap is reached (for Edge Function webhook)
-- Updated to use platemaker_count/platetaker_count and max_cap dynamically
CREATE OR REPLACE FUNCTION public.notify_metro_cap_reached_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  webhook_payload jsonb;
  http_response jsonb;
  cap_type text;
BEGIN
  -- Check if platemaker_count reached max_cap (dynamic, not hardcoded 100)
  IF NEW.platemaker_count = NEW.max_cap AND (OLD.platemaker_count IS NULL OR OLD.platemaker_count < NEW.max_cap) THEN
    cap_type := 'platemakers';
    webhook_payload := jsonb_build_object(
      'metro_name', NEW.metro_name,
      'platemaker_count', NEW.platemaker_count,
      'platetaker_count', NEW.platetaker_count,
      'cap_type', cap_type,
      'max_cap', NEW.max_cap,
      'timestamp', now()
    );

    -- Construct Edge Function URL
    SELECT current_setting('app.supabase_url', true) INTO edge_function_url;
    
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
      edge_function_url := 'https://' || current_database() || '.supabase.co/functions/v1/notify-cap-reached';
    ELSE
      edge_function_url := edge_function_url || '/functions/v1/notify-cap-reached';
    END IF;

    -- Make HTTP POST request to Edge Function
    SELECT * INTO http_response
    FROM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body := webhook_payload::text
    );

    -- Log the notification attempt (non-blocking)
    RAISE NOTICE 'Metro cap reached notification sent for %: % (count: %/%%)', 
      NEW.metro_name, cap_type, NEW.platemaker_count, NEW.max_cap;
  END IF;

  -- Check if platetaker_count reached max_cap (dynamic, not hardcoded 100)
  IF NEW.platetaker_count = NEW.max_cap AND (OLD.platetaker_count IS NULL OR OLD.platetaker_count < NEW.max_cap) THEN
    cap_type := 'platetakers';
    webhook_payload := jsonb_build_object(
      'metro_name', NEW.metro_name,
      'platemaker_count', NEW.platemaker_count,
      'platetaker_count', NEW.platetaker_count,
      'cap_type', cap_type,
      'max_cap', NEW.max_cap,
      'timestamp', now()
    );

    -- Construct Edge Function URL
    SELECT current_setting('app.supabase_url', true) INTO edge_function_url;
    
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
      edge_function_url := 'https://' || current_database() || '.supabase.co/functions/v1/notify-cap-reached';
    ELSE
      edge_function_url := edge_function_url || '/functions/v1/notify-cap-reached';
    END IF;

    -- Make HTTP POST request to Edge Function
    SELECT * INTO http_response
    FROM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body := webhook_payload::text
    );

    -- Log the notification attempt (non-blocking)
    RAISE NOTICE 'Metro cap reached notification sent for %: % (count: %/%%)', 
      NEW.metro_name, cap_type, NEW.platetaker_count, NEW.max_cap;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send metro cap notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Function: Seed metro counts when new geofence is added
-- Updated to use platemaker_count/platetaker_count
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

-- ============================================================================
-- STEP 4: Recreate all triggers with updated column references
-- ============================================================================

-- Create trigger for admin notifications (uses notify_metro_cap_reached)
CREATE TRIGGER metro_cap_reached_trigger
  AFTER UPDATE ON public.metro_area_counts
  FOR EACH ROW
  WHEN (
    (NEW.platemaker_count = NEW.max_cap AND OLD.platemaker_count < NEW.max_cap) OR
    (NEW.platetaker_count = NEW.max_cap AND OLD.platetaker_count < NEW.max_cap)
  )
  EXECUTE FUNCTION public.notify_metro_cap_reached();

-- Create trigger for webhook notifications (uses notify_metro_cap_reached_webhook)
-- This fires on UPDATE of specific columns for efficiency
CREATE TRIGGER metro_cap_reached_webhook_trigger
  AFTER UPDATE OF platemaker_count, platetaker_count ON public.metro_area_counts
  FOR EACH ROW
  WHEN (
    (NEW.platemaker_count = NEW.max_cap AND (OLD.platemaker_count IS NULL OR OLD.platemaker_count < NEW.max_cap)) OR
    (NEW.platetaker_count = NEW.max_cap AND (OLD.platetaker_count IS NULL OR OLD.platetaker_count < NEW.max_cap))
  )
  EXECUTE FUNCTION public.notify_metro_cap_reached_webhook();

-- Recreate seed trigger for metro geofences
CREATE TRIGGER seed_metro_counts_trigger
  AFTER INSERT ON public.metro_geofences
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_metro_counts();

-- ============================================================================
-- STEP 5: Update comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.metro_area_counts.platemaker_count IS 'Count of platemaker (seller) users in this metro area';
COMMENT ON COLUMN public.metro_area_counts.platetaker_count IS 'Count of platetaker (buyer) users in this metro area';
COMMENT ON COLUMN public.metro_promo_tracking.platemaker_count IS 'Count of platemaker users for promotional tracking';
COMMENT ON COLUMN public.metro_promo_tracking.platetaker_count IS 'Count of platetaker users for promotional tracking';
COMMENT ON FUNCTION public.increment_metro_count IS 'Atomically increments platemaker_count or platetaker_count for a metro area (thread-safe). Returns status string: SUCCESS if under cap, CAP_REACHED if cap exceeded.';
COMMENT ON FUNCTION public.notify_metro_cap_reached IS 'Trigger function that creates admin notifications when metro area count reaches max_cap. Triggers when platemaker_count or platetaker_count hits max_cap exactly.';
COMMENT ON FUNCTION public.notify_metro_cap_reached_webhook IS 'Trigger function that sends webhook notification when metro area cap (max_cap) is reached. Calls Supabase Edge Function via HTTP.';
COMMENT ON FUNCTION public.seed_metro_counts IS 'Trigger function that automatically creates metro_area_counts entry when a new metro_geofences entry is added. Handles metadata creation for new cities automatically.';
COMMENT ON TRIGGER metro_cap_reached_trigger ON public.metro_area_counts IS 'Fires when platemaker_count or platetaker_count reaches max_cap, creating admin notifications';
COMMENT ON TRIGGER metro_cap_reached_webhook_trigger ON public.metro_area_counts IS 'Fires when platemaker_count or platetaker_count reaches max_cap, sending notification via Edge Function';

-- ============================================================================
-- TRANSACTION COMMIT
-- ============================================================================
-- All changes are atomic - if any step fails, entire transaction rolls back
COMMIT;
