-- Migration: Add hardware lock trigger for lifetime memberships
-- Run this SQL in your Supabase SQL Editor
--
-- This trigger enforces device-locking for lifetime memberships at the database level.
-- It prevents unauthorized device_id changes that could allow lifetime membership transfers.

-- Create function to enforce hardware lock
CREATE OR REPLACE FUNCTION public.enforce_lifetime_hardware_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce for lifetime memberships
  IF NEW.membership_tier = 'lifetime' THEN
    -- If device_id is being changed and old device_id exists
    IF OLD.device_id IS NOT NULL AND NEW.device_id IS DISTINCT FROM OLD.device_id THEN
      -- RAISE EXCEPTION to prevent the update
      RAISE EXCEPTION 'Hardware mismatch: Lifetime membership is device-locked and non-transferable. Original device_id: %, Attempted device_id: %', 
        OLD.device_id, 
        NEW.device_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS enforce_lifetime_hardware_lock_trigger ON public.profiles;

CREATE TRIGGER enforce_lifetime_hardware_lock_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.membership_tier = 'lifetime')
  EXECUTE FUNCTION public.enforce_lifetime_hardware_lock();

-- Add comments for documentation
COMMENT ON FUNCTION public.enforce_lifetime_hardware_lock() IS 'Prevents device_id changes for lifetime memberships. Enforces hardware lock at database level to prevent unauthorized transfers.';
COMMENT ON TRIGGER enforce_lifetime_hardware_lock_trigger ON public.profiles IS 'Fires BEFORE UPDATE on profiles table when membership_tier is lifetime. Raises exception if device_id is being changed.';
