# Supabase Edge Function Deployment: `create-checkout-session`

This file describes two old Supabase Edge Functions. No app file calls `supabase.functions.invoke`. Membership amounts come from `SUBSCRIPTION_PRICES` in `backend/lib/fees.ts`. The store sheets charge the App Store and Play products. Do not deploy either function from this note. Do not set or unset a Stripe price id from this note.

Signed in, a PlateMaker plan and a PlateTaker plan on the web use `trpc.payments.createCheckoutSession`. That Worker route sends `price_data` from `membershipPriceCents`. On iOS and Android both roles use the store products. Signed out, both roles join from Membership. Web, iOS, and Android use the same source.

## `create-checkout-session`

The source is `supabase/functions/create-checkout-session/index.ts`. The app does not call it. `app/(auth)/signup.tsx` does not invoke it. Do not deploy it from this note.

## `create-subscription`

The source is `supabase/functions/create-subscription/index.ts`. On 9 November 2026 a free-trial request and a lifetime request both return status 410 and do not call Stripe. The function does not read `STRIPE_PRICE_ID_STANDARD_MONTHLY` or `STRIPE_PRICE_ID_LIFETIME_FREE`. Do not deploy it from this note. The copy already on Supabase stays as it is until a later deploy, and this note is not that deploy.

This change is local until `main` is published.
