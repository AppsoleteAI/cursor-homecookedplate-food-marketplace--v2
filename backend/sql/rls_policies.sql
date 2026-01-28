-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 1. Performance Indexes (Essential so RLS subqueries don't lag)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_seller ON public.orders(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_meals_published_user ON public.meals(published, user_id);

-- 2. Profiles Policies
DROP POLICY IF EXISTS "select_all_profiles" ON public.profiles;
CREATE POLICY "select_all_profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 3. Meals Policies (Platemakers)
DROP POLICY IF EXISTS "select_published_or_owner" ON public.meals;
CREATE POLICY "select_published_or_owner" ON public.meals FOR SELECT USING (published = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert_meal_owner" ON public.meals;
CREATE POLICY "insert_meal_owner" ON public.meals FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_meal_owner" ON public.meals;
CREATE POLICY "update_meal_owner" ON public.meals FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_meal_owner" ON public.meals;
CREATE POLICY "delete_meal_owner" ON public.meals FOR DELETE USING (user_id = auth.uid());

-- 4. Orders Policies
DROP POLICY IF EXISTS "select_orders_buyer_or_seller" ON public.orders;
CREATE POLICY "select_orders_buyer_or_seller" ON public.orders FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS "insert_order_buyer" ON public.orders;
CREATE POLICY "insert_order_buyer" ON public.orders FOR INSERT WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "update_order_buyer_or_seller" ON public.orders;
CREATE POLICY "update_order_buyer_or_seller" ON public.orders FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid()) WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS "delete_order_buyer_or_seller" ON public.orders;
CREATE POLICY "delete_order_buyer_or_seller" ON public.orders FOR DELETE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- 5. Reviews (Requires 'completed' order check)
DROP POLICY IF EXISTS "select_reviews_all" ON public.reviews;
CREATE POLICY "select_reviews_all" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_review_after_purchase" ON public.reviews;
CREATE POLICY "insert_review_after_purchase" ON public.reviews FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.meal_id = reviews.meal_id
      AND o.buyer_id = auth.uid()
      AND o.status = 'completed'
  )
);

DROP POLICY IF EXISTS "update_own_review" ON public.reviews;
CREATE POLICY "update_own_review" ON public.reviews FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_review" ON public.reviews;
CREATE POLICY "delete_own_review" ON public.reviews FOR DELETE USING (author_id = auth.uid());

-- 6. Order Messages Policies
DROP POLICY IF EXISTS "select_order_messages" ON public.order_messages;
CREATE POLICY "select_order_messages" ON public.order_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_messages.order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "insert_order_messages" ON public.order_messages;
CREATE POLICY "insert_order_messages" ON public.order_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- 7. Notifications Policies
DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications" ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_notifications" ON public.notifications;
CREATE POLICY "delete_own_notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- 8. Media Attachments Policies
DROP POLICY IF EXISTS "select_media_public" ON public.media_attachments;
CREATE POLICY "select_media_public" ON public.media_attachments FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_media_owner" ON public.media_attachments;
CREATE POLICY "insert_media_owner" ON public.media_attachments FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_media_owner" ON public.media_attachments;
CREATE POLICY "update_media_owner" ON public.media_attachments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_media_owner" ON public.media_attachments;
CREATE POLICY "delete_media_owner" ON public.media_attachments FOR DELETE USING (user_id = auth.uid());

-- 9. Promotional Offers Policies
DROP POLICY IF EXISTS "select_offers_all" ON public.promotional_offers;
CREATE POLICY "select_offers_all" ON public.promotional_offers FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_offer_owner" ON public.promotional_offers;
CREATE POLICY "insert_offer_owner" ON public.promotional_offers FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_offer_owner" ON public.promotional_offers;
CREATE POLICY "update_offer_owner" ON public.promotional_offers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_offer_owner" ON public.promotional_offers;
CREATE POLICY "delete_offer_owner" ON public.promotional_offers FOR DELETE USING (user_id = auth.uid());

-- 10. Favorites Policies
DROP POLICY IF EXISTS "select_own_favorites" ON public.favorites;
CREATE POLICY "select_own_favorites" ON public.favorites FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_favorites" ON public.favorites;
CREATE POLICY "insert_own_favorites" ON public.favorites FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_favorites" ON public.favorites;
CREATE POLICY "delete_own_favorites" ON public.favorites FOR DELETE USING (user_id = auth.uid());
