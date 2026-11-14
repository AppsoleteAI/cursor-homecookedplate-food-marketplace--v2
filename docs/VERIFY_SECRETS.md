# Standardized Secret Verification

This guide helps you verify that all Supabase secrets are correctly configured with standardized naming.

## Quick Verification

Run these commands to verify your secrets are properly configured:

`SUPABASE_ACCESS_TOKEN` must already be set in the shell. Do not paste a token here, and do not run a bare `npx supabase`. That opens the macOS keychain prompt. See `.cursor/rules/supabase-cli.mdc`.

```bash
test -n "$SUPABASE_ACCESS_TOKEN" || exit 1

# List all secrets and filter for Stripe/Subscription related ones
npx --yes supabase@2.120.0 secrets list --project-ref tsrjtiunqbocmjgozeew | grep -E "(STRIPE_PRICE_ID|SUBSCRIPTION_PRICE|STRIPE_SECRET)"

# List older STANDARD names. Leave them. Do not unset them from this file.
npx --yes supabase@2.120.0 secrets list --project-ref tsrjtiunqbocmjgozeew | grep "STANDARD"
```

## Expected Secrets

The price-id names below are not read by the running app. Do not add them from this list. After verification, older notes expected these names:

### Required Stripe Secrets
- ✅ `STRIPE_SECRET_KEY` - Stripe secret key on the Worker `plate-marketplace-api`. Do not paste the value here.
- `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_STANDARD_MONTHLY`, `STRIPE_PRICE_ID_STANDARD_ANNUAL`, `STRIPE_PRICE_ID_LIFETIME_FREE`, and `STRIPE_PRICE_ID_EARLY_BIRD_TRIAL` are not read by the running app. Do not set them from this file.

### Subscription Price Constants
- `SUBSCRIPTION_PRICE_MONTHLY` and `SUBSCRIPTION_PRICE_ANNUAL` are not read by the running app. Amounts stay in `SUBSCRIPTION_PRICES` in `backend/lib/fees.ts`. Do not set them from this file.

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

Do not unset `STRIPE_PRICE_ID_STANDARD_MONTHLY` from this note. `backend/lib/fees.ts` still names it, and nothing in the running app reads that name. The local `create-subscription` source returns status 410 and does not read it. No app file calls `supabase.functions.invoke`. Do not deploy that function from this note.

## Troubleshooting

**Issue**: Old "STANDARD" keys still exist
- **Solution**: Leave them. Do not unset them from this note.

**Issue**: Secrets not found in Edge Functions
- **Solution**: Do not redeploy `create-checkout-session` or `create-subscription` from this note. No app file calls them.

**Issue**: Function returns "Price ID not configured"
- **Solution**: Leave it. The local `create-subscription` source returns status 410 and does not read a price id. Do not set a price id from this note, and do not redeploy the function.
