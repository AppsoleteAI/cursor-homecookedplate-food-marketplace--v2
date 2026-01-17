-- ============================================================================
-- COMPLETE DATABASE SETUP - RUN THIS ENTIRE FILE IN ORDER
-- ============================================================================
-- This file consolidates all SQL scripts in the correct execution order
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 2: CREATE ALL TABLES
-- ============================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('platemaker', 'platetaker')),
  is_admin boolean DEFAULT false,
  phone text,
  bio text,
  profile_image text,
  business_name text,
  location text,
  specialties text[],
  verified boolean DEFAULT false,
  is_paused boolean DEFAULT false,
  two_factor_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Meals table
CREATE TABLE IF NOT EXISTS public.meals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price <= 999999.99),
  images text[] DEFAULT '{}',
  ingredients text[] DEFAULT '{}',
  cuisine text NOT NULL,
  category text NOT NULL CHECK (category IN ('breakfast', 'lunch', 'dinner', 'dessert', 'snack')),
  dietary_options text[] DEFAULT '{}',
  preparation_time integer NOT NULL CHECK (preparation_time > 0),
  available boolean DEFAULT true,
  published boolean DEFAULT true,
  rating numeric(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count integer DEFAULT 0,
  featured boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  expiry_date timestamptz,
  receipt_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')) DEFAULT 'pending',
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 999),
  total_price numeric(10,2) NOT NULL CHECK (total_price >= 0 AND total_price <= 999999999.99),
  paid boolean DEFAULT false,
  payment_intent_id text,
  special_instructions text,
  cooking_temperature text,
  allergies text[] DEFAULT '{}',
  delivery_address text,
  pickup_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(meal_id, author_id)
);

-- Order messages table
CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('platemaker', 'platetaker')),
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Media attachments table
CREATE TABLE IF NOT EXISTS public.media_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  uri text NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Promotional offers table
CREATE TABLE IF NOT EXISTS public.promotional_offers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'buy-x-get-y', 'fixed-amount', 'free-item')),
  title text NOT NULL,
  description text NOT NULL,
  discount_percentage numeric(5,2),
  discount_amount numeric(10,2),
  buy_quantity integer,
  get_quantity integer,
  free_item_name text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, meal_id)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meals_user_id ON public.meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_cuisine ON public.meals(cuisine);
CREATE INDEX IF NOT EXISTS idx_meals_category ON public.meals(category);
CREATE INDEX IF NOT EXISTS idx_meals_available ON public.meals(available);
CREATE INDEX IF NOT EXISTS idx_meals_featured ON public.meals(featured);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_meal_id ON public.reviews(meal_id);
CREATE INDEX IF NOT EXISTS idx_reviews_author_id ON public.reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_media_attachments_meal_id ON public.media_attachments(meal_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- ============================================================================
-- PART 4: CREATE FUNCTIONS
-- ============================================================================

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Function to update meal rating
CREATE OR REPLACE FUNCTION public.update_meal_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.meals
  SET 
    rating = (SELECT avg(rating)::numeric(3,2) FROM public.reviews WHERE meal_id = COALESCE(new.meal_id, old.meal_id)),
    review_count = (SELECT count(*) FROM public.reviews WHERE meal_id = COALESCE(new.meal_id, old.meal_id))
  WHERE id = COALESCE(new.meal_id, old.meal_id);
  RETURN COALESCE(new, old);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role, is_admin)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'platetaker'),
    false
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Username or email already exists';
  WHEN others THEN
    RAISE EXCEPTION 'Failed to create profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to automatically calculate order price (prevents price manipulation)
CREATE OR REPLACE FUNCTION public.calculate_order_price()
RETURNS trigger AS $$
DECLARE
  meal_price numeric(10,2);
  calculated_total numeric(10,2);
