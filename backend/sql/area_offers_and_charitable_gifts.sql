-- Area discounts and the charitable gift register.
-- A gift is not a Stripe charge. The row stores the cook's ingredient and packaging cost.

create table if not exists public.area_offers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area text not null check (area in ('farm', 'meal_prep', 'food_truck', 'catering', 'sit_down')),
  listing_id text not null check (char_length(listing_id) between 1 and 80),
  type text not null check (type in ('percentage', 'buy-x-get-y', 'fixed-amount', 'free-item')),
  title text not null,
  description text not null,
  discount_percentage numeric(5,2) check (discount_percentage is null or (discount_percentage >= 1 and discount_percentage <= 50)),
  discount_amount numeric(10,2) check (discount_amount is null or (discount_amount > 0 and discount_amount <= 100)),
  buy_quantity integer,
  get_quantity integer,
  free_item_name text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_area_offers_listing on public.area_offers (area, listing_id, user_id);

create table if not exists public.charitable_gifts (
  id uuid primary key default uuid_generate_v4(),
  cook_id uuid not null references public.profiles(id) on delete cascade,
  area text not null check (area in ('home', 'farm', 'meal_prep', 'food_truck', 'catering', 'sit_down')),
  item_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 500),
  quantity_claimed integer not null default 0 check (quantity_claimed >= 0 and quantity_claimed <= quantity),
  recipient text not null check (recipient in ('unhoused', 'elders', 'children')),
  produced_on date not null,
  ingredient_cost numeric(10,2) not null check (ingredient_cost >= 0 and ingredient_cost <= 10000),
  packaging_cost numeric(10,2) not null check (packaging_cost >= 0 and packaging_cost <= 10000),
  created_at timestamptz default now()
);

create table if not exists public.charitable_claims (
  id uuid primary key default uuid_generate_v4(),
  gift_id uuid not null references public.charitable_gifts(id) on delete cascade,
  claimer_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  claimed_at timestamptz default now()
);

alter table public.area_offers enable row level security;
alter table public.charitable_gifts enable row level security;
alter table public.charitable_claims enable row level security;

drop policy if exists "select_area_offers" on public.area_offers;
create policy "select_area_offers" on public.area_offers for select using (true);

drop policy if exists "write_own_area_offers" on public.area_offers;
create policy "write_own_area_offers" on public.area_offers for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "select_charitable_gifts" on public.charitable_gifts;
create policy "select_charitable_gifts" on public.charitable_gifts for select
  using (cook_id = auth.uid());

drop policy if exists "write_own_charitable_gifts" on public.charitable_gifts;
create policy "write_own_charitable_gifts" on public.charitable_gifts for all
  using (cook_id = auth.uid())
  with check (cook_id = auth.uid());

drop policy if exists "select_charitable_claims" on public.charitable_claims;
create policy "select_charitable_claims" on public.charitable_claims for select
  using (claimer_id = auth.uid());

drop policy if exists "insert_own_charitable_claims" on public.charitable_claims;
create policy "insert_own_charitable_claims" on public.charitable_claims for insert
  with check (claimer_id = auth.uid());

-- Home-plate offers: 1 to 50 percent, or at most $100 off. Zero is refused.
create or replace function public.calculate_order_price()
returns trigger
as $$
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
       and discount_percentage <= 50
    then
      charged := round(menu_total * (1 - discount_percentage / 100), 2);
    elsif offer_type = 'fixed-amount'
       and discount_amount > 0
       and discount_amount <= 100
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

  if charged is null or charged <= 0 then
    raise exception 'This offer takes the price to zero. Use a smaller discount.';
  end if;

  new.total_price := charged;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
