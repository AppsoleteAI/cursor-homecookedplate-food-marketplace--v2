# Metro Geofences Setup Guide (GeoJSON)

## Overview

The `metro_geofences` table uses **Polygon/MultiPolygon boundaries** (not circular radius) for precise geofencing. This allows the system to:
- Exclude users across state lines
- Follow actual metropolitan statistical area (MSA) boundaries
- Handle complex metro shapes accurately
- Avoid false positives from circular radius approximations

## Current Schema

The table is already set up with the correct structure:

```sql
CREATE TABLE IF NOT EXISTS public.metro_geofences (
  metro_name text PRIMARY KEY,
  boundary geometry(POLYGON, 4326) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Spatial index for fast queries
CREATE INDEX IF NOT EXISTS idx_metro_geofences_boundary 
ON public.metro_geofences USING GIST (boundary);
```

**Key Points:**
- `boundary` column uses `geometry(POLYGON, 4326)` - supports complex polygon shapes
- SRID 4326 = WGS84 coordinate system (standard GPS coordinates)
- GIST spatial index enables fast point-in-polygon queries (< 10ms)

## Data Sources

### Recommended Sources

1. **US Census Bureau - Metropolitan Statistical Areas (MSAs)**
   - Official MSA boundaries
   - Available as shapefiles or GeoJSON
   - URL: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html

2. **OpenStreetMap (OSM)**
   - Community-maintained boundaries
   - Can be exported via Overpass API or OSMnx
   - URL: https://www.openstreetmap.org/

3. **Natural Earth Data**
   - Simplified boundaries for web mapping
   - Good for MVP/testing
   - URL: https://www.naturalearthdata.com/

4. **Custom GeoJSON Services**
   - Google Maps Platform (requires API key)
   - Mapbox (requires API key)
   - Commercial boundary data providers

## Inserting Boundaries

### Basic Insert Pattern

Use `ST_GeomFromGeoJSON()` to convert GeoJSON to PostGIS geometry:

```sql
INSERT INTO public.metro_geofences (metro_name, boundary)
VALUES (
  'New York-Newark-Jersey City',
  ST_GeomFromGeoJSON('{
    "type": "Polygon",
    "coordinates": [[
      [-74.5, 40.5],
      [-73.5, 40.5],
      [-73.5, 41.0],
      [-74.5, 41.0],
      [-74.5, 40.5]
    ]]
  }')
);
```

### Handling MultiPolygon Boundaries

Some metros span multiple disconnected areas (e.g., islands, separated regions):

```sql
INSERT INTO public.metro_geofences (metro_name, boundary)
VALUES (
  'Los Angeles-Long Beach-Anaheim',
  ST_GeomFromGeoJSON('{
    "type": "MultiPolygon",
    "coordinates": [
      [[[lon1, lat1], [lon2, lat2], ...]],  -- Main area
      [[[lon3, lat3], [lon4, lat4], ...]]   -- Separate area
    ]
  }')
);
```

**Note:** The current schema uses `POLYGON` type. If you need MultiPolygon support, you may need to alter the column:

```sql
-- Only if you need MultiPolygon support
ALTER TABLE public.metro_geofences 
ALTER COLUMN boundary TYPE geometry(MultiPolygon, 4326);
```

### Bulk Import Script

For importing multiple metros at once, you can create a script:

```sql
-- Example: Import from a JSON array
DO $$
DECLARE
  metro_record RECORD;
  metro_data JSONB := '[
    {
      "name": "New York-Newark-Jersey City",
      "geojson": {"type": "Polygon", "coordinates": [...]}
    },
    {
      "name": "Los Angeles-Long Beach-Anaheim",
      "geojson": {"type": "Polygon", "coordinates": [...]}
    }
  ]'::JSONB;
BEGIN
  FOR metro_record IN SELECT * FROM jsonb_array_elements(metro_data)
  LOOP
    INSERT INTO public.metro_geofences (metro_name, boundary)
    VALUES (
      metro_record->>'name',
      ST_GeomFromGeoJSON(metro_record->>'geojson'::text)
    )
    ON CONFLICT (metro_name) DO UPDATE
    SET boundary = EXCLUDED.boundary,
        updated_at = now();
  END LOOP;
END $$;
```

## Metro List

The following 50 metros are eligible for early bird trial promotion. All should have boundaries in `metro_geofences`:

