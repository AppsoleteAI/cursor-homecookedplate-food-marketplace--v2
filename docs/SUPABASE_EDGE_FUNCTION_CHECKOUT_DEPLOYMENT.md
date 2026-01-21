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

