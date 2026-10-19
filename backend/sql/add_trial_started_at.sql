-- PlateMaker Early Bird start date. The 90-day check already reads trial_ends_at.
-- Run this in the Supabase SQL editor. The claim still records trial_ends_at if this column is absent.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

COMMENT ON COLUMN public.profiles.trial_started_at IS 'When the PlateMaker started Early Bird. Null until they choose it. No card is charged.';
COMMENT ON COLUMN public.profiles.trial_ends_at IS 'When Early Bird ends. The PlateMaker stays on Premium until this instant, then membership_tier returns to free.';
