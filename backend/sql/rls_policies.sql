-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.order_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.media_attachments enable row level security;
alter table public.promotional_offers enable row level security;
alter table public.favorites enable row level security;

-- Profiles policies
create policy "select_all_profiles" on public.profiles for select using (true);
-- No insert policy - only the trigger can create profiles
create policy "update_own_profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Prevent users from deleting their own profiles
-- create policy "delete_own_profile" on public.profiles for delete using (id = auth.uid());

-- Meals policies
create policy "select_published_or_owner" on public.meals for select using (published = true or user_id = auth.uid());
create policy "insert_meal_owner" on public.meals for insert with check (user_id = auth.uid());
create policy "update_meal_owner" on public.meals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete_meal_owner" on public.meals for delete using (user_id = auth.uid());

-- Orders policies
create policy "select_orders_buyer_or_seller" on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "insert_order_buyer" on public.orders for insert with check (buyer_id = auth.uid());
create policy "update_order_buyer_or_seller" on public.orders for update using (buyer_id = auth.uid() or seller_id = auth.uid()) with check (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "delete_order_buyer_or_seller" on public.orders for delete using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Reviews policies
create policy "select_reviews_all" on public.reviews for select using (true);
create policy "insert_review_after_purchase" on public.reviews for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.meal_id = reviews.meal_id
      and o.buyer_id = auth.uid()
      and o.status in ('completed')
  )
);
create policy "update_own_review" on public.reviews for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete_own_review" on public.reviews for delete using (author_id = auth.uid());

-- Order messages policies
create policy "select_order_messages" on public.order_messages for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_messages.order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);
create policy "insert_order_messages" on public.order_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

-- Notifications policies
create policy "select_own_notifications" on public.notifications for select using (user_id = auth.uid());
create policy "insert_own_notifications" on public.notifications for insert with check (user_id = auth.uid());
create policy "update_own_notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete_own_notifications" on public.notifications for delete using (user_id = auth.uid());

-- Media attachments policies
create policy "select_media_public" on public.media_attachments for select using (true);
create policy "insert_media_owner" on public.media_attachments for insert with check (user_id = auth.uid());
create policy "update_media_owner" on public.media_attachments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete_media_owner" on public.media_attachments for delete using (user_id = auth.uid());

-- Promotional offers policies
create policy "select_offers_all" on public.promotional_offers for select using (true);
create policy "insert_offer_owner" on public.promotional_offers for insert with check (user_id = auth.uid());
create policy "update_offer_owner" on public.promotional_offers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete_offer_owner" on public.promotional_offers for delete using (user_id = auth.uid());

-- Favorites policies
create policy "select_own_favorites" on public.favorites for select using (user_id = auth.uid());
create policy "insert_own_favorites" on public.favorites for insert with check (user_id = auth.uid());
create policy "delete_own_favorites" on public.favorites for delete using (user_id = auth.uid());
