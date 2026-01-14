-- ============================================================================
-- SECURITY ENHANCEMENTS FOR PRODUCTION (REVISED)
-- ============================================================================
-- This script addresses critical security vulnerabilities:
-- 1. Server-side price calculation (prevents "Free Meal" vulnerability)
-- 2. Admin bypass in RLS policies
-- 3. Secure profile updates (prevents is_admin escalation)
-- 4. Search path security
-- 5. Quantity overflow protection
-- ============================================================================

-- NOTE: Ensure required extensions exist (run as superuser if needed).
-- Optional: use gen_random_uuid() (pgcrypto) or uuid_generate_v4() (uuid-ossp)
-- create extension if not exists pgcrypto;
-- OR
-- create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. SECURE PROFILE CREATION WITH SEARCH PATH
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
as $$
begin
  insert into public.profiles (id, username, email, role, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    -- Respect portal choice from metadata, default to platetaker
    coalesce(new.raw_user_meta_data->>'role', 'platetaker'),
    -- FORCE is_admin to false - admins must be promoted through secure backend process
    false
  );
  return new;
exception
  when unique_violation then
    -- Keep message generic in production; consider logging details to audit_logs instead
    raise exception 'Username or email already exists';
  when others then
    raise exception 'Failed to create profile: %', sqlerrm;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================================
-- 2. AUTOMATIC ORDER PRICE CALCULATION (CRITICAL SECURITY FIX)
--    Now handles INSERT and UPDATE (recalculate on new meal_id or quantity)
-- ============================================================================

create or replace function public.calculate_order_price()
returns trigger
as $$
declare
  meal_price numeric(10,2);
  calculated_total numeric(10,2);
begin
  -- Fetch the actual meal price from the meals table
  select price into meal_price
  from public.meals
  where id = new.meal_id and available = true and published = true;

  -- If meal not found or not available, reject the order
  if meal_price is null then
    raise exception 'Meal not found or not available';
  end if;

  -- Enforce reasonable quantity limits (prevent integer overflow)
  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  if new.quantity > 999 then
    raise exception 'Quantity exceeds maximum allowed (999)';
  end if;

  -- Calculate the correct total price
  calculated_total := round(meal_price * new.quantity::numeric, 2);

  -- OVERRIDE whatever the client sent with the server-calculated price
  new.total_price := calculated_total;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Drop existing trigger if it exists
drop trigger if exists calculate_order_price_trigger on public.orders;

-- Create trigger to calculate price BEFORE insert or update
create trigger calculate_order_price_trigger
  before insert or update on public.orders
  for each row
  when (pg_trigger_depth() = 0) -- avoid re-entrancy where supported
  execute function public.calculate_order_price();

-- ============================================================================
-- 3. SECURE PROFILE UPDATES (PREVENT is_admin ESCALATION)
-- ============================================================================

drop policy if exists "update_own_profile" on public.profiles;

create policy "update_own_profile" on public.profiles 
for update 
using (id = auth.uid()) 
with check (
  id = auth.uid()
  -- Ensure is_admin cannot be changed by the user themselves:
  -- compare submitted is_admin against the current value in the table
  and is_admin = (select is_admin from public.profiles where id = auth.uid())
);

-- Optionally: if you prefer consistency with helper function, you can replace the subquery above
-- with "and (public.is_admin() = true OR is_admin = false)" depending on your rules.

-- ============================================================================
-- 4. ADMIN BYPASS HELPER AND PERMISSIONS
-- ============================================================================

create or replace function public.is_admin()
returns boolean
as $$
begin
  return coalesce((select is_admin from public.profiles where id = auth.uid()), false);
end;
$$ language plpgsql security definer stable set search_path = public;

-- Revoke execute from public roles so only trusted code can call it.
revoke execute on function public.is_admin() from anon, authenticated;

-- ============================================================================
-- UPDATE MEALS POLICIES WITH ADMIN BYPASS
-- ============================================================================

drop policy if exists "update_meal_owner" on public.meals;
drop policy if exists "delete_meal_owner" on public.meals;
drop policy if exists "update_meal_owner_or_admin" on public.meals;
drop policy if exists "delete_meal_owner_or_admin" on public.meals;

create policy "update_meal_owner_or_admin" on public.meals 
for update 
using (
  user_id = auth.uid() 
  or public.is_admin() = true
)
with check (
  user_id = auth.uid() 
  or public.is_admin() = true
);

create policy "delete_meal_owner_or_admin" on public.meals 
for delete 
using (
  user_id = auth.uid() 
  or public.is_admin() = true
);

-- ============================================================================
-- UPDATE ORDERS POLICIES WITH ADMIN BYPASS
-- ============================================================================

drop policy if exists "select_orders_buyer_or_seller" on public.orders;
drop policy if exists "update_order_buyer_or_seller" on public.orders;
drop policy if exists "delete_order_buyer_or_seller" on public.orders;
drop policy if exists "select_orders_buyer_or_seller_or_admin" on public.orders;
drop policy if exists "update_order_buyer_or_seller_or_admin" on public.orders;
drop policy if exists "delete_order_admin_only" on public.orders;

create policy "select_orders_buyer_or_seller_or_admin" on public.orders 
for select 
using (
  buyer_id = auth.uid() 
  or seller_id = auth.uid()
  or public.is_admin() = true
);

