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

The app uses `Application.getAndroidId()` on Android to get a unique device identifier. This ID gets locked into the `device_id` column of the `profiles` table for lifetime memberships.

**To see the device ID:**

1. Launch the app on the Android emulator
2. Check the console logs for:
   ```
   [HardwareAudit] Device ID (Android ID): <your-emulator-id>
   [HardwareAudit] This ID will be locked into device_id column for lifetime memberships
   ```
3. **Note this ID** - it's what gets stored in the database

**Example output:**
```
[HardwareAudit] Device ID (Android ID): 9774d56d682e549c
[HardwareAudit] This ID will be locked into device_id column for lifetime memberships
```

### First Sign-up (Lifetime Membership)

When you create a **Lifetime** account on the emulator:
- The Android ID from step 1 gets stored in `profiles.device_id`
- The `membership_tier` is set to `'lifetime'`
- This creates the device lock

## 2. Testing the "Device Lock" Integrity

### Manual Database Modification Test

This test verifies that the database trigger `enforce_lifetime_hardware_lock` prevents unauthorized device_id changes.

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
- The database should **reject the update** with error:
  ```
  Hardware mismatch: Lifetime membership is device-locked and non-transferable. 
  Original device_id: <original-id>, Attempted device_id: WRONG_DEVICE_123
  ```
- The trigger `enforce_lifetime_hardware_lock_trigger` fires and raises an exception

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
   - App detects hardware mismatch during startup
   - Navigates to `/(auth)/hardware-mismatch` screen
   - Shows clear "Hardware Mismatch" error message
   - User can logout and return to login

**Console logs to verify:**
```
[HardwareAudit] Running hardware audit for user: <user-id>
[HardwareAudit] Current device ID: <emulator-id>
[HardwareAudit] Audit result: { allowed: false, reason: 'LIFETIME_DEVICE_MISMATCH' }
[HardwareAudit] Hardware mismatch detected, navigating to hardware-mismatch screen
```

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
- [ ] Database check: `device_id` is populated with emulator's Android ID
- [ ] Database check: `device_id` matches the logged device ID from console

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

### Device ID Not Logging

**Issue:** No device ID appears in console logs

**Solution:**
- Check that `expo-application` is properly installed
- Verify Android emulator is running (not web)
- Check app permissions (Android ID requires no special permissions)

### Hardware Mismatch Not Detected

**Issue:** App doesn't navigate to hardware-mismatch screen

**Solution:**
- Verify hardware audit is running: check console for `[HardwareAudit]` logs
- Check that user has `membership_tier = 'lifetime'`
- Verify `device_id` in database is different from current emulator ID
- Check that `runHardwareAudit()` is being called in `hooks/auth-context.tsx`

### Stripe Checkout Not Showing Trial Message

**Issue:** Checkout page doesn't mention "30 days free"

**Solution:**
- Verify Edge Function `create-subscription` is deployed
- Check that `subscription_data[trial_period_days]` is set to `30` in Edge Function
- Verify Stripe Price ID is configured correctly in Supabase secrets

### Database Trigger Not Firing

**Issue:** Can manually change `device_id` in database without error

**Solution:**
- Verify trigger is created: 
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'enforce_lifetime_hardware_lock_trigger';
  ```
- Re-run migration: `backend/sql/add_hardware_lock_trigger.sql`
- Check trigger function exists:
  ```sql
  SELECT * FROM pg_proc WHERE proname = 'enforce_lifetime_hardware_lock';
  ```

## 6. Test Checklist Summary

Before publishing, verify:

- [ ] Device ID is logged correctly on app startup
- [ ] Database trigger prevents `device_id` changes for lifetime members
- [ ] App shows hardware-mismatch screen when device ID doesn't match
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

2. **Verify device lock in production:**
   - Test on real Android device (not emulator)
   - Verify Android ID is stable across app restarts
   - Test hardware mismatch detection

3. **Monitor logs:**
   - Watch for `[HardwareAudit]` logs in production
   - Monitor `audit_logs` table for `HARDWARE_MISMATCH` entries
   - Set up alerts for hardware mismatch attempts
