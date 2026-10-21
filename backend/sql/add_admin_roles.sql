-- Main admin and monitor admin checkboxes on profiles.
-- Check one box on a person's row in the table editor.
-- main_admin sees money, payouts, and account details, and can add or remove admins.
-- monitor_admin can review plate images and edit screen names and plate text.
-- A row cannot have both boxes checked.
-- Run this in the Supabase SQL editor.

alter table public.profiles
  add column if not exists main_admin boolean not null default false,
  add column if not exists monitor_admin boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_admin_role_exclusive;

alter table public.profiles
  add constraint profiles_admin_role_exclusive
  check (not (main_admin and monitor_admin));

comment on column public.profiles.main_admin is
  'Checked for the main admin. Full admin portal, including money and personal account details.';

comment on column public.profiles.monitor_admin is
  'Checked for a monitor admin. Images, screen names, and plate text only.';

create or replace function public.sync_admin_checkboxes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and auth.role() = 'authenticated'
     and (
       new.main_admin is distinct from old.main_admin
       or new.monitor_admin is distinct from old.monitor_admin
       or new.is_admin is distinct from old.is_admin
     ) then
    raise exception 'Admin access cannot be changed from this account';
  end if;

  new.is_admin := coalesce(new.main_admin, false) or coalesce(new.monitor_admin, false);
  return new;
end;
$$;

drop trigger if exists profiles_sync_admin_checkboxes on public.profiles;

create trigger profiles_sync_admin_checkboxes
before insert or update on public.profiles
for each row
execute function public.sync_admin_checkboxes();

-- Accounts that were already admins become the main admin.
update public.profiles
set main_admin = true,
    monitor_admin = false
where is_admin = true
  and main_admin = false
  and monitor_admin = false;

-- First main admin. Replace the email, then run this statement.
update public.profiles
set main_admin = true,
    monitor_admin = false
where email = 'REPLACE_WITH_MAIN_ADMIN_EMAIL';
