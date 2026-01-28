# Supabase Edge Function Deployment: `create-checkout-session`

This project uses a Supabase Edge Function to create a Stripe Hosted Checkout Session for subscription membership upgrades. The mobile app calls the Edge Function directly via `supabase.functions.invoke('create-checkout-session', ...)`.

## Prerequisites

- Supabase project ref: `tsrjtiunqbocmjgozeew` (from your dashboard URL, e.g. `https://supabase.com/dashboard/project/<ref>/...`)
- A Supabase **Access Token** (create one in your account tokens page: `https://supabase.com/dashboard/account/tokens`)
- Supabase CLI installed

## Install + Login (CLI)

```bash
sudo npm install -g supabase
supabase login
```

If you prefer not to use browser login, you can pass `--access-token` to each command below.

## Required Secrets (Cloud)

Set these secrets for the Supabase project environment:

- `STRIPE_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)
- `STRIPE_PRICE_ID_EARLY_BIRD_TRIAL` (Stripe Price ID for Early Bird trial)
- `STRIPE_PRICE_ID_STANDARD_MONTHLY` (Stripe Price ID for standard monthly subscription)

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
supabase secrets set STRIPE_PRICE_ID_EARLY_BIRD_TRIAL=price_... --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
supabase secrets set STRIPE_PRICE_ID_STANDARD_MONTHLY=price_... --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
```

## Deploy the Edge Function

From the repo root:

```bash
supabase functions deploy create-checkout-session --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
```

## Verify Deployment

```bash
supabase functions list --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
```

## Notes

- The function source lives at `supabase/functions/create-checkout-session/index.ts`.
- The function expects the caller to be authenticated (Supabase JWT in `Authorization: Bearer ...`).
- The mobile app invokes it from `app/(auth)/signup.tsx`.

---

# Supabase Edge Function Deployment: `create-subscription`

This project uses a Supabase Edge Function to create Stripe Checkout Sessions for two promotion types:
1. **FREE_TRIAL_AUTO_PAY**: 30-day free trial, then auto-charges $4.99/month
2. **LIFETIME_PROMO**: $0 one-time payment for lifetime membership (device-locked, non-transferable)

The mobile app calls the Edge Function directly via `supabase.functions.invoke('create-subscription', ...)`.

## Prerequisites

Same as `create-checkout-session` (see above).

## Required Secrets (Cloud)

Set these additional secrets for the Supabase project environment:

- `STRIPE_PRICE_ID_LIFETIME_FREE` (Stripe Price ID for $0 one-time payment - must be created in Stripe Dashboard as a $0 price)

```bash
supabase secrets set STRIPE_PRICE_ID_LIFETIME_FREE=price_... --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
```

**Note**: You must create a $0 one-time price in your Stripe Dashboard first:
1. Go to Stripe Dashboard → Products → Create Product
2. Set price to $0.00
3. Set billing to "One time"
4. Copy the Price ID (starts with `price_`)
5. Set it as the `STRIPE_PRICE_ID_LIFETIME_FREE` secret

## Database Migration Required

Before deploying, run the migration to add `device_id` column to `profiles` table:

```bash
# Run this SQL in Supabase SQL Editor
# File: backend/sql/add_device_id_to_profiles.sql
```

This migration:
- Adds `device_id text UNIQUE` column to `profiles` table
- Updates `membership_tier` constraint to include `'lifetime'` option
- Creates index for deviceId lookups

## Deploy the Edge Function

From the repo root:

```bash
supabase functions deploy create-subscription --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
```

## Verify Deployment```bash
supabase functions list --project-ref tsrjtiunqbocmjgozeew --access-token <YOUR_ACCESS_TOKEN>
```

## Request Format

```typescript
{
  userId: string;        // UUID of authenticated user
  metroName: string;     // Metro area name
  promoType: 'FREE_TRIAL_AUTO_PAY' | 'LIFETIME_PROMO';
  deviceId: string;      // Unique device identifier (required for both types)
  returnUrl?: string;   // Optional deep link URL for success/cancel
}
```

## Response Format

**FREE_TRIAL_AUTO_PAY:**
```typescript
{
  checkoutUrl: string;
  sessionId: string;
  promoType: 'FREE_TRIAL_AUTO_PAY';
}
```

**LIFETIME_PROMO:**
```typescript
{
  checkoutUrl: string;
  sessionId: string;
  promoType: 'LIFETIME_PROMO';
  deviceId: string;
}
```

## Error Responses

- `401`: Missing or invalid JWT token
- `400`: Missing required fields or invalid promoType
- `403`: User ID mismatch (authenticated user doesn't match userId in request)
- `404`: Profile not found
- `409`: Device ID already in use by another user (LIFETIME_PROMO only)
- `500`: Server configuration error or Stripe API error

## Notes

- The function source lives at `supabase/functions/create-subscription/index.ts`.
- The function expects the caller to be authenticated (Supabase JWT in `Authorization: Bearer ...`).
- **DeviceId validation**: For LIFETIME_PROMO, the function validates that the deviceId is not already in use by another user. This prevents transfer of lifetime memberships.
- **Lifetime membership**: After successful checkout, the profile is updated with `device_id` and `membership_tier: 'lifetime'`.
- **Trial period**: FREE_TRIAL_AUTO_PAY creates a subscription with `trial_period_days: 30`. Stripe will automatically charge $4.99/month after the trial ends.
- The function uses fetch-based Stripe API (consistent with `create-checkout-session`), not the Stripe SDK.