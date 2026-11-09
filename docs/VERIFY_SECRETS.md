# Standardized Secret Verification

This guide helps you verify that all Supabase secrets are correctly configured with standardized naming.

## Quick Verification

Run these commands to verify your secrets are properly configured:

`SUPABASE_ACCESS_TOKEN` must already be set in the shell. Do not paste a token here, and do not run a bare `npx supabase`. That opens the macOS keychain prompt. See `.cursor/rules/supabase-cli.mdc`.

```bash
test -n "$SUPABASE_ACCESS_TOKEN" || exit 1

# List all secrets and filter for Stripe/Subscription related ones
npx --yes supabase@2.120.0 secrets list --project-ref tsrjtiunqbocmjgozeew | grep -E "(STRIPE_PRICE_ID|SUBSCRIPTION_PRICE|STRIPE_SECRET)"

# Verify no old "STANDARD" keys exist (should return empty)
npx --yes supabase@2.120.0 secrets list --project-ref tsrjtiunqbocmjgozeew | grep "STANDARD"
```

## Expected Secrets

The price-id names below are not read by the running app. Do not add them from this list. After verification, older notes expected these names:

### Required Stripe Secrets
- ✅ `STRIPE_SECRET_KEY` - Your Stripe secret key (starts with `sk_test_` or `sk_live_`)
- ✅ `STRIPE_PRICE_ID_MONTHLY` - Monthly subscription price ID (replaces old `STRIPE_PRICE_ID_STANDARD_MONTHLY`)
- ⚠️ `STRIPE_PRICE_ID_LIFETIME_FREE` - $0 lifetime product price ID (set after creating product in Stripe)
- ⚠️ `STRIPE_PRICE_ID_EARLY_BIRD_TRIAL` - Early Bird trial price ID (optional, for trial promotions)

### Subscription Price Constants
- ✅ `SUBSCRIPTION_PRICE_MONTHLY` - Monthly price value (e.g., `4.99`)
- ✅ `SUBSCRIPTION_PRICE_ANNUAL` - Annual price value (e.g., `39.99`)

### Supabase Secrets (Auto-configured)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_ANON_KEY` - Anonymous key for client-side operations
- `SUPABASE_DB_URL` - Database connection URL

## Verification Checklist

Retired 8 November 2026. The running app does not read `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_STANDARD_MONTHLY`, `STRIPE_PRICE_ID_STANDARD_ANNUAL`, `STRIPE_PRICE_ID_LIFETIME_FREE`, `STRIPE_PRICE_ID_EARLY_BIRD_TRIAL`, `SUBSCRIPTION_PRICE_MONTHLY`, or `SUBSCRIPTION_PRICE_ANNUAL`. Membership amounts come from `SUBSCRIPTION_PRICES` in `backend/lib/fees.ts`. Store membership uses the App Store and Play products. Do not set or unset those names from this file.

## Setting Missing Secrets

Do not set `STRIPE_PRICE_ID_MONTHLY`, `SUBSCRIPTION_PRICE_MONTHLY`, `SUBSCRIPTION_PRICE_ANNUAL`, or `STRIPE_PRICE_ID_LIFETIME_FREE` from this file. The running app does not read them.

## Old price-id names

Do not unset `STRIPE_PRICE_ID_STANDARD_MONTHLY` from this note. `backend/lib/fees.ts` still names it, and nothing in the running app reads that name. The unused edge function `create-subscription` still reads it if that function is invoked. No app file calls `supabase.functions.invoke`.

## Troubleshooting

**Issue**: Old "STANDARD" keys still exist
- **Solution**: Leave them. Do not unset them from this note.

**Issue**: Secrets not found in Edge Functions
- **Solution**: Do not redeploy `create-checkout-session` or `create-subscription` from this note. No app file calls them.

**Issue**: Function returns "Price ID not configured"
- **Solution**: Verify the secret name matches exactly (case-sensitive) and redeploy the function
