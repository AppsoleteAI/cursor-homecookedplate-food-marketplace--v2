-- Composite and partial indexes for the queries the app already runs.
-- This file does not run from the Worker. Paste it into the Supabase SQL editor.
-- Existing single-column indexes are left as they are.

-- Public menu: published and available plates, newest first.
-- A PlateTaker home, search, filter, and funnel read this set.
create index if not exists idx_meals_menu_created
  on public.meals (created_at desc)
  where published = true and available = true;

-- The same menu filtered by cuisine.
create index if not exists idx_meals_menu_cuisine
  on public.meals (cuisine, created_at desc)
  where published = true and available = true;

-- The same menu filtered by category.
create index if not exists idx_meals_menu_category
  on public.meals (category, created_at desc)
  where published = true and available = true;

-- A signed-in PlateMaker's own published plates.
create index if not exists idx_meals_cook_menu
  on public.meals (user_id, created_at desc)
  where published = true and available = true;

-- Reviews on one plate, newest first. Both roles open this from the plate page.
create index if not exists idx_reviews_meal_created
  on public.reviews (meal_id, created_at desc);

-- Reviews written by one account, newest first.
create index if not exists idx_reviews_author_created
  on public.reviews (author_id, created_at desc);

-- The bell: one person's notices, newest first. Both roles use this list.
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- Active plate offers joined from the menu. Skipped when the table is absent.
do $$
begin
  if to_regclass('public.promotional_offers') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'promotional_offers'
         and column_name = 'is_active'
     ) then
    execute $index$
      create index if not exists idx_promotional_offers_active_meal
        on public.promotional_offers (meal_id)
        where is_active = true
    $index$;
  end if;
end $$;

-- Comments waiting for review. Skipped when comment_status is absent.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reviews'
      and column_name = 'comment_status'
  ) then
    execute $index$
      create index if not exists idx_reviews_pending
        on public.reviews (created_at desc)
        where comment_status = 'pending'
    $index$;
  end if;
end $$;

-- Order lists. The live table may use buyer_id and seller_id, or platetaker_id and platemaker_id.
do $$
declare
  buyer_column text;
  cook_column text;
  has_paid boolean;
begin
  if to_regclass('public.orders') is null then
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'buyer_id'
  ) then
    buyer_column := 'buyer_id';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'platetaker_id'
  ) then
    buyer_column := 'platetaker_id';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'seller_id'
  ) then
    cook_column := 'seller_id';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'platemaker_id'
  ) then
    cook_column := 'platemaker_id';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'paid'
  ) into has_paid;

  if buyer_column is not null then
    execute format(
      'create index if not exists idx_orders_buyer_created on public.orders (%I, created_at desc)',
      buyer_column
    );
  end if;

  if cook_column is not null and has_paid then
    execute format(
      'create index if not exists idx_orders_cook_paid_created on public.orders (%I, created_at) where paid = true',
      cook_column
    );
  elsif cook_column is not null then
    execute format(
      'create index if not exists idx_orders_cook_created on public.orders (%I, created_at)',
      cook_column
    );
  end if;
end $$;
