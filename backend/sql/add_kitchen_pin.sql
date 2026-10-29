-- Saved kitchen and buyer pin for the 20-mile pickup circle.
-- Membership still uses metro_area. Run this in the Supabase SQL editor.
-- profiles.trial_started_at is already on the live table. Do not re-run that file.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kitchen_lat double precision,
  ADD COLUMN IF NOT EXISTS kitchen_lng double precision;

COMMENT ON COLUMN public.profiles.kitchen_lat IS 'Latitude saved by Get GPS. A plate is offered only within 20 miles of the cook pin.';
COMMENT ON COLUMN public.profiles.kitchen_lng IS 'Longitude saved by Get GPS. A plate is offered only within 20 miles of the cook pin.';
