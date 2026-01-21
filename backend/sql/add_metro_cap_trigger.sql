-- Migration: Add trigger to notify when metro area cap is reached
-- This trigger fires when platemaker_count or platetaker_count reaches max_cap
-- It calls a Supabase Edge Function to send webhook notifications

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to notify when metro cap is reached
CREATE OR REPLACE FUNCTION public.notify_metro_cap_reached()
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
  -- Check if platemaker count reached max_cap
  IF NEW.platemaker_count = NEW.max_cap AND (OLD.platemaker_count IS NULL OR OLD.platemaker_count < NEW.max_cap) THEN
    cap_type := 'platemakers';
    webhook_payload := jsonb_build_object(
      'metro_name', NEW.metro_name,
      'platemaker_count', NEW.platemaker_count,
      'platetaker_count', NEW.platetaker_count,
      'cap_type', cap_type,
      'timestamp', now()
    );

    -- Call Edge Function via pg_net
    -- The Edge Function URL should be: https://<project-ref>.supabase.co/functions/v1/notify-cap-reached
    -- We'll use an environment variable or construct from current_database()
    SELECT current_setting('app.supabase_url', true) INTO edge_function_url;
    
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
      -- Fallback: construct URL from database name pattern
      -- This assumes the database name follows Supabase's pattern
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

  -- Check if platetaker count reached max_cap
  IF NEW.platetaker_count = NEW.max_cap AND (OLD.platetaker_count IS NULL OR OLD.platetaker_count < NEW.max_cap) THEN
    cap_type := 'platetakers';
    webhook_payload := jsonb_build_object(
      'metro_name', NEW.metro_name,
      'platemaker_count', NEW.platemaker_count,
      'platetaker_count', NEW.platetaker_count,
      'cap_type', cap_type,
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

-- Create trigger on metro_area_counts table
DROP TRIGGER IF EXISTS metro_cap_reached_trigger ON public.metro_area_counts;

CREATE TRIGGER metro_cap_reached_trigger
  AFTER UPDATE OF platemaker_count, platetaker_count ON public.metro_area_counts
  FOR EACH ROW
  WHEN (
    (NEW.platemaker_count = NEW.max_cap AND (OLD.platemaker_count IS NULL OR OLD.platemaker_count < NEW.max_cap))
    OR
    (NEW.platetaker_count = NEW.max_cap AND (OLD.platetaker_count IS NULL OR OLD.platetaker_count < NEW.max_cap))
  )
  EXECUTE FUNCTION public.notify_metro_cap_reached();

-- Add comments for documentation
COMMENT ON FUNCTION public.notify_metro_cap_reached IS 'Trigger function that sends webhook notification when metro area cap (max_cap) is reached. Calls Supabase Edge Function via HTTP.';
COMMENT ON TRIGGER metro_cap_reached_trigger ON public.metro_area_counts IS 'Fires when platemaker_count or platetaker_count reaches max_cap, sending notification via Edge Function';
