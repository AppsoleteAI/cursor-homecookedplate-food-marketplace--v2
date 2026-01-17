-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) ON DELETE CASCADE primary key,
  username text unique not null,
  email text unique not null,
  role text not null check (role in ('platemaker', 'platetaker')),
  is_admin boolean default false,
  phone text,
  bio text,
  profile_image text,
  business_name text,
  location text,
  specialties text[],
  verified boolean default false,
  is_paused boolean default false,
  two_factor_enabled boolean default false,
  stripe_account_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Meals table
create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text not null,
  price numeric(10,2) not null check (price >= 0),
  images text[] default '{}',
  ingredients text[] default '{}',
  cuisine text not null,
  category text not null check (category in ('breakfast', 'lunch', 'dinner', 'dessert', 'snack')),
  dietary_options text[] default '{}',
  preparation_time integer not null check (preparation_time > 0),
  available boolean default true,
  published boolean default true,
  rating numeric(3,2) default 0 check (rating >= 0 and rating <= 5),
  review_count integer default 0,
  featured boolean default false,
  tags text[] default '{}',
  expiry_date timestamptz,
  receipt_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Orders table
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid references public.meals(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  status text not null check (status in ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')) default 'pending',
  quantity integer not null check (quantity > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  paid boolean default false,
  payment_intent_id text,
  special_instructions text,
  cooking_temperature text,
  allergies text[] default '{}',
  delivery_address text,
  pickup_time timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reviews table
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid references public.meals(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(meal_id, author_id)
);

-- Order messages table
create table if not exists public.order_messages (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  sender_role text not null check (sender_role in ('platemaker', 'platetaker')),
  text text not null,
  created_at timestamptz default now()
);

-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  type text not null,
  reference_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

-- Media attachments table
create table if not exists public.media_attachments (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid references public.meals(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  uri text not null,
  type text not null check (type in ('image', 'video')),
  storage_path text not null,
  created_at timestamptz default now()
);

-- Promotional offers table
create table if not exists public.promotional_offers (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid references public.meals(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('percentage', 'buy-x-get-y', 'fixed-amount', 'free-item')),
  title text not null,
  description text not null,
  discount_percentage numeric(5,2),
  discount_amount numeric(10,2),
  buy_quantity integer,
  get_quantity integer,
  free_item_name text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Favorites table
create table if not exists public.favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  meal_id uuid references public.meals(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, meal_id)
);

-- Create indexes for better query performance
create index if not exists idx_meals_user_id on public.meals(user_id);
create index if not exists idx_meals_cuisine on public.meals(cuisine);
create index if not exists idx_meals_category on public.meals(category);
create index if not exists idx_meals_available on public.meals(available);
create index if not exists idx_meals_featured on public.meals(featured);
create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at);
create index if not exists idx_reviews_meal_id on public.reviews(meal_id);
create index if not exists idx_reviews_author_id on public.reviews(author_id);
create index if not exists idx_order_messages_order_id on public.order_messages(order_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);
create index if not exists idx_media_attachments_meal_id on public.media_attachments(meal_id);
create index if not exists idx_favorites_user_id on public.favorites(user_id);

-- Create updated_at triggers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at_meals
  before update on public.meals
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at_orders
  before update on public.orders
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at_reviews
  before update on public.reviews
  for each row
  execute function public.handle_updated_at();

-- Create function to update meal rating
create or replace function public.update_meal_rating()
returns trigger as $$
begin
  update public.meals
  set 
    rating = (select avg(rating)::numeric(3,2) from public.reviews where meal_id = new.meal_id),
    review_count = (select count(*) from public.reviews where meal_id = new.meal_id)
  where id = new.meal_id;
  return new;
end;
$$ language plpgsql;

create trigger update_meal_rating_on_review
  after insert or update or delete on public.reviews
  for each row
  execute function public.update_meal_rating();
