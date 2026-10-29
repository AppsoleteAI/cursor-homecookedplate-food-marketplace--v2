-- Moderator queue. Run this in the Supabase SQL editor before the new
-- message, note, comment, and clip-report holds are used.
-- Existing rows stay visible. New rows wait for an admin.

alter table public.order_messages
  add column if not exists moderation_status text not null default 'allowed';

alter table public.order_messages
  add column if not exists security_checked boolean not null default false;

alter table public.order_messages
  alter column moderation_status set default 'pending';

alter table public.order_messages
  drop constraint if exists order_messages_moderation_status_check;

alter table public.order_messages
  add constraint order_messages_moderation_status_check
  check (moderation_status in ('pending', 'allowed', 'removed'));

alter table public.orders
  add column if not exists instructions_status text;

alter table public.orders
  drop constraint if exists orders_instructions_status_check;

alter table public.orders
  add constraint orders_instructions_status_check
  check (instructions_status is null or instructions_status in ('pending', 'allowed', 'removed'));

alter table public.reviews
  add column if not exists comment_status text;

alter table public.reviews
  drop constraint if exists reviews_comment_status_check;

alter table public.reviews
  add constraint reviews_comment_status_check
  check (comment_status is null or comment_status in ('pending', 'allowed', 'removed'));

alter table public.food_review_clips
  add column if not exists hidden boolean not null default false;

create table if not exists public.content_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('order_message', 'clip', 'order')),
  target_id text not null,
  status text not null default 'pending' check (status in ('pending', 'allowed', 'removed')),
  created_at timestamptz default now()
);

alter table public.content_reports enable row level security;

create index if not exists idx_content_reports_status on public.content_reports(status, created_at desc);

-- A signed-in insert cannot mark its own message allowed.
create or replace function public.order_messages_hold_new()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.moderation_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists order_messages_hold_new on public.order_messages;
create trigger order_messages_hold_new
  before insert on public.order_messages
  for each row
  execute function public.order_messages_hold_new();

-- Live orders use platetaker_id / platemaker_id.
-- The repo schema uses buyer_id / seller_id.
do $$
declare
  buyer_column text;
  cook_column text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'buyer_id'
  ) then
    buyer_column := 'buyer_id';
  else
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
  else
    raise exception 'orders has no cook column';
  end if;

  execute 'drop policy if exists "select_order_messages" on public.order_messages';
  execute format($policy$
    create policy "select_order_messages" on public.order_messages
    for select using (
      exists (
        select 1 from public.orders o
        where o.id = order_messages.order_id
          and (o.%I = auth.uid() or o.%I = auth.uid())
      )
      and (
        order_messages.moderation_status = 'allowed'
        or order_messages.sender_id = auth.uid()
      )
    )
  $policy$, buyer_column, cook_column);
end $$;
