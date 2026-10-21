-- Shared lane listings, FoodReview clips, and promotion prices on orders.
-- Paste this into the Supabase SQL editor and run it once.
-- Inserts use the service role, which bypasses row level security.
-- The price trigger still ignores a client-sent total. It writes the menu
-- line, then applies one active promotional_offers row when that table exists.
-- A later status change does not reprice the order.

create table if not exists public.lane_listings (
  id text primary key,
  lane text not null check (lane in ('farm', 'meal_prep', 'food_truck', 'catering', 'sit_down')),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.lane_listings enable row level security;

drop policy if exists "select_lane_listings" on public.lane_listings;
create policy "select_lane_listings" on public.lane_listings for select using (true);

create table if not exists public.food_review_clips (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_name text not null,
  author text not null,
  role text not null check (role in ('platemaker', 'platetaker')),
  video_url text not null,
  poster_url text,
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 20),
  created_at timestamptz default now()
);

alter table public.food_review_clips enable row level security;

drop policy if exists "select_food_review_clips" on public.food_review_clips;
create policy "select_food_review_clips" on public.food_review_clips for select using (true);

do $$
declare
  has_total boolean;
  has_cents boolean;
  assign_price text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total_price'
  ) into has_total;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total_price_cents'
  ) into has_cents;

  if has_total and has_cents then
    assign_price := 'new.total_price := charged; new.total_price_cents := round(charged * 100);';
  elsif has_total then
    assign_price := 'new.total_price := charged;';
  elsif has_cents then
    assign_price := 'new.total_price_cents := round(charged * 100);';
  else
    raise exception 'orders has neither total_price nor total_price_cents';
  end if;

  execute format($fn$
    create or replace function public.calculate_order_price()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      meal_price numeric(10,2);
      menu_total numeric(10,2);
      charged numeric(10,2);
      offer_type text;
      discount_percentage numeric;
      discount_amount numeric;
      buy_quantity integer;
      get_quantity integer;
      bundle integer;
      free_units integer;
    begin
      if tg_op = 'UPDATE'
         and new.meal_id is not distinct from old.meal_id
         and new.quantity is not distinct from old.quantity
      then
        return new;
      end if;

      select price into meal_price
      from public.meals
      where id = new.meal_id and available = true and published = true;

      if meal_price is null then
        raise exception 'Meal not found or not available';
      end if;

      if new.quantity is null or new.quantity <= 0 then
        raise exception 'Quantity must be greater than 0';
      end if;

      if new.quantity > 999 then
        raise exception 'Quantity exceeds maximum allowed (999)';
      end if;

      menu_total := round(meal_price * new.quantity::numeric, 2);
      charged := menu_total;

      if to_regclass('public.promotional_offers') is not null then
        select o.type, o.discount_percentage, o.discount_amount, o.buy_quantity, o.get_quantity
          into offer_type, discount_percentage, discount_amount, buy_quantity, get_quantity
        from public.promotional_offers o
        where o.meal_id = new.meal_id
          and o.is_active is not false
          and o.start_date <= now()
          and o.end_date >= now()
        order by o.start_date desc, o.id desc
        limit 1;

        if offer_type = 'percentage'
           and discount_percentage > 0
           and discount_percentage <= 100
        then
          charged := round(menu_total * (1 - discount_percentage / 100), 2);
        elsif offer_type = 'fixed-amount'
           and discount_amount > 0
        then
          charged := round(greatest(0, menu_total - discount_amount), 2);
        elsif offer_type = 'buy-x-get-y'
           and buy_quantity >= 1
           and get_quantity >= 1
        then
          bundle := buy_quantity + get_quantity;
          free_units := (new.quantity / bundle) * get_quantity;
          charged := round(meal_price * greatest(0, new.quantity - free_units)::numeric, 2);
        end if;
      end if;

      %s
      return new;
    end;
    $body$;
  $fn$, assign_price);
end $$;

drop trigger if exists calculate_order_price_trigger on public.orders;

create trigger calculate_order_price_trigger
  before insert or update on public.orders
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.calculate_order_price();

notify pgrst, 'reload schema';
