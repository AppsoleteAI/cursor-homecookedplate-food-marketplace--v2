-- Close the advisor warnings this project can close.
-- Sets a fixed search path on functions that do not have one.
-- Removes the alert insert rule that allowed any key to insert.
-- Stops a public request from listing every meal file and every profile photo.
-- A known public photo URL still opens, because both buckets stay public.
-- Does not change is_admin(), session_completed_second_factor(), or PostGIS.
-- Run once in the Supabase SQL editor.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
      RAISE NOTICE 'path %', r.sig;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped %', r.sig;
    END;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "service_role_can_insert_alerts" ON public.admin_system_alerts;

DROP POLICY IF EXISTS "Public can view meal media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
