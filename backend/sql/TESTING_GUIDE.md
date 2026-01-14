# SQL Security Testing Guide

This guide helps you test all security enhancements applied to your database.

## Prerequisites

1. Apply the security enhancements: Run `backend/sql/security_enhancements.sql` in your Supabase SQL Editor
2. Have at least 2 test users: one regular user and one admin

## Quick Test Setup

### 1. Create Test Data

```sql
-- As a platemaker user, create a test meal
INSERT INTO public.meals (user_id, name, description, price, cuisine_type, dietary_info, available, published)
VALUES (auth.uid(), 'Security Test Burger', 'For testing', 15.99, 'American', '["Gluten"]', true, true)
RETURNING id;
-- Save the returned meal ID
```

## Test Cases

### ✅ TEST 1: Price Calculation (CRITICAL)

**What it protects:** Prevents users from paying $0.01 for a $50 meal

```sql
-- Attempt to create order with fake low price
INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
VALUES (
  auth.uid(), 
  (SELECT user_id FROM meals WHERE name = 'Security Test Burger'), 
  (SELECT id FROM meals WHERE name = 'Security Test Burger'),
  2,
  0.01, -- Fake price!
  'pending'
)
RETURNING id, total_price;
```

**Expected Result:** `total_price` should be `31.98` (15.99 × 2), NOT `0.01`

**What this proves:** Server-side price calculation overrides client input ✓

---

### ✅ TEST 2: Quantity Overflow Protection

```sql
-- Try to order 10,000 meals
INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
VALUES (
  auth.uid(),
  (SELECT user_id FROM meals WHERE name = 'Security Test Burger'),
  (SELECT id FROM meals WHERE name = 'Security Test Burger'),
  10000,
  1.00,
  'pending'
);
```

**Expected Result:** Error: `Quantity exceeds maximum allowed (999)`

---

### ✅ TEST 3: Admin Bypass (Meals)

**As regular user:**
```sql
-- Try to update another user's meal
UPDATE public.meals 
SET price = 999.99 
WHERE user_id != auth.uid() 
LIMIT 1;
```
**Expected Result:** 0 rows updated (RLS blocks it)

**As admin user:**
```sql
-- First, promote yourself to admin (run with service role key)
SELECT public.promote_to_admin('YOUR_USER_ID_HERE');

-- Now try the same update
UPDATE public.meals 
SET price = 25.00 
WHERE id = 'ANY_MEAL_ID';
```
**Expected Result:** 1 row updated (admin bypass works) ✓

---

### ✅ TEST 4: Prevent is_admin Escalation

**As regular user:**
```sql
-- Try to promote yourself
UPDATE public.profiles 
SET is_admin = true 
WHERE id = auth.uid();

-- Check if it worked
SELECT is_admin FROM public.profiles WHERE id = auth.uid();
```

**Expected Result:** `is_admin` should still be `false` (policy blocks escalation) ✓

---

### ✅ TEST 5: Ghost Review Prevention

**Step 1: Try to review without purchase**
```sql
INSERT INTO public.reviews (meal_id, author_id, order_id, rating, comment)
VALUES (
  (SELECT id FROM meals WHERE name = 'Security Test Burger'),
  auth.uid(),
  gen_random_uuid(), -- Fake order ID
  5,
  'I never bought this!'
);
```
**Expected Result:** Error: Policy violation (no completed order exists)

**Step 2: Create completed order, then review**
```sql
-- Create and complete an order
INSERT INTO public.orders (buyer_id, seller_id, meal_id, quantity, total_price, status)
VALUES (
  auth.uid(),
  (SELECT user_id FROM meals WHERE name = 'Security Test Burger'),
  (SELECT id FROM meals WHERE name = 'Security Test Burger'),
  1,
  15.99,
  'completed'
)
RETURNING id;
-- Save the order_id

-- Now review it (use the actual order_id from above)
INSERT INTO public.reviews (meal_id, author_id, order_id, rating, comment)
VALUES (
  (SELECT id FROM meals WHERE name = 'Security Test Burger'),
  auth.uid(),
  'YOUR_ORDER_ID_HERE',
  5,
  'Legit review!'
);
```
**Expected Result:** Review created successfully ✓

