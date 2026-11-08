# Android Emulator Testing Guide

This guide helps you test the **Device-Lock** and **Stripe Trial** logic on the Android emulator before publishing.

## Prerequisites

- Android emulator running (via Android Studio or Expo)
- Supabase project configured
- Stripe test mode enabled
- Database migrations applied:
  - `backend/sql/add_device_id_to_profiles.sql`
  - `backend/sql/add_hardware_lock_trigger.sql`

## 1. Hardware Preparation (The Emulator ID)

### Identify the Device ID

The app stores a random binding token for a lifetime account. It does not use the Android ID. A re-download creates a new token. The same account may replace `profiles.device_id`. Another account cannot take that token, because the column is unique.

**To see the device ID:**

1. Sign in on the Android emulator with a lifetime account
2. Read `profiles.device_id` for that account in the table editor. That value is the binding token for this install.

### First Sign-up (Lifetime Membership)

When a lifetime membership is saved on the emulator:
- The binding token is stored in `profiles.device_id`
- The `membership_tier` is set to `'lifetime'`
- The membership stays on that account

## 2. Testing the "Device Lock" Integrity

### Manual Database Modification Test

This test verifies that the same lifetime account can replace `device_id` after a re-download. The unique constraint still stops a second account from storing that same token.

**Steps:**

1. **Create a lifetime account** on the emulator (or use existing test account)
2. **Note the device_id** from Supabase Dashboard:
   ```sql
   SELECT id, email, device_id, membership_tier 
   FROM profiles 
   WHERE membership_tier = 'lifetime' 
   LIMIT 1;
   ```
3. **Manually modify the device_id** in Supabase Dashboard:
   - Go to Table Editor → `profiles` table
   - Find your test user
   - Change `device_id` to a random string (e.g., `"WRONG_DEVICE_123"`)
   - Try to save

**Expected Result:**
- The same account’s `device_id` update is saved.
- A second account cannot store that same token. The unique constraint on `profiles.device_id` rejects the duplicate.
- `backend/sql/allow_lifetime_device_rebind.sql` was run on 7 November 2026. The editor returned Success with no rows. Do not run it again.

### App-Level Hardware Audit Test

This test verifies that the app detects hardware mismatches and shows the error screen.

**Steps:**

1. **Create a lifetime account** on Emulator A (note the device_id)
2. **Manually change device_id** in database to a different value (using SQL, bypassing trigger):
   ```sql
   -- WARNING: This bypasses the trigger for testing only
   -- In production, the trigger prevents this
   UPDATE profiles 
   SET device_id = 'WRONG_DEVICE_123' 
   WHERE id = '<your-user-id>';
   ```
3. **Relaunch the app** on the same emulator
4. **Expected behavior:**
   - The same account stays signed in.
   - The app saves this install’s token on the account.
   - A PlateMaker stays on the kitchen. A PlateTaker stays on home.

**What to check:**
- `profiles.device_id` for that account equals this install’s token after sign-in.
- A PlateMaker stays on the kitchen. A PlateTaker stays on home.

## 3. Testing the Stripe Trial ($4.99 Auto-Pay)

### Test the "10,000 Slot" Free Trial Flow

**Steps:**

1. **Choose a test metro** (e.g., "Austin")
2. **Sign up** as a new user in that metro
3. **Select FREE_TRIAL_AUTO_PAY** promotion type
4. **Stripe Checkout:**
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

**Verification Checklist:**

- [ ] Stripe Checkout page explicitly mentions **"30 days free, then $4.99/month"**
- [ ] Checkout completes successfully
- [ ] Database check: `metro_name` is correctly recorded in `profiles.metro_area`
- [ ] Database check: `membership_tier` is set to `'premium'`
- [ ] Database check: `trial_ends_at` is set to 30 days from now
- [ ] Database check: `stripe_subscription_id` is populated

**SQL to verify:**
```sql
SELECT 
  id, 
  email, 
  metro_area, 
  membership_tier, 
  trial_ends_at, 
  stripe_subscription_id,
  device_id
FROM profiles 
WHERE email = '<test-email>'
ORDER BY created_at DESC 
LIMIT 1;
```

### Test Lifetime Promo Flow

**Steps:**

1. **Sign up** as a new user
2. **Select LIFETIME_PROMO** promotion type
3. **Stripe Checkout:**
   - Use test card: `4242 4242 4242 4242`
   - Complete checkout (should be $0.00)

**Verification Checklist:**

- [ ] Checkout completes successfully
- [ ] Database check: `membership_tier` is set to `'lifetime'`
- [ ] Database check: `device_id` is the binding token for this install

**SQL to verify:**
```sql
SELECT 
  id, 
  email, 
  membership_tier, 
  device_id,
  metro_area
FROM profiles 
WHERE email = '<test-email>'
ORDER BY created_at DESC 
LIMIT 1;
```

## 4. Testing Metro Cap Enforcement

**Steps:**

1. **Sign up 100 platemakers** in the same metro (e.g., "Austin")
2. **Try to sign up the 101st platemaker** in the same metro
3. **Expected behavior:**
   - Signup should be rejected or trial should not be applied
   - Metro cap reached notification should appear

**SQL to check metro counts:**
```sql
SELECT 
  metro_name, 
  platemaker_count, 
  platetaker_count, 
  max_cap
FROM metro_area_counts 
WHERE metro_name = 'Austin';
```

## 5. Common Issues & Troubleshooting

### Re-download token is not saved

**Issue:** After a reinstall, `profiles.device_id` stays on the old token

**Solution:**
- Confirm `membership_tier` is `lifetime`
- `backend/sql/allow_lifetime_device_rebind.sql` was run on 7 November 2026. Success with no rows. Do not run it again.
- Sign in again on this install. The account replaces `device_id` with this install’s token.

### Stripe Checkout Not Showing Trial Message

**Issue:** Checkout page doesn't mention "30 days free"

**Solution:**
- Verify Edge Function `create-subscription` is deployed
- Check that `subscription_data[trial_period_days]` is set to `30` in Edge Function
- Verify Stripe Price ID is configured correctly in Supabase secrets

### Database Trigger Not Firing

**Issue:** Saving a new token on a lifetime account raises `Hardware mismatch`

**Solution:**
- `backend/sql/allow_lifetime_device_rebind.sql` was run on 7 November 2026. The editor returned Success with no rows. Do not run it again.
- The unique constraint on `profiles.device_id` remains. A second account cannot store the same token.

## 6. Test Checklist Summary

Before publishing, verify:

- [ ] Device ID is logged correctly on app startup
- [ ] The same lifetime account can replace `device_id` after a re-download
- [ ] A second account cannot store that same token
- [ ] A re-download stays on the kitchen for a PlateMaker and on home for a PlateTaker
- [ ] Stripe trial checkout shows "30 days free, then $4.99/month"
- [ ] Metro name is correctly recorded after signup
- [ ] Lifetime promo sets `device_id` and `membership_tier = 'lifetime'`
- [ ] Metro cap enforcement works (100 users per metro)

## 7. Production Readiness

Before going live:

1. **Switch Stripe to live mode:**
   - Update `STRIPE_SECRET_KEY` to live key
   - Update Stripe Price IDs to live prices
   - Test with real card (small amount)

2. **Verify a re-download:**
   - Sign in on a lifetime account, note `device_id`, delete the app, install it again, and sign in.
   - `device_id` updates to the new install. The account stays lifetime. A second account cannot store that same token.