create policy "update_order_buyer_or_seller_or_admin" on public.orders 
for update 
using (
  buyer_id = auth.uid() 
  or seller_id = auth.uid()
  or public.is_admin() = true
)
with check (
  buyer_id = auth.uid() 
  or seller_id = auth.uid()
  or public.is_admin() = true
);

create policy "delete_order_admin_only" on public.orders 
for delete 
using (
  public.is_admin() = true
);

-- ============================================================================
-- UPDATE REVIEWS POLICIES WITH ADMIN BYPASS
-- ============================================================================

drop policy if exists "update_own_review" on public.reviews;
drop policy if exists "delete_own_review" on public.reviews;
drop policy if exists "update_own_review_or_admin" on public.reviews;
drop policy if exists "delete_own_review_or_admin" on public.reviews;

create policy "update_own_review_or_admin" on public.reviews 
for update 
using (
  author_id = auth.uid()
  or public.is_admin() = true
)
with check (
  author_id = auth.uid()
  or public.is_admin() = true
);

create policy "delete_own_review_or_admin" on public.reviews 
for delete 
using (
  author_id = auth.uid()
  or public.is_admin() = true
);

-- ============================================================================
-- 5. PREVENT GHOST REVIEWS (LINK REVIEWS TO SPECIFIC ORDERS)
-- ============================================================================

alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete cascade;

create index if not exists idx_reviews_order_id on public.reviews(order_id);

drop policy if exists "insert_review_after_purchase" on public.reviews;

create policy "insert_review_after_purchase" on public.reviews 
for insert 
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.meal_id = meal_id
      and o.buyer_id = auth.uid()
      and o.status = 'completed'
  )
  -- Prevent multiple reviews for the same order
  and not exists (
    select 1 from public.reviews r
    where r.order_id = order_id
  )
);

-- ============================================================================
-- 6. MEDIA ATTACHMENTS CLEANUP (PREVENT ORPHANS)
--    Function and trigger to log deleted media for backend cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_deleted_media()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into audit_logs so backend can process storage cleanup later
  INSERT INTO public.audit_logs (action, table_name, record_id, old_data)
  VALUES (
    'DELETE_MEDIA_PENDING',
    'meals',
    OLD.id,
    jsonb_build_object(
      'meal_id', OLD.id,
      'images', OLD.images,
      'user_id', OLD.user_id
    )
  );
  RETURN OLD;
END;
$$;

-- Create trigger to log when meals with media are deleted
drop trigger if exists log_media_cleanup on public.meals;
create trigger log_media_cleanup
  before delete on public.meals
  for each row
  execute function public.log_deleted_media();

-- ============================================================================
-- 7. ADD CONSTRAINTS TO PREVENT ABUSE
-- ============================================================================

alter table public.meals 
  drop constraint if exists meals_price_check,
  add constraint meals_price_check check (price >= 0 and price <= 999999.99);

alter table public.orders 
  drop constraint if exists orders_quantity_check,
  add constraint orders_quantity_check check (quantity > 0 and quantity <= 999);

alter table public.orders 
  drop constraint if exists orders_total_price_check,
  add constraint orders_total_price_check check (total_price >= 0 and total_price <= 999999999.99);

-- ============================================================================
-- 8. AUDIT LOG TABLE (OPTIONAL BUT RECOMMENDED)
-- ============================================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), -- pgcrypto preferred. Replace if using uuid-ossp
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- RLS for audit logs (only admins can read). Inserts should be done by service_role or security-definer functions.
alter table public.audit_logs enable row level security;

drop policy if exists "select_audit_logs_admin_only" on public.audit_logs;
create policy "select_audit_logs_admin_only" on public.audit_logs 
for select 
using (public.is_admin() = true);

-- Optionally create an insert policy if you need non-service-role inserts (generally avoid permitting anon/authenticated inserts)
-- Example: allow security-definer functions to insert by using a helper role or only the service_role.

create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
create index if not exists idx_audit_logs_table_name on public.audit_logs(table_name);

-- ============================================================================
-- 9. FUNCTION TO PROMOTE USER TO ADMIN (BACKEND ONLY)
--    Restricted usage: should be called only from backend with service role key.
-- ============================================================================

create or replace function public.promote_to_admin(target_user_id uuid)
returns void
security definer
as $$
begin
  -- Set admin flag
  update public.profiles
  set is_admin = true
  where id = target_user_id;

  -- Log the action. If called by an admin user, log who promoted; if called via service role, auth.uid() may be null.
  insert into public.audit_logs (user_id, action, table_name, record_id, new_data)
  values (target_user_id, 'PROMOTED_TO_ADMIN', 'profiles', target_user_id, jsonb_build_object('promoted_by', auth.uid()));
end;
$$ language plpgsql set search_path = public;

-- IMPORTANT: ensure only trusted callers can execute this function (service_role or a protected admin-only API).
-- Example: revoke execute from public roles:
revoke execute on function public.promote_to_admin(uuid) from anon, authenticated;

-- ============================================================================
-- SECURITY ENHANCEMENTS COMPLETE
-- ============================================================================

-- Suggested verification query (run as needed):
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