**Step 3: Try to review same order twice**
```sql
INSERT INTO public.reviews (meal_id, author_id, order_id, rating, comment)
VALUES (
  (SELECT id FROM meals WHERE name = 'Security Test Burger'),
  auth.uid(),
  'SAME_ORDER_ID_FROM_STEP_2',
  4,
  'Another review for same order'
);
```
**Expected Result:** Error: Duplicate review for order blocked

---

### ✅ TEST 6: Media Cleanup Logging

```sql
-- Create meal with images
INSERT INTO public.meals (user_id, name, description, price, cuisine_type, dietary_info, images, available, published)
VALUES (
  auth.uid(),
  'Meal With Images',
  'Test',
  10.00,
  'Test',
  '[]',
  '["https://example.com/image1.jpg", "https://example.com/image2.jpg"]',
  true,
  true
)
RETURNING id;

-- Delete it
DELETE FROM public.meals WHERE name = 'Meal With Images';

-- Check audit log
SELECT * FROM public.audit_logs 
WHERE action = 'DELETE_MEDIA_PENDING'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Result:** Audit log entry with action `DELETE_MEDIA_PENDING` ✓

---

### ✅ TEST 7: Audit Log Access Control

**As regular user:**
```sql
SELECT * FROM public.audit_logs;
```
**Expected Result:** 0 rows (RLS blocks non-admin access)

**As admin:**
```sql
SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 10;
```
**Expected Result:** Shows audit log entries ✓

---

## Verification Queries

Run these to verify all security components are in place:

```sql
-- Check all RLS policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check triggers are active
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname IN (
  'calculate_order_price_trigger',
  'log_media_cleanup',
  'on_auth_user_created'
);

-- Check constraints
SELECT conrelid::regclass AS table_name, conname AS constraint_name
FROM pg_constraint
WHERE conname LIKE '%_check'
AND connamespace = 'public'::regnamespace;

-- Check security functions exist
SELECT proname FROM pg_proc 
WHERE proname IN ('is_admin', 'promote_to_admin', 'calculate_order_price');
```

## Common Issues

### Issue: "function gen_random_uuid() does not exist"
**Fix:** Run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (requires superuser)

### Issue: Triggers not firing
**Fix:** Check trigger is enabled: `SELECT tgenabled FROM pg_trigger WHERE tgname = 'calculate_order_price_trigger';`

### Issue: RLS policies not blocking
**Fix:** Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`

## Testing from Your App

Add this test function to your backend:

```typescript
// backend/trpc/routes/test-security/route.ts
export const testSecurityRoute = publicProcedure.query(async ({ ctx }) => {
  const { supabase } = ctx;
  
  // Test 1: Try to create order with fake price
  const { data: order } = await supabase
    .from('orders')
    .insert({
      buyer_id: ctx.user.id,
      seller_id: 'test-seller-id',
      meal_id: 'test-meal-id',
      quantity: 2,
      total_price: 0.01, // Fake price
      status: 'pending'
    })
    .select('total_price')
    .single();
    
  return {
    priceCalculationWorks: order?.total_price !== 0.01,
    calculatedPrice: order?.total_price
  };
});
```

## Success Checklist

- [ ] Price calculation trigger overrides client prices
- [ ] Quantity overflow is blocked (max 999)
- [ ] Admin can update/delete any resource
- [ ] Regular users cannot promote themselves to admin
- [ ] Reviews require completed orders
- [ ] Duplicate reviews for same order are blocked
- [ ] Media deletion creates audit log entries
- [ ] Non-admins cannot view audit logs
- [ ] All constraints are enforced (negative prices, etc.)
