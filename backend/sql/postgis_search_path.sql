-- Run in the SQL editor before Supabase moves PostGIS to extensions.
-- Adds extensions after public. While PostGIS remains in public, ST_* still resolves there.
-- After the move, geometry, geography, and ST_* resolve in extensions.
-- Does not change the function bodies.

ALTER FUNCTION public.find_metro_by_location(double precision, double precision)
  SET search_path = public, extensions;

ALTER FUNCTION public.get_metro_settings_by_location(double precision, double precision)
  SET search_path = public, extensions;

SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.proconfig AS pinned_search_path
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('find_metro_by_location', 'get_metro_settings_by_location')
ORDER BY p.proname;
