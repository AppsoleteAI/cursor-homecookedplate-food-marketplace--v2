-- Prove the Supabase webhook sends x-metro-webhook-secret.
-- Run this whole script once in the Supabase SQL editor. Do not highlight one line.
--
-- metro_area_counts.metro_name must already exist in metro_geofences.
-- A made-up city name cannot be inserted. This uses the quietest real city
-- where both counts are still under max_cap, raises both counts to the cap,
-- then puts the original counts back before commit.
--
-- 1. max_cap = max_cap. Worker answer: Count not at cap. No admin alert.
-- 2. platemaker_count first hits max_cap. One PlateMaker alert.
-- 3. platetaker_count first hits max_cap. One PlateTaker alert.
-- 4. Both counts return to the saved values. Worker answer: Count not at cap.
--
-- The committed city counts do not change. PlateMaker and PlateTaker phones do not change.
-- Public triggers on metro_area_counts are off only inside this transaction.
-- The Supabase HTTP webhook stays on.

set statement_timeout = '60s';

drop table if exists webhook_check_start;
create temp table webhook_check_start (started_at timestamptz);
insert into webhook_check_start values (clock_timestamp());

drop table if exists webhook_check_target;
create temp table webhook_check_target (
  metro_name text,
  platemaker_count integer,
  platetaker_count integer,
  max_cap integer
);

drop table if exists webhook_check_listeners;
create temp table webhook_check_listeners (tgname text, func text);

insert into webhook_check_listeners (tgname, func)
select tg.tgname, pn.nspname || '.' || p.proname
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = tg.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where n.nspname = 'public'
  and c.relname = 'metro_area_counts'
  and not tg.tgisinternal
  and pn.nspname <> 'public';

do $$
declare
  r record;
  trig text;
  disabled text[] := '{}';
  target text;
  old_maker integer;
  old_taker integer;
  old_max integer;
  old_updated timestamptz;
  has_updated boolean;
  now_maker integer;
  now_taker integer;
  now_max integer;
begin
  if to_regclass('public.metro_area_counts') is null then
    raise exception 'metro_area_counts is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_area_counts' and column_name = 'metro_name'
  ) then
    raise exception 'metro_area_counts.metro_name is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_area_counts' and column_name = 'platemaker_count'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_area_counts' and column_name = 'platetaker_count'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_area_counts' and column_name = 'max_cap'
  ) then
    raise exception 'metro_area_counts is missing platemaker_count, platetaker_count, or max_cap';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'metro_area_counts' and column_name = 'updated_at'
  ) into has_updated;

  for r in
    select tg.tgname
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = tg.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where n.nspname = 'public'
      and c.relname = 'metro_area_counts'
      and not tg.tgisinternal
      and pn.nspname = 'public'
      and p.proname is distinct from 'http_request'
      and tg.tgname is distinct from 'metro_area_counts'
  loop
    execute format('alter table public.metro_area_counts disable trigger %I', r.tgname);
    disabled := disabled || r.tgname;
  end loop;

  begin
    if has_updated then
      select metro_name, platemaker_count, platetaker_count, max_cap, updated_at
      into target, old_maker, old_taker, old_max, old_updated
      from public.metro_area_counts
      where platemaker_count < max_cap
        and platetaker_count < max_cap
      order by platemaker_count + platetaker_count, metro_name
      limit 1
      for update;
    else
      select metro_name, platemaker_count, platetaker_count, max_cap
      into target, old_maker, old_taker, old_max
      from public.metro_area_counts
      where platemaker_count < max_cap
        and platetaker_count < max_cap
      order by platemaker_count + platetaker_count, metro_name
      limit 1
      for update;
    end if;

    if target is null then
      raise exception 'No metro is under max_cap for both roles';
    end if;

    insert into webhook_check_target (metro_name, platemaker_count, platetaker_count, max_cap)
    values (target, old_maker, old_taker, old_max);

    update public.metro_area_counts
    set max_cap = max_cap
    where metro_name = target;

    update public.metro_area_counts
    set platemaker_count = max_cap
    where metro_name = target
      and platemaker_count < max_cap;

    update public.metro_area_counts
    set platetaker_count = max_cap
    where metro_name = target
      and platetaker_count < max_cap;

    if has_updated then
      update public.metro_area_counts
      set platemaker_count = old_maker,
          platetaker_count = old_taker,
          max_cap = old_max,
          updated_at = old_updated
      where metro_name = target;
    else
      update public.metro_area_counts
      set platemaker_count = old_maker,
          platetaker_count = old_taker,
          max_cap = old_max
      where metro_name = target;
    end if;

    select platemaker_count, platetaker_count, max_cap
    into now_maker, now_taker, now_max
    from public.metro_area_counts
    where metro_name = target;

    if now_maker is distinct from old_maker
       or now_taker is distinct from old_taker
       or now_max is distinct from old_max then
      raise exception 'City counts were not restored';
    end if;
  exception
    when others then
      foreach trig in array disabled loop
        execute format('alter table public.metro_area_counts enable trigger %I', trig);
      end loop;
      raise;
  end;

  foreach trig in array disabled loop
    execute format('alter table public.metro_area_counts enable trigger %I', trig);
  end loop;
end $$;

commit;

select pg_sleep(8);

with started as (
  select started_at from webhook_check_start
),
target as (
  select metro_name, platemaker_count, platetaker_count, max_cap
  from webhook_check_target
),
http_rows as (
  select r.status_code::text as status,
         coalesce(r.content::text, r.error_msg) as detail,
         r.created
  from net._http_response r
  cross join started s
  where r.created >= s.started_at
    and (
      coalesce(r.content::text, '') like '%Count not at cap%'
      or coalesce(r.content::text, '') like '%Metro cap notification processed%'
      or coalesce(r.content::text, '') like '%Unauthorized%'
      or coalesce(r.content::text, '') like '%Server configuration error%'
    )
),
removed_alerts as (
  delete from public.admin_system_alerts a
  using started s, target t
  where a.created_at >= s.started_at
    and a.metadata->>'metro_name' = t.metro_name
    and (
      a.metadata->>'platemaker_hit_cap' = 'true'
      or a.metadata->>'platetaker_hit_cap' = 'true'
    )
  returning
    a.message,
    coalesce(a.metadata->>'platemaker_hit_cap', '') as maker_hit,
    coalesce(a.metadata->>'platetaker_hit_cap', '') as taker_hit,
    a.created_at
),
removed_notes as (
  delete from public.notifications n
  using started s, target t
  where n.created_at >= s.started_at
    and n.type = 'metro_cap_reached'
    and strpos(n.body, t.metro_name) > 0
  returning n.id
)
select kind, status, detail, created
from (
  select '0-listener' as kind, count(*)::text as status, 'non-public triggers left on' as detail, clock_timestamp() as created
  from webhook_check_listeners
  union all
  select '0-listener', '', tgname || ' ' || func, clock_timestamp()
  from webhook_check_listeners
  union all
  select '1-http', status, detail, created from http_rows
  union all
  select '2-alert', maker_hit || '/' || taker_hit, message, created_at from removed_alerts
  union all
  select '3-notes-removed', count(*)::text, 'in-app notifications removed', clock_timestamp() from removed_notes
  union all
  select '4-restored',
         c.platemaker_count::text || '/' || c.platetaker_count::text || '/' || c.max_cap::text,
         t.metro_name,
         clock_timestamp()
  from target t
  join public.metro_area_counts c on c.metro_name = t.metro_name
  where c.platemaker_count = t.platemaker_count
    and c.platetaker_count = t.platetaker_count
    and c.max_cap = t.max_cap
) q
order by kind, created;
