-- ============================================================================
-- SECURITY ENHANCEMENTS TEST SCRIPT
-- ============================================================================
-- This script tests all security features implemented in security_enhancements.sql
-- Run this after applying the security enhancements to verify everything works
-- ============================================================================

-- Test Setup: Create test users and data
-- Note: These tests should be run with appropriate user context (authenticated user tokens)
-- For manual testing, use Supabase SQL editor with "Run as authenticated user" option

BEGIN;

-- ============================================================================
-- TEST 1: Price Calculation Trigger (Critical - Prevents "Free Meal" Attack)
-- ============================================================================
RAISE NOTICE '=== TEST 1: Price Calculation Trigger ===';

-- Create a test meal (you'll need to be authenticated as a platemaker)
-- INSERT INTO public.meals (user_id, name, description, price, cuisine_type, dietary_info, available, published)
-- VALUES (auth.uid(), 'Test Burger', 'Test description', 15.99, 'American', '{}', true, true)
-- RETURNING id;

-- Test 1a: Insert order with correct price (should auto-calculate)
RAISE NOTICE 'Test 1a: Order with quantity 2, meal price $15.99';
-- Expected: total_price should be automatically set to 31.98 (15.99 * 2)
-- INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
-- VALUES (auth.uid(), (SELECT user_id FROM meals WHERE id = 'test-meal-id'), 'test-meal-id', 2, 999.99, 'pending')
-- RETURNING id, total_price;
-- Verify: total_price should be 31.98, NOT 999.99

-- Test 1b: Insert order with malicious low price (should override)
RAISE NOTICE 'Test 1b: Attempt to set total_price to $0.01 (should be overridden)';
-- Expected: total_price should be recalculated to 15.99
-- INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
-- VALUES (auth.uid(), (SELECT user_id FROM meals WHERE id = 'test-meal-id'), 'test-meal-id', 1, 0.01, 'pending');
-- Verify: Check that total_price = 15.99 (not 0.01)

-- Test 1c: Attempt quantity overflow (should fail)
RAISE NOTICE 'Test 1c: Attempt to order 10000 meals (should fail with quantity check)';
-- Expected: Should raise exception "Quantity exceeds maximum allowed (999)"
-- INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
-- VALUES (auth.uid(), (SELECT user_id FROM meals WHERE id = 'test-meal-id'), 'test-meal-id', 10000, 0.01, 'pending');

-- Test 1d: Order unavailable meal (should fail)
RAISE NOTICE 'Test 1d: Attempt to order unavailable meal (should fail)';
-- UPDATE public.meals SET available = false WHERE id = 'test-meal-id';
-- Expected: Should raise exception "Meal not found or not available"
-- INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
-- VALUES (auth.uid(), (SELECT user_id FROM meals WHERE id = 'test-meal-id'), 'test-meal-id', 1, 100.00, 'pending');

-- ============================================================================
-- TEST 2: Admin Bypass in RLS Policies
-- ============================================================================
RAISE NOTICE '=== TEST 2: Admin Bypass Policies ===';

-- Test 2a: Non-admin cannot update another user's meal
RAISE NOTICE 'Test 2a: Non-admin tries to update another users meal (should fail)';
-- Expected: UPDATE should fail due to RLS policy
-- UPDATE public.meals SET price = 999.99 WHERE user_id != auth.uid();

-- Test 2b: Admin can update any meal
RAISE NOTICE 'Test 2b: Admin updates any meal (should succeed)';
-- First promote a user to admin:
-- SELECT public.promote_to_admin('test-user-id');
-- Then as admin:
-- UPDATE public.meals SET price = 25.00 WHERE id = 'any-meal-id';
-- Verify: Update should succeed

-- Test 2c: Admin can delete any order
RAISE NOTICE 'Test 2c: Admin deletes any order (should succeed)';
-- Expected: DELETE should succeed
-- DELETE FROM public.orders WHERE id = 'any-order-id';

-- Test 2d: Non-admin cannot delete others' orders
RAISE NOTICE 'Test 2d: Non-admin tries to delete another users order (should fail)';
-- Expected: DELETE should fail
-- DELETE FROM public.orders WHERE buyer_id != auth.uid() AND seller_id != auth.uid();

-- ============================================================================
-- TEST 3: Prevent is_admin Escalation
-- ============================================================================
RAISE NOTICE '=== TEST 3: Prevent is_admin Escalation ===';

-- Test 3a: User tries to set their own is_admin to true
RAISE NOTICE 'Test 3a: User attempts self-promotion to admin (should fail)';
-- Expected: UPDATE should fail or be silently ignored
-- UPDATE public.profiles SET is_admin = true WHERE id = auth.uid();
-- Verify: is_admin should still be false

-- Test 3b: User can update other profile fields
RAISE NOTICE 'Test 3b: User updates their own username (should succeed)';
-- Expected: UPDATE should succeed
-- UPDATE public.profiles SET username = 'newusername' WHERE id = auth.uid();

-- ============================================================================
-- TEST 4: Review Linking to Orders (Prevent Ghost Reviews)
-- ============================================================================
RAISE NOTICE '=== TEST 4: Review Linking and Ghost Review Prevention ===';

-- Test 4a: User tries to review meal without purchase
RAISE NOTICE 'Test 4a: Attempt to review without completed order (should fail)';
-- Expected: INSERT should fail
-- INSERT INTO public.reviews (meal_id, author_id, order_id, rating, comment)
-- VALUES ('unpurchased-meal-id', auth.uid(), 'non-existent-order-id', 5, 'Great!');

-- Test 4b: User reviews meal with valid completed order
RAISE NOTICE 'Test 4b: Review meal with completed order (should succeed)';
-- First create and complete an order:
-- INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
-- VALUES (auth.uid(), 'seller-id', 'meal-id', 1, 15.99, 'completed')
-- RETURNING id;
-- Then review:
-- INSERT INTO public.reviews (meal_id, author_id, order_id, rating, comment)
-- VALUES ('meal-id', auth.uid(), 'completed-order-id', 5, 'Delicious!');
-- Verify: INSERT should succeed

-- Test 4c: User tries to review same order twice
RAISE NOTICE 'Test 4c: Attempt duplicate review for same order (should fail)';
-- Expected: Second INSERT should fail
-- INSERT INTO public.reviews (meal_id, author_id, order_id, rating, comment)
-- VALUES ('meal-id', auth.uid(), 'same-order-id', 4, 'Second review');

-- ============================================================================
-- TEST 5: Media Cleanup Logging
-- ============================================================================
RAISE NOTICE '=== TEST 5: Media Cleanup Logging ===';

-- Test 5a: Delete meal with images triggers audit log
RAISE NOTICE 'Test 5a: Delete meal with images (should create audit log)';
-- DELETE FROM public.meals WHERE id = 'meal-with-images-id';
-- Verify audit_logs:
-- SELECT * FROM public.audit_logs 
-- WHERE action = 'DELETE_MEDIA_PENDING' 
-- AND old_data->>'meal_id' = 'meal-with-images-id';
-- Expected: Should have entry in audit_logs

-- ============================================================================
-- TEST 6: Audit Log Access Control
-- ============================================================================
RAISE NOTICE '=== TEST 6: Audit Log Access ===';

-- Test 6a: Non-admin cannot view audit logs
RAISE NOTICE 'Test 6a: Non-admin tries to read audit_logs (should return empty)';
-- Expected: SELECT should return 0 rows due to RLS
-- SELECT * FROM public.audit_logs;

-- Test 6b: Admin can view audit logs
RAISE NOTICE 'Test 6b: Admin reads audit_logs (should succeed)';
-- As admin user:
-- SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 10;
-- Expected: Should return rows

-- ============================================================================
-- TEST 7: Constraint Checks
-- ============================================================================
RAISE NOTICE '=== TEST 7: Constraint Validation ===';

-- Test 7a: Negative meal price (should fail)
RAISE NOTICE 'Test 7a: Attempt negative meal price (should fail)';
-- Expected: Should fail constraint meals_price_check
-- INSERT INTO public.meals (user_id, name, description, price, cuisine_type, dietary_info)
-- VALUES (auth.uid(), 'Test', 'Test', -10.00, 'Test', '{}');

-- Test 7b: Zero quantity order (should fail)
RAISE NOTICE 'Test 7b: Attempt zero quantity (should fail)';
-- Expected: Should fail constraint orders_quantity_check
-- INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
-- VALUES (auth.uid(), 'seller-id', 'meal-id', 0, 10.00, 'pending');

-- Test 7c: Excessive price (should fail)
RAISE NOTICE 'Test 7c: Attempt excessive meal price (should fail)';
-- Expected: Should fail constraint meals_price_check
-- INSERT INTO public.meals (user_id, name, description, price, cuisine_type, dietary_info)
-- VALUES (auth.uid(), 'Test', 'Test', 9999999.99, 'Test', '{}');

ROLLBACK;

-- ============================================================================
-- VERIFICATION QUERIES (Run these separately to check state)
-- ============================================================================

-- Check all RLS policies are in place:
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check triggers are active:
SELECT tgname, tgrelid::regclass, tgtype, tgenabled
FROM pg_trigger
WHERE tgname IN ('calculate_order_price_trigger', 'log_media_cleanup', 'on_auth_user_created');

-- Check constraints:
SELECT conname, contype, conrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%check%' AND connamespace = 'public'::regnamespace;

-- Check is_admin function exists:
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'is_admin';

-- Check promote_to_admin function exists and permissions:
SELECT proname, proacl 
FROM pg_proc 
WHERE proname = 'promote_to_admin';