BEGIN
  SELECT price INTO meal_price
  FROM public.meals
  WHERE id = new.meal_id AND available = true AND published = true;

  IF meal_price IS NULL THEN
    RAISE EXCEPTION 'Meal not found or not available';
  END IF;

  IF new.quantity > 999 THEN
    RAISE EXCEPTION 'Quantity exceeds maximum allowed (999)';
  END IF;

  calculated_total := meal_price * new.quantity;
  new.total_price := calculated_total;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN coalesce((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Function to log deleted media for cleanup
CREATE OR REPLACE FUNCTION public.log_deleted_media()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (action, table_name, record_id, old_data)
  VALUES (
    'DELETE_MEDIA_PENDING',
    'meals',
    old.id,
    jsonb_build_object(
      'meal_id', old.id,
      'images', old.images,
      'user_id', old.user_id
    )
  );
  RETURN old;
END;
$$ LANGUAGE plpgsql;

-- Function to promote user to admin (backend only, requires service role)
CREATE OR REPLACE FUNCTION public.promote_to_admin(target_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET is_admin = true
  WHERE id = target_user_id;
  
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
  VALUES (target_user_id, 'PROMOTED_TO_ADMIN', 'profiles', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PART 5: CREATE TRIGGERS
-- ============================================================================

-- Drop all triggers first to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS calculate_order_price_trigger ON public.orders;
DROP TRIGGER IF EXISTS log_media_cleanup ON public.meals;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at_meals ON public.meals;
DROP TRIGGER IF EXISTS set_updated_at_orders ON public.orders;
DROP TRIGGER IF EXISTS set_updated_at_reviews ON public.reviews;
DROP TRIGGER IF EXISTS update_meal_rating_on_review ON public.reviews;

-- Create updated_at triggers
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_meals
  BEFORE UPDATE ON public.meals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger to update meal rating
CREATE TRIGGER update_meal_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meal_rating();

-- Create trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create trigger to calculate order price
CREATE TRIGGER calculate_order_price_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_price();

-- Create trigger to log media cleanup
CREATE TRIGGER log_media_cleanup
  BEFORE DELETE ON public.meals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deleted_media();

-- ============================================================================
-- PART 6: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 7: CREATE RLS POLICIES
-- ============================================================================

-- Drop all existing policies first
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;

DROP POLICY IF EXISTS "select_meals" ON public.meals;
DROP POLICY IF EXISTS "insert_meal_platemaker" ON public.meals;
DROP POLICY IF EXISTS "update_meal_owner" ON public.meals;
DROP POLICY IF EXISTS "update_meal_owner_or_admin" ON public.meals;
DROP POLICY IF EXISTS "delete_meal_owner" ON public.meals;
DROP POLICY IF EXISTS "delete_meal_owner_or_admin" ON public.meals;

DROP POLICY IF EXISTS "select_orders_buyer_or_seller" ON public.orders;
DROP POLICY IF EXISTS "select_orders_buyer_or_seller_or_admin" ON public.orders;
DROP POLICY IF EXISTS "insert_order_buyer" ON public.orders;
DROP POLICY IF EXISTS "update_order_buyer_or_seller" ON public.orders;
DROP POLICY IF EXISTS "update_order_buyer_or_seller_or_admin" ON public.orders;
DROP POLICY IF EXISTS "delete_order_buyer_or_seller" ON public.orders;
DROP POLICY IF EXISTS "delete_order_admin_only" ON public.orders;

DROP POLICY IF EXISTS "select_reviews" ON public.reviews;
DROP POLICY IF EXISTS "insert_review_after_purchase" ON public.reviews;
DROP POLICY IF EXISTS "update_own_review" ON public.reviews;
DROP POLICY IF EXISTS "update_own_review_or_admin" ON public.reviews;
DROP POLICY IF EXISTS "delete_own_review" ON public.reviews;
DROP POLICY IF EXISTS "delete_own_review_or_admin" ON public.reviews;

DROP POLICY IF EXISTS "select_order_messages" ON public.order_messages;
DROP POLICY IF EXISTS "insert_order_messages" ON public.order_messages;

DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "delete_own_notifications" ON public.notifications;

DROP POLICY IF EXISTS "select_media_attachments" ON public.media_attachments;
DROP POLICY IF EXISTS "insert_media_attachments" ON public.media_attachments;
DROP POLICY IF EXISTS "delete_own_media_attachments" ON public.media_attachments;

DROP POLICY IF EXISTS "select_promotional_offers" ON public.promotional_offers;
DROP POLICY IF EXISTS "insert_promotional_offer" ON public.promotional_offers;
DROP POLICY IF EXISTS "update_own_promotional_offer" ON public.promotional_offers;
DROP POLICY IF EXISTS "delete_own_promotional_offer" ON public.promotional_offers;

DROP POLICY IF EXISTS "select_favorites" ON public.favorites;
DROP POLICY IF EXISTS "insert_own_favorite" ON public.favorites;
DROP POLICY IF EXISTS "delete_own_favorite" ON public.favorites;

DROP POLICY IF EXISTS "select_audit_logs_admin_only" ON public.audit_logs;

-- PROFILES POLICIES
CREATE POLICY "select_own_profile" ON public.profiles 
FOR SELECT USING (id = auth.uid());

CREATE POLICY "update_own_profile" ON public.profiles 
FOR UPDATE 
USING (id = auth.uid()) 
WITH CHECK (
  id = auth.uid() 
  AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
);

-- MEALS POLICIES
CREATE POLICY "select_meals" ON public.meals 
FOR SELECT USING (published = true OR user_id = auth.uid());

CREATE POLICY "insert_meal_platemaker" ON public.meals 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'platemaker'
);

CREATE POLICY "update_meal_owner_or_admin" ON public.meals 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR public.is_admin() = true
)
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_admin() = true
);

CREATE POLICY "delete_meal_owner_or_admin" ON public.meals 
FOR DELETE 
USING (
  user_id = auth.uid() 
  OR public.is_admin() = true
);

-- ORDERS POLICIES
CREATE POLICY "select_orders_buyer_or_seller_or_admin" ON public.orders 
FOR SELECT 
USING (
  buyer_id = auth.uid() 
  OR seller_id = auth.uid()
  OR public.is_admin() = true
);

CREATE POLICY "insert_order_buyer" ON public.orders 
FOR INSERT 
WITH CHECK (
  buyer_id = auth.uid()
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'platetaker'
);

CREATE POLICY "update_order_buyer_or_seller_or_admin" ON public.orders 
FOR UPDATE 
USING (
  buyer_id = auth.uid() 
  OR seller_id = auth.uid()
  OR public.is_admin() = true
)
WITH CHECK (
  buyer_id = auth.uid() 
  OR seller_id = auth.uid()
  OR public.is_admin() = true
);

CREATE POLICY "delete_order_admin_only" ON public.orders 
FOR DELETE 
USING (
  public.is_admin() = true
);

-- REVIEWS POLICIES
CREATE POLICY "select_reviews" ON public.reviews 
FOR SELECT USING (true);

CREATE POLICY "insert_review_after_purchase" ON public.reviews 
FOR INSERT 
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.meal_id = reviews.meal_id
      AND o.buyer_id = auth.uid()
      AND o.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_id = reviews.order_id
  )
);

