-- Migration: Add ON DELETE CASCADE to profiles table foreign key
-- This ensures that when a user is deleted from auth.users, their profile
-- and all related data (meals, orders, etc.) are automatically deleted.
-- 
-- Run this script in the Supabase SQL Editor

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE IF EXISTS public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Recreate the foreign key with ON DELETE CASCADE
ALTER TABLE IF EXISTS public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Verify the constraint was created correctly
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'profiles_id_fkey';
