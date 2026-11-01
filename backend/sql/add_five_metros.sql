-- Five 50-mile membership circles: Anchorage, Honolulu, San Juan, Mayagüez, Charlotte Amalie.
-- Charlotte Amalie covers St. Thomas, St. John, and St. Croix. Run this in the Supabase SQL editor.
-- The live metro_geofences table stores the city in name. Older scripts used metro_name.
-- This uses whichever of those columns exists, and only the circle columns that exist.
-- The app also matches these names from code when a geofence row is missing.

do $$
declare
  name_col text;
  radius_col text;
  center_type text;
  boundary_type text;
  has_active boolean;
  has_trial boolean;
  trigger_on boolean := false;
  metro text;
  lng double precision;
  lat double precision;
  found_row integer;
  set_sql text;
  insert_cols text;
  insert_vals text;
  center_expr text;
  boundary_expr text;
  count_name text;
  count_cols text;
  count_vals text;
  missing_required text;
begin
  select c.column_name into name_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'metro_geofences'
    and c.column_name in ('metro_name', 'name')
  order by case c.column_name when 'metro_name' then 0 else 1 end
  limit 1;

  if name_col is null then
    raise exception 'metro_geofences has no city column named name or metro_name';
  end if;

  select c.column_name into radius_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'metro_geofences'
    and c.column_name in ('radius_meters', 'radius')
  order by case c.column_name when 'radius_meters' then 0 else 1 end
  limit 1;

  select c.udt_name into center_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'metro_geofences'
    and c.column_name = 'center';

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_geofences' and column_name = 'is_active'
  ) into has_active;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_geofences' and column_name = 'trial_days'
  ) into has_trial;

  boundary_type := null;
  if to_regclass('public.geometry_columns') is not null then
    select gc.type into boundary_type
    from public.geometry_columns gc
    where gc.f_table_schema = 'public'
      and gc.f_table_name = 'metro_geofences'
      and gc.f_geometry_column = 'boundary';
  end if;

  center_expr := case center_type
    when 'geography' then 'ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography'
    when 'geometry' then 'ST_SetSRID(ST_MakePoint($2, $3), 4326)'
    else null
  end;

  boundary_expr := case
    when boundary_type is null then null
    when boundary_type ilike '%multi%' then 'ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 80000)::geometry)'
    else 'ST_Buffer(ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 80000)::geometry'
  end;

  select string_agg(c.column_name, ', ' order by c.column_name) into missing_required
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'metro_geofences'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and c.column_name <> name_col
    and not (c.column_name = 'center' and center_expr is not null)
    and not (c.column_name in ('radius', 'radius_meters') and radius_col is not null)
    and not (c.column_name = 'is_active' and has_active)
    and not (c.column_name = 'trial_days' and has_trial)
    and not (c.column_name = 'boundary' and boundary_expr is not null);

  if missing_required is not null then
    raise exception 'metro_geofences still needs a value for: %', missing_required;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'seed_metro_counts_trigger'
      and tgrelid = 'public.metro_geofences'::regclass
      and not tgisinternal
  ) then
    alter table public.metro_geofences disable trigger seed_metro_counts_trigger;
    trigger_on := true;
  end if;

  for metro, lng, lat in
    select *
    from (values
      ('Anchorage', -149.9003::double precision, 61.2181::double precision),
      ('Honolulu', -157.8583::double precision, 21.3069::double precision),
      ('San Juan', -66.1057::double precision, 18.4655::double precision),
      ('Mayagüez', -67.1396::double precision, 18.2013::double precision),
      ('Charlotte Amalie', -64.9307::double precision, 18.3419::double precision)
    ) as city(metro, lng, lat)
  loop
    found_row := null;

    execute format('select 1 from public.metro_geofences where %I = $1', name_col)
      into found_row
      using metro;

    if found_row is not null then
      set_sql := '';
      if center_expr is not null then
        set_sql := 'center = ' || center_expr;
      end if;
      if radius_col is not null then
        if set_sql <> '' then set_sql := set_sql || ', '; end if;
        set_sql := set_sql || format('%I = 80000', radius_col);
      end if;
      if has_active then
        if set_sql <> '' then set_sql := set_sql || ', '; end if;
        set_sql := set_sql || 'is_active = true';
      end if;
      if set_sql <> '' then
        execute format('update public.metro_geofences set %s where %I = $1', set_sql, name_col)
          using metro, lng, lat;
      end if;
    else
      insert_cols := format('%I', name_col);
      insert_vals := '$1';
      if center_expr is not null then
        insert_cols := insert_cols || ', center';
        insert_vals := insert_vals || ', ' || center_expr;
      end if;
      if radius_col is not null then
        insert_cols := insert_cols || format(', %I', radius_col);
        insert_vals := insert_vals || ', 80000';
      end if;
      if has_active then
        insert_cols := insert_cols || ', is_active';
        insert_vals := insert_vals || ', true';
      end if;
      if has_trial then
        insert_cols := insert_cols || ', trial_days';
        insert_vals := insert_vals || ', 90';
      end if;
      if boundary_expr is not null then
        insert_cols := insert_cols || ', boundary';
        insert_vals := insert_vals || ', ' || boundary_expr;
      end if;
      execute format(
        'insert into public.metro_geofences (%s) values (%s)',
        insert_cols,
        insert_vals
      ) using metro, lng, lat;
    end if;
  end loop;

  if trigger_on then
    alter table public.metro_geofences enable trigger seed_metro_counts_trigger;
    trigger_on := false;
  end if;

  if to_regclass('public.metro_area_counts') is not null then
    select c.column_name into count_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'metro_area_counts'
      and c.column_name in ('metro_name', 'name')
    order by case c.column_name when 'metro_name' then 0 else 1 end
    limit 1;

    if count_name is not null then
      for metro, lng, lat in
        select *
        from (values
          ('Anchorage', -149.9003::double precision, 61.2181::double precision),
          ('Honolulu', -157.8583::double precision, 21.3069::double precision),
          ('San Juan', -66.1057::double precision, 18.4655::double precision),
          ('Mayagüez', -67.1396::double precision, 18.2013::double precision),
          ('Charlotte Amalie', -64.9307::double precision, 18.3419::double precision)
        ) as city(metro, lng, lat)
      loop
        found_row := null;
        execute format('select 1 from public.metro_area_counts where %I = $1', count_name)
          into found_row
          using metro;
        if found_row is null then
          count_cols := format('%I, platemaker_count, platetaker_count', count_name);
          count_vals := '$1, 0, 0';
          if exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'metro_area_counts'
              and column_name = 'max_cap'
          ) then
            count_cols := count_cols || ', max_cap';
            count_vals := count_vals || ', 100';
          end if;
          execute format(
            'insert into public.metro_area_counts (%s) values (%s)',
            count_cols,
            count_vals
          ) using metro;
        end if;
      end loop;
    end if;
  end if;

  raise notice 'Seeded Anchorage, Honolulu, San Juan, Mayagüez, and Charlotte Amalie using metro_geofences.%', name_col;
exception
  when others then
    if trigger_on then
      alter table public.metro_geofences enable trigger seed_metro_counts_trigger;
    end if;
    raise;
end $$;
