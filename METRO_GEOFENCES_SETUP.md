# Metro Geofences Setup Guide (GeoJSON)

## Overview

Circular geofences (Radius) are great for MVP, but **GeoJSON Boundaries (Polygons)** are needed for precision (e.g., excluding users across a state line).

This guide helps you migrate from radius-based geofencing to polygon-based boundaries using PostGIS.

## Why Migrate from Radius to Polygons?

### Limitations of Circular Geofences
- **False positives**: Includes users across state/county boundaries
- **Imprecise coverage**: Circular radius doesn't match actual metro area shapes
- **Edge cases**: Hard to exclude specific regions (e.g., water bodies, unserved areas)
- **Compliance issues**: May violate geographic restrictions

### Benefits of Polygon Boundaries
- **Precise boundaries**: Follow actual Metropolitan Statistical Area (MSA) borders
- **State line accuracy**: Exclude users across state boundaries
- **Complex shapes**: Handle irregular metro areas accurately
- **Compliance**: Respect geographic restrictions exactly

## 🏗 Schema Migration

To support complex shapes, ensure the `center` column (Point) is supplemented by a `boundary` column (Polygon/MultiPolygon).

### Step 1: Add Boundary Column

If you have an existing table with `center` and `radius` columns:

```sql
-- Add boundary column for polygon-based geofencing
ALTER TABLE metro_geofences 
ADD COLUMN boundary GEOMETRY(MultiPolygon, 4326);

-- Create spatial index for efficient queries
CREATE INDEX idx_metro_boundary ON metro_geofences USING GIST(boundary);
```

### Step 2: Migrate Existing Data (Optional)

If you want to convert existing radius-based geofences to approximate polygons:

```sql
-- Convert circular radius to approximate polygon (buffered circle)
-- This is a temporary measure - replace with actual GeoJSON boundaries
UPDATE metro_geofences
SET boundary = ST_Buffer(
  ST_SetSRID(center::geometry, 4326)::geography,
  radius
)::geometry
WHERE boundary IS NULL AND center IS NOT NULL AND radius IS NOT NULL;
```

**Note**: This creates an approximate polygon from the circle. For production, you should replace these with actual MSA boundary GeoJSON data.

### Step 3: Update Application Code

Modify your geofence queries to use `ST_DWithin` or `ST_Contains` with the `boundary` column instead of distance calculations:

**Before (Radius-based):**
```sql
SELECT metro_name
FROM metro_geofences
WHERE ST_Distance(
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
  center::geography
) <= radius;
```

**After (Polygon-based):**
```sql
SELECT metro_name
FROM metro_geofences
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(lng, lat), 4326),
  boundary,
  0.01  -- ~1.1km buffer for GPS accuracy
);
```

### Step 4: Populate with GeoJSON Boundaries

Replace approximate polygons with actual MSA boundaries:

```sql
INSERT INTO metro_geofences (metro_name, boundary)
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
)
ON CONFLICT (metro_name) DO UPDATE
SET boundary = EXCLUDED.boundary;
```

### Step 5: Deprecate Old Columns (After Migration)

Once all boundaries are populated and tested:

```sql
-- Optional: Keep center for backward compatibility or remove
-- ALTER TABLE metro_geofences DROP COLUMN center;
-- ALTER TABLE metro_geofences DROP COLUMN radius;
```

## Data Sources for GeoJSON Boundaries

### Recommended Sources

1. **US Census Bureau - Metropolitan Statistical Areas (MSAs)**
   - Official MSA boundaries
   - URL: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html

2. **OpenStreetMap (OSM)**
   - Community-maintained boundaries
   - Can be exported via Overpass API
   - URL: https://www.openstreetmap.org/

3. **Natural Earth Data**
   - Simplified boundaries for testing
   - URL: https://www.naturalearthdata.com/

## Verification

### Check if boundaries are loaded:

```sql
SELECT metro_name, 
       ST_AsText(boundary) as boundary_wkt,
       ST_Area(boundary::geography) / 1000000 as area_sq_km
FROM metro_geofences
WHERE boundary IS NOT NULL
ORDER BY metro_name;
```

### Test point-in-polygon query:

```sql
-- Test with a known coordinate
SELECT metro_name
FROM metro_geofences
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(-73.985130, 40.758896), 4326),  -- Times Square
  boundary,
  0.01
);
```

### Compare radius vs polygon:

```sql
-- Compare old radius-based query with new polygon-based query
SELECT 
  metro_name,
  -- Old method (if center/radius still exist)
  CASE 
    WHEN center IS NOT NULL AND radius IS NOT NULL
    THEN ST_Distance(
      ST_SetSRID(ST_MakePoint(-73.985130, 40.758896), 4326)::geography,
      center::geography
    ) <= radius
    ELSE NULL
  END as within_radius,
  -- New method
  ST_DWithin(
    ST_SetSRID(ST_MakePoint(-73.985130, 40.758896), 4326),
    boundary,
    0.01
  ) as within_boundary
FROM metro_geofences;
```

## Troubleshooting

### Issue: "Geometry type mismatch"

**Solution**: Ensure GeoJSON matches the column type:
- Use `POLYGON` for single continuous areas
- Use `MultiPolygon` if metro spans disconnected regions (e.g., islands)

```sql
-- Change to MultiPolygon if needed
ALTER TABLE metro_geofences 
ALTER COLUMN boundary TYPE geometry(MultiPolygon, 4326);
```

### Issue: "Boundary is NULL"

**Solution**: Verify boundaries are loaded:

```sql
SELECT COUNT(*) as total_metros,
       COUNT(boundary) as metros_with_boundaries,
       COUNT(*) - COUNT(boundary) as metros_without_boundaries
FROM metro_geofences;
```

### Issue: Slow queries

**Solution**: Verify GIST index exists:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'metro_geofences'
AND indexname = 'idx_metro_boundary';
```

## Complete Example

See `backend/sql/METRO_GEOFENCES_SETUP.md` for the complete production setup with all 50 major metros.

## Related Files

- `backend/sql/add_metro_area_counts.sql` - PostGIS setup and functions
- `backend/sql/METRO_GEOFENCES_SETUP.md` - Detailed GeoJSON setup guide
- `backend/trpc/routes/auth/signup/route.ts` - Signup route using PostGIS
- `backend/trpc/routes/membership/subscribe/route.ts` - Metro list reference
