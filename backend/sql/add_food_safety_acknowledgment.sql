-- Migration: Add food_safety_acknowledged to profiles table
-- This tracks whether platemakers have acknowledged food safety requirements
-- Run this SQL in your Supabase SQL Editor

-- Add the food_safety_acknowledged column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS food_safety_acknowledged boolean DEFAULT false;

-- Add a comment explaining the column
COMMENT ON COLUMN public.profiles.food_safety_acknowledged IS 'Tracks whether platemakers have acknowledged food safety requirements and reviewed cottagefoodlaws.com. Required before publishing meals.';
