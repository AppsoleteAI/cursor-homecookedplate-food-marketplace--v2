-- Five 50-mile membership circles: Anchorage, Honolulu, San Juan, Mayagüez, Charlotte Amalie.
-- Charlotte Amalie covers St. Thomas, St. John, and St. Croix. Run this in the Supabase SQL editor.
-- The app also matches these names from code when a geofence row is missing.

INSERT INTO public.metro_geofences (metro_name, center, radius_meters, is_active, trial_days)
VALUES
  ('Anchorage', ST_SetSRID(ST_MakePoint(-149.9003, 61.2181), 4326)::geography, 80000, true, 90),
  ('Honolulu', ST_SetSRID(ST_MakePoint(-157.8583, 21.3069), 4326)::geography, 80000, true, 90),
  ('San Juan', ST_SetSRID(ST_MakePoint(-66.1057, 18.4655), 4326)::geography, 80000, true, 90),
  ('Mayagüez', ST_SetSRID(ST_MakePoint(-67.1396, 18.2013), 4326)::geography, 80000, true, 90),
  ('Charlotte Amalie', ST_SetSRID(ST_MakePoint(-64.9307, 18.3419), 4326)::geography, 80000, true, 90)
ON CONFLICT (metro_name) DO UPDATE
SET center = EXCLUDED.center,
    radius_meters = EXCLUDED.radius_meters,
    is_active = true;

INSERT INTO public.metro_area_counts (metro_name, platemaker_count, platetaker_count, max_cap)
VALUES
  ('Anchorage', 0, 0, 100),
  ('Honolulu', 0, 0, 100),
  ('San Juan', 0, 0, 100),
  ('Mayagüez', 0, 0, 100),
  ('Charlotte Amalie', 0, 0, 100)
ON CONFLICT (metro_name) DO NOTHING;
