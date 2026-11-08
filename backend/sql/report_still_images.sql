-- Lets a signed-in PlateMaker or PlateTaker report a food photo or a profile photo.
-- The photo stays hidden until an admin allows it. Remove leaves it hidden.
-- Run this once in the Supabase SQL editor. Success with no rows is expected.

alter table public.meals
  add column if not exists hidden_images text[] not null default '{}';

alter table public.profiles
  add column if not exists profile_image_hidden boolean not null default false;

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;

alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in ('order_message', 'clip', 'order', 'meal_image', 'profile_image'));
