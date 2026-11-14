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

## 3. Membership on the emulator

The phone does not call `create-subscription`. That source returns status 410 and must not call Stripe. Do not select `FREE_TRIAL_AUTO_PAY` or `LIFETIME_PROMO`. Do not set a Stripe price id from this note. Do not deploy the function.

Signed in, a PlateMaker plan and a PlateTaker plan on Android use the Play products. The amounts shown in the app come from `SUBSCRIPTION_PRICES` in `backend/lib/fees.ts`. Signed out, both roles join from Membership. Web, iOS, and Android use the same source. A lifetime account still replaces `device_id` on this install, and a second account cannot store that token. Those checks are in the sections above.

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
- The phone does not call `create-subscription`. That source returns status 410.
- Do not deploy the function, and do not set a Stripe price id from this note.
- Signed in, a PlateMaker plan and a PlateTaker plan on Android use the Play products. The amounts shown in the app come from `SUBSCRIPTION_PRICES`.

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
- [ ] Signed in, a PlateMaker plan and a PlateTaker plan use the Play products
- [ ] Metro name is correctly recorded after signup
- [ ] A lifetime account replaces `device_id` on this install, and a second account cannot store that token
- [ ] Metro cap enforcement works (100 users per metro)

## 7. Production Readiness

Before going live:

1. **Switch Stripe to live mode:**
   - The Worker secret `STRIPE_SECRET_KEY` is the live key when Stripe is in live mode. Do not paste the value here.
   - Leave Stripe price ids unset from this note. Amounts stay in `SUBSCRIPTION_PRICES`. Android membership uses the Play products.

2. **Verify a re-download:**
   - Sign in on a lifetime account, note `device_id`, delete the app, install it again, and sign in.
   - `device_id` updates to the new install. The account stays lifetime. A second account cannot store that same token.
