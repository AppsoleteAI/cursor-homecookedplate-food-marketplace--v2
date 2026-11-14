-- Live metro_area_counts was created without updated_at.
-- increment_metro_count sets that column, so Create Account inside a metro
-- fails and the form shows the busy-kitchen sentence.
-- Ran in the SQL editor on 10 November 2026. Success with no rows.
-- Do not run it again.

ALTER TABLE public.metro_area_counts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
