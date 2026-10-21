-- Shared lane listings and FoodReviewClips.
-- Apply in the Supabase SQL editor. The app keeps a phone copy if these tables are missing.

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
