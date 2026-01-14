# Stripe Marketplace Setup Guide

## Overview
This app uses **Stripe Connect** for marketplace payments. You only need ONE Stripe account (your platform account). Sellers create "Connected Accounts" through Stripe Connect.

## Architecture
- **Platform (You)**: One Stripe account with secret key
- **PlateMaker (Seller)**: Stripe Connected Account (created via app)
- **PlateTaker (Buyer)**: Pays through your platform

## Setup Steps

### 1. Get Your Stripe Secret Key
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
3. Add it to `backend/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

### 2. Run Database Migration
Run this SQL in your Supabase SQL Editor:
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_account_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id 
ON public.profiles(stripe_account_id);
```

Or use the migration file:
```bash
# Copy the SQL from backend/sql/add_stripe_account_id.sql
# and run it in Supabase SQL Editor
```

### 3. How It Works

#### For Sellers (PlateMakers):
1. Seller signs up as a PlateMaker
2. App calls `trpc.payments.createConnectAccount.mutate()`
3. Seller completes Stripe onboarding via returned URL
4. Their `stripe_account_id` is saved in the database

#### For Buyers (PlateTakers):
1. Buyer adds items to cart
2. Clicks "Place Order" in checkout
3. App calls `trpc.payments.createPaymentIntent.mutate()` with:
   - `amount`: Total price
   - `sellerId`: PlateMaker's user ID
   - `platformFeePercent`: Your commission (default 10%)
4. Payment is processed via Stripe
5. Money goes to seller's Connected Account minus your platform fee

## API Usage

### Create Connected Account (for sellers)
```typescript
const result = await trpc.payments.createConnectAccount.mutate({
  email: 'seller@example.com',
  businessName: 'Chef John\'s Kitchen',
  country: 'US'
});

// Open the onboarding URL in browser
Linking.openURL(result.onboardingUrl);
```

### Check Account Status
```typescript
const status = await trpc.payments.getConnectAccountStatus.useQuery();

if (status.needsOnboarding) {
  // Show onboarding prompt
}
```

### Create Payment (for buyers)
```typescript
const payment = await trpc.payments.createPaymentIntent.mutate({
  amount: 25.00,
  currency: 'usd',
  sellerId: 'seller-user-id',
  platformFeePercent: 10 // You get 10%, seller gets 90%
});

// Use payment.clientSecret with Stripe SDK
```

## Platform Fee
The platform fee is configurable per transaction:
- Default: 10%
- Example: $25 order → Seller gets $22.50, Platform gets $2.50

## Test vs Live Mode
The system auto-detects based on your key:
- `sk_test_...` → Test mode
- `sk_live_...` → Live mode

## Migration from Old System
If you previously had `STRIPE_SECRET_KEY_MAKER` and `STRIPE_SECRET_KEY_TAKER`:
1. Remove those environment variables
2. Keep only `STRIPE_SECRET_KEY` (your platform account)
3. All existing sellers need to complete Stripe Connect onboarding
4. Checkout flow now uses `sellerId` instead of `accountType`

## Security Notes
- Seller account IDs are stored in `profiles.stripe_account_id`
- Never expose secret keys to the frontend
- Stripe handles all PCI compliance
- Platform fee is enforced server-side

## Troubleshooting

### Error: "Seller has not completed Stripe onboarding"
- Seller needs to complete Stripe Connect onboarding
- Use `createConnectAccount` to generate onboarding link

### Error: "Multiple Sellers"
- Checkout only supports one seller at a time
- Buyers must checkout items from one seller per transaction

### Error: "Stripe secret key not configured"
- Add `STRIPE_SECRET_KEY` to `backend/.env`
- Restart your backend server