1. New York-Newark-Jersey City
2. Los Angeles-Long Beach-Anaheim
3. Chicago-Naperville-Elgin
4. Dallas-Fort Worth-Arlington
5. Houston-The Woodlands-Sugar Land
6. Washington-Arlington-Alexandria
7. Philadelphia-Camden-Wilmington
8. Miami-Fort Lauderdale-Pompano Beach
9. Atlanta-Sandy Springs-Alpharetta
10. Boston-Cambridge-Newton
11. Phoenix-Mesa-Chandler
12. San Francisco-Oakland-Berkeley
13. Riverside-San Bernardino-Ontario
14. Detroit-Warren-Dearborn
15. Seattle-Tacoma-Bellevue
16. Minneapolis-St. Paul-Bloomington
17. San Diego-Chula Vista-Carlsbad
18. Tampa-St. Petersburg-Clearwater
19. Denver-Aurora-Lakewood
20. Baltimore-Columbia-Towson
21. St. Louis
22. Orlando-Kissimmee-Sanford
23. Charlotte-Concord-Gastonia
24. San Antonio-New Braunfels
25. Portland-Vancouver-Hillsboro
26. Sacramento-Roseville-Folsom
27. Pittsburgh
28. Austin-Round Rock-Georgetown
29. Las Vegas-Henderson-Paradise
30. Cincinnati
31. Kansas City
32. Columbus
33. Indianapolis-Carmel-Anderson
34. Cleveland-Elyria
35. Nashville-Davidson-Murfreesboro-Franklin
36. Virginia Beach-Norfolk-Newport News
37. Providence-Warwick
38. Jacksonville
39. Milwaukee-Waukesha
40. Oklahoma City
41. Raleigh-Cary
42. Memphis
43. Richmond
44. Louisville/Jefferson County
45. New Orleans-Metairie
46. Salt Lake City
47. Hartford-West Hartford-East Hartford
48. Buffalo-Cheektowaga
49. Birmingham-Hoover
50. Rochester

**Reference:** See `backend/trpc/routes/membership/subscribe/route.ts` for the complete `MAJOR_METROS` array.

## Verification

### Check if boundaries are loaded:

```sql
SELECT metro_name, 
       ST_AsText(boundary) as boundary_wkt,
       ST_Area(boundary::geography) / 1000000 as area_sq_km
FROM public.metro_geofences
ORDER BY metro_name;
```

### Test point-in-polygon query:

```sql
-- Test with a known coordinate (e.g., Times Square, NYC)
SELECT metro_name
FROM public.metro_geofences
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(-73.985130, 40.758896), 4326),  -- Times Square
  boundary,
  0.01
);
```

Expected result: `New York-Newark-Jersey City`

### Count loaded metros:

```sql
SELECT COUNT(*) as loaded_metros
FROM public.metro_geofences;
```

Should return 50 when all boundaries are loaded.

## PostGIS Function

The `find_metro_by_location` function uses `ST_DWithin` with a small buffer:

```sql
CREATE OR REPLACE FUNCTION public.find_metro_by_location(
  lng double precision,
  lat double precision
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result_metro text;
BEGIN
  SELECT metro_name INTO result_metro
  FROM public.metro_geofences
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(lng, lat), 4326),
    boundary,
    0.01  -- ~1.1km buffer for edge cases
  )
  LIMIT 1;
  
  RETURN result_metro;
END;
$$;
```

**Why ST_DWithin instead of ST_Contains?**
- Handles edge cases where coordinates fall exactly on boundary lines
- Small buffer (0.01 degrees ≈ 1.1km) accounts for GPS accuracy variations
- More robust for real-world coordinate data

## Troubleshooting

### Issue: "No metro area found" for valid coordinates

**Possible causes:**
1. Boundaries not loaded - check `SELECT COUNT(*) FROM metro_geofences;`
2. Coordinate order - function expects `(lng, lat)` not `(lat, lng)`
3. Coordinate system mismatch - ensure GeoJSON uses WGS84 (SRID 4326)
4. Boundary doesn't cover the coordinate - verify with `ST_Contains` test

**Debug query:**
```sql
-- Check which metros are near a coordinate
SELECT metro_name,
       ST_Distance(
         ST_SetSRID(ST_MakePoint(-73.985130, 40.758896), 4326),
         boundary::geography
       ) / 1000 as distance_km
FROM public.metro_geofences
ORDER BY distance_km
LIMIT 5;
```

### Issue: "Geometry type mismatch"

**Solution:** Ensure GeoJSON matches the column type:
- `POLYGON` for single continuous areas
- `MultiPolygon` if you altered the column type

### Issue: Slow queries

**Solution:** Verify GIST index exists:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'metro_geofences';
```

Should show `idx_metro_geofences_boundary` with `USING gist`.

## Next Steps

1. **Obtain GeoJSON boundaries** from one of the recommended sources
2. **Convert to PostGIS format** using `ST_GeomFromGeoJSON()`
3. **Insert all 50 metros** into `metro_geofences` table
4. **Verify with test queries** using known coordinates
5. **Monitor signup logs** for `[POSTGIS_LOCK]` messages to confirm detection

## Related Files

- `backend/sql/add_metro_area_counts.sql` - Initial PostGIS setup
- `backend/trpc/routes/auth/signup/route.ts` - Signup route using PostGIS
- `backend/trpc/routes/membership/subscribe/route.ts` - Metro list reference
