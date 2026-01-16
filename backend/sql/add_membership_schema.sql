-- Migration: Add membership subscription support
-- Run this SQL in your Supabase SQL Editor

-- Add membership columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS membership_tier text DEFAULT 'free' CHECK (membership_tier IN ('free', 'premium')),
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_membership_tier ON public.profiles(membership_tier);

-- Promotion configs table for managing trial promotions
CREATE TABLE IF NOT EXISTS public.promotion_configs (
  promo_name text PRIMARY KEY,
  is_active boolean DEFAULT true NOT NULL,
  trial_days integer CHECK (trial_days IN (30, 60, 90)),
  max_makers_per_metro integer DEFAULT 100 NOT NULL,
  max_takers_per_metro integer DEFAULT 100 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Metro promo tracking table to track usage per metro area
CREATE TABLE IF NOT EXISTS public.metro_promo_tracking (
  metro_name text PRIMARY KEY,
  maker_count integer DEFAULT 0 NOT NULL,
  taker_count integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create updated_at trigger for promotion_configs
CREATE TRIGGER set_updated_at_promotion_configs
  BEFORE UPDATE ON public.promotion_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default EARLY_BIRD promotion config
INSERT INTO public.promotion_configs (promo_name, is_active, trial_days, max_makers_per_metro, max_takers_per_metro)
VALUES ('EARLY_BIRD', true, 90, 100, 100)
ON CONFLICT (promo_name) DO NOTHING;

-- Insert initial metro tracking records for all 50 major metros
INSERT INTO public.metro_promo_tracking (metro_name, maker_count, taker_count)
VALUES
  ('New York-Newark-Jersey City', 0, 0),
  ('Los Angeles-Long Beach-Anaheim', 0, 0),
  ('Chicago-Naperville-Elgin', 0, 0),
  ('Dallas-Fort Worth-Arlington', 0, 0),
  ('Houston-The Woodlands-Sugar Land', 0, 0),
  ('Washington-Arlington-Alexandria', 0, 0),
  ('Philadelphia-Camden-Wilmington', 0, 0),
  ('Miami-Fort Lauderdale-Pompano Beach', 0, 0),
  ('Atlanta-Sandy Springs-Alpharetta', 0, 0),
  ('Boston-Cambridge-Newton', 0, 0),
  ('Phoenix-Mesa-Chandler', 0, 0),
  ('San Francisco-Oakland-Berkeley', 0, 0),
  ('Riverside-San Bernardino-Ontario', 0, 0),
  ('Detroit-Warren-Dearborn', 0, 0),
  ('Seattle-Tacoma-Bellevue', 0, 0),
  ('Minneapolis-St. Paul-Bloomington', 0, 0),
  ('San Diego-Chula Vista-Carlsbad', 0, 0),
  ('Tampa-St. Petersburg-Clearwater', 0, 0),
  ('Denver-Aurora-Lakewood', 0, 0),
  ('Baltimore-Columbia-Towson', 0, 0),
  ('St. Louis', 0, 0),
  ('Orlando-Kissimmee-Sanford', 0, 0),
  ('Charlotte-Concord-Gastonia', 0, 0),
  ('San Antonio-New Braunfels', 0, 0),
  ('Portland-Vancouver-Hillsboro', 0, 0),
  ('Sacramento-Roseville-Folsom', 0, 0),
  ('Pittsburgh', 0, 0),
  ('Austin-Round Rock-Georgetown', 0, 0),
  ('Las Vegas-Henderson-Paradise', 0, 0),
  ('Cincinnati', 0, 0),
  ('Kansas City', 0, 0),
  ('Columbus', 0, 0),
  ('Indianapolis-Carmel-Anderson', 0, 0),
  ('Cleveland-Elyria', 0, 0),
  ('Nashville-Davidson-Murfreesboro-Franklin', 0, 0),
  ('Virginia Beach-Norfolk-Newport News', 0, 0),
  ('Providence-Warwick', 0, 0),
  ('Jacksonville', 0, 0),
  ('Milwaukee-Waukesha', 0, 0),
  ('Oklahoma City', 0, 0),
  ('Raleigh-Cary', 0, 0),
  ('Memphis', 0, 0),
  ('Richmond', 0, 0),
  ('Louisville/Jefferson County', 0, 0),
  ('New Orleans-Metairie', 0, 0),
  ('Salt Lake City', 0, 0),
  ('Hartford-West Hartford-East Hartford', 0, 0),
  ('Buffalo-Cheektowaga', 0, 0),
  ('Birmingham-Hoover', 0, 0),
  ('Rochester', 0, 0)
ON CONFLICT (metro_name) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.membership_tier IS 'User membership tier: free or premium';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON TABLE public.promotion_configs IS 'Configuration for promotional offers (e.g., early bird trial)';
COMMENT ON TABLE public.metro_promo_tracking IS 'Tracks promotional usage per metro area to enforce quotas';