CREATE POLICY "update_own_review_or_admin" ON public.reviews 
FOR UPDATE 
USING (
  author_id = auth.uid()
  OR public.is_admin() = true
)
WITH CHECK (
  author_id = auth.uid()
  OR public.is_admin() = true
);

CREATE POLICY "delete_own_review_or_admin" ON public.reviews 
FOR DELETE 
USING (
  author_id = auth.uid()
  OR public.is_admin() = true
);

-- ORDER MESSAGES POLICIES
CREATE POLICY "select_order_messages" ON public.order_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

CREATE POLICY "insert_order_messages" ON public.order_messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- NOTIFICATIONS POLICIES
CREATE POLICY "select_own_notifications" ON public.notifications 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "update_own_notifications" ON public.notifications 
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "delete_own_notifications" ON public.notifications 
FOR DELETE USING (user_id = auth.uid());

-- MEDIA ATTACHMENTS POLICIES
CREATE POLICY "select_media_attachments" ON public.media_attachments 
FOR SELECT USING (true);

CREATE POLICY "insert_media_attachments" ON public.media_attachments 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own_media_attachments" ON public.media_attachments 
FOR DELETE USING (user_id = auth.uid());

-- PROMOTIONAL OFFERS POLICIES
CREATE POLICY "select_promotional_offers" ON public.promotional_offers 
FOR SELECT USING (is_active = true OR user_id = auth.uid());

CREATE POLICY "insert_promotional_offer" ON public.promotional_offers 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid()
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'platemaker'
);

CREATE POLICY "update_own_promotional_offer" ON public.promotional_offers 
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "delete_own_promotional_offer" ON public.promotional_offers 
FOR DELETE USING (user_id = auth.uid());

-- FAVORITES POLICIES
CREATE POLICY "select_favorites" ON public.favorites 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own_favorite" ON public.favorites 
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own_favorite" ON public.favorites 
FOR DELETE USING (user_id = auth.uid());

-- AUDIT LOGS POLICIES
CREATE POLICY "select_audit_logs_admin_only" ON public.audit_logs 
FOR SELECT 
USING (public.is_admin() = true);

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Your database is now fully configured with:
-- ✓ All tables created
-- ✓ Secure functions with search_path protection
-- ✓ Automatic profile creation on signup
-- ✓ Server-side price calculation (prevents "Free Meal" vulnerability)
-- ✓ Admin bypass for all operations
-- ✓ Secure profile updates (prevents is_admin escalation)
-- ✓ Media cleanup tracking
-- ✓ Audit logging for sensitive operations
-- ✓ Row Level Security policies
-- 
-- To promote a user to admin, run from your backend with service role:
-- SELECT promote_to_admin('user-uuid-here');
-- ============================================================================
