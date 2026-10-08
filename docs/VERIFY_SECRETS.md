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

After verification, you should see these **standardized** secrets:

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

- [ ] `STRIPE_PRICE_ID_MONTHLY` is set (not `STRIPE_PRICE_ID_STANDARD_MONTHLY`)
- [ ] No secrets with "STANDARD" in the name exist
- [ ] `STRIPE_SECRET_KEY` is set
- [ ] `SUBSCRIPTION_PRICE_MONTHLY` is set to `4.99`
- [ ] `SUBSCRIPTION_PRICE_ANNUAL` is set to `39.99`
- [ ] `STRIPE_PRICE_ID_LIFETIME_FREE` is set (if using lifetime promotions)

## Setting Missing Secrets

If any secrets are missing, set them using:

```bash
test -n "$SUPABASE_ACCESS_TOKEN" || exit 1

# Monthly subscription price ID
npx --yes supabase@2.120.0 secrets set STRIPE_PRICE_ID_MONTHLY=price_xxxxx --project-ref tsrjtiunqbocmjgozeew

# Subscription price constants
npx --yes supabase@2.120.0 secrets set SUBSCRIPTION_PRICE_MONTHLY=4.99 --project-ref tsrjtiunqbocmjgozeew
npx --yes supabase@2.120.0 secrets set SUBSCRIPTION_PRICE_ANNUAL=39.99 --project-ref tsrjtiunqbocmjgozeew

# Lifetime free price ID (after creating $0 product in Stripe)
npx --yes supabase@2.120.0 secrets set STRIPE_PRICE_ID_LIFETIME_FREE=price_xxxxx --project-ref tsrjtiunqbocmjgozeew
```

## Removing Old Secrets

If you find old `STRIPE_PRICE_ID_STANDARD_MONTHLY`, remove it:

```bash
test -n "$SUPABASE_ACCESS_TOKEN" || exit 1
npx --yes supabase@2.120.0 secrets unset STRIPE_PRICE_ID_STANDARD_MONTHLY --project-ref tsrjtiunqbocmjgozeew
```

## Troubleshooting

**Issue**: Old "STANDARD" keys still exist
- **Solution**: Remove them using `supabase secrets unset` command above

**Issue**: Secrets not found in Edge Functions
- **Solution**: Redeploy the Edge Functions after setting secrets:
  ```bash
  test -n "$SUPABASE_ACCESS_TOKEN" || exit 1
  npx --yes supabase@2.120.0 functions deploy create-checkout-session --project-ref tsrjtiunqbocmjgozeew
  npx --yes supabase@2.120.0 functions deploy create-subscription --project-ref tsrjtiunqbocmjgozeew
  ```

**Issue**: Function returns "Price ID not configured"
- **Solution**: Verify the secret name matches exactly (case-sensitive) and redeploy the function
