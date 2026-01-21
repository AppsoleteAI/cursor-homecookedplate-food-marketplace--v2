-- Migration: Add metro area geofencing and counting with PostGIS support
-- Run this SQL in your Supabase SQL Editor
-- Requires PostGIS extension to be enabled

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add profile columns for metro area and trial tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS metro_area text,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Create index for metro_area lookups
CREATE INDEX IF NOT EXISTS idx_profiles_metro_area ON public.profiles(metro_area);

-- Metro geofences table for PostGIS spatial queries
-- This table stores the geographic boundaries of each metro area
-- LOCKED SCHEMA: boundary is MultiPolygon for high-precision city limits
-- center and radius_meters provide fallback for circular coverage
CREATE TABLE IF NOT EXISTS public.metro_geofences (
  metro_name text PRIMARY KEY,
  boundary geometry(MultiPolygon, 4326), -- LOCKED: High-precision city limits, can be NULL
  center geography(POINT, 4326), -- Centroid for radius fallbacks
  radius_meters float, -- Used for circular fallbacks if boundary is NULL
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create spatial indexes for efficient geofence queries
CREATE INDEX IF NOT EXISTS idx_metro_geofences_boundary ON public.metro_geofences USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_metro_geofences_center ON public.metro_geofences USING GIST (center);

-- Metro area counts table - tracks member counts per role per metro
CREATE TABLE IF NOT EXISTS public.metro_area_counts (
  metro_name text PRIMARY KEY,
  platemaker_count integer DEFAULT 0 NOT NULL CHECK (platemaker_count >= 0),
  platetaker_count integer DEFAULT 0 NOT NULL CHECK (platetaker_count >= 0),
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_metro_area_counts_metro_name ON public.metro_area_counts(metro_name);

-- RPC function: Find metro area by GPS coordinates using PostGIS
-- Priority: ST_Contains(boundary, ...) for high-precision match, then ST_DWithin(center, ...) for fallback
-- LOCKED LOGIC: Must use this priority order per RORK requirements
CREATE OR REPLACE FUNCTION public.find_metro_by_location(
  lng double precision,
  lat double precision
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result_metro text;
  point_geom geometry;
  point_geog geography;
BEGIN
  -- Create point geometry/geography from input coordinates
  point_geom := ST_SetSRID(ST_MakePoint(lng, lat), 4326);
  point_geog := point_geom::geography;

  -- Priority 1: High-precision boundary match using ST_Contains
  -- Only check if boundary is not NULL
  SELECT metro_name INTO result_metro
  FROM public.metro_geofences
  WHERE boundary IS NOT NULL
    AND ST_Contains(boundary, point_geom)
  LIMIT 1;

  -- Priority 2: Fallback to circular radius if boundary match failed
  -- Use ST_DWithin with center and radius_meters
  IF result_metro IS NULL THEN
    SELECT metro_name INTO result_metro
    FROM public.metro_geofences
    WHERE center IS NOT NULL
      AND radius_meters IS NOT NULL
      AND ST_DWithin(center, point_geog, radius_meters)
    LIMIT 1;
  END IF;

  RETURN result_metro;
END;
$$;

-- RPC function: Atomically increment metro area count for a specific role
-- Uses SELECT FOR UPDATE to prevent race conditions
-- Returns status string 'SUCCESS' or 'CAP_REACHED' based on max_cap
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

-- RPC function: Get metro settings by location (combines lookup + settings query)
-- Returns metro settings if found, NULL if not in any metro
-- This consolidates find_metro_by_location + metro_geofences query into a single call
CREATE OR REPLACE FUNCTION public.get_metro_settings_by_location(
  lat double precision,
  lng double precision
)
RETURNS TABLE (
  metro_name text,
  is_active boolean,
  trial_days integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  result_metro text;
  point_geom geometry;
  point_geog geography;
BEGIN
  -- Create point geometry/geography from input coordinates
  point_geom := ST_SetSRID(ST_MakePoint(lng, lat), 4326);
  point_geog := point_geom::geography;

  -- Priority 1: High-precision boundary match using ST_Contains
  -- Only check if boundary is not NULL
  SELECT metro_name INTO result_metro
  FROM public.metro_geofences
  WHERE boundary IS NOT NULL
    AND ST_Contains(boundary, point_geom)
  LIMIT 1;

  -- Priority 2: Fallback to circular radius if boundary match failed
  -- Use ST_DWithin with center and radius_meters
  IF result_metro IS NULL THEN
    SELECT metro_name INTO result_metro
    FROM public.metro_geofences
    WHERE center IS NOT NULL
      AND radius_meters IS NOT NULL
      AND ST_DWithin(center, point_geog, radius_meters)
    LIMIT 1;
  END IF;

  -- If metro found, return its settings
  IF result_metro IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      mg.metro_name,
      mg.is_active,
      mg.trial_days
    FROM public.metro_geofences mg
    WHERE mg.metro_name = result_metro;
  END IF;

  -- No metro found - return empty result (no rows)
  RETURN;
END;
$$;

-- Initialize metro_area_counts with all major metros (from MAJOR_METROS list)
INSERT INTO public.metro_area_counts (metro_name, platemaker_count, platetaker_count)
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
COMMENT ON COLUMN public.profiles.metro_area IS 'Metro area name determined by geolocation (for early bird trial eligibility)';
COMMENT ON COLUMN public.profiles.trial_ends_at IS 'Trial period end date (set to now() + 90 days if eligible for early bird)';
COMMENT ON TABLE public.metro_geofences IS 'PostGIS geometry boundaries for metro areas - used for spatial geocoding. boundary is LOCKED MultiPolygon for high-precision city limits. center and radius_meters provide circular fallback.';
COMMENT ON COLUMN public.metro_geofences.boundary IS 'LOCKED: GEOMETRY(MultiPolygon, 4326) - High-precision city limits. Always wrap polygons in ST_Multi() for compatibility.';
COMMENT ON COLUMN public.metro_geofences.center IS 'GEOGRAPHY(POINT, 4326) - Centroid for radius fallbacks';
COMMENT ON COLUMN public.metro_geofences.radius_meters IS 'FLOAT - Used for circular fallbacks if boundary is NULL';
COMMENT ON TABLE public.metro_area_counts IS 'Tracks member counts per role per metro area (100 makers + 100 takers per metro)';
COMMENT ON FUNCTION public.find_metro_by_location IS 'PostGIS function to find metro area by GPS coordinates. Priority: ST_Contains(boundary) then ST_DWithin(center, radius_meters). LOCKED LOGIC per RORK requirements.';
COMMENT ON FUNCTION public.increment_metro_count IS 'Atomically increments platemaker_count or platetaker_count for a metro area (thread-safe). Returns status string: SUCCESS if under cap, CAP_REACHED if cap exceeded.';
COMMENT ON FUNCTION public.get_metro_settings_by_location IS 'Combines metro lookup by location with settings retrieval. Returns metro_name, is_active, and trial_days if metro found, otherwise returns no rows. Single database call replaces find_metro_by_location + metro_geofences query.';
