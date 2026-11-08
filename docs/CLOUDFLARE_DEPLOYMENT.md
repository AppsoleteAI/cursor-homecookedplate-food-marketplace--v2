# Cloudflare Workers Deployment Guide

This guide covers deploying your Hono backend to Cloudflare Workers for production use.

## Prerequisites

1. Cloudflare account (free tier works)
2. Wrangler CLI installed (already in package.json)
3. Node.js 18+ or Bun

## Setup Steps

### 1. Authenticate Wrangler

```bash
npx wrangler login
```

This opens your browser to authenticate with Cloudflare.

### 2. Create KV Namespaces

KV (Key-Value) storage is used for distributed rate limiting.

```bash
# Production namespace
npx wrangler kv:namespace create RATE_LIMIT_KV

# Preview namespace (for testing)
npx wrangler kv:namespace create RATE_LIMIT_KV --preview
```

**Important:** Copy the namespace IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your_production_namespace_id_here"
preview_id = "your_preview_namespace_id_here"
```

### 3. Configure Environment Variables

Set your secrets in Cloudflare (these are encrypted):

```bash
# Supabase credentials
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Stripe credentials
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET

# Resend Email Service (for production email delivery)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put OFFICIAL_EMAIL_FROM
```

Each command will prompt you to enter the value.

**Note for OFFICIAL_EMAIL_FROM:** Use the format `"Display Name <email@verified-domain.com>"` (e.g., `"HomeCookedPlate <notifications@homecookedplate.com>"`). The domain must be verified in your Resend dashboard.

### 4. Deploy to Production

```bash
npx wrangler deploy
```

Your API will be deployed to: `https://plate-marketplace-api.YOUR_SUBDOMAIN.workers.dev`

### 5. Deploy to Staging (Optional)

```bash
npx wrangler deploy --env staging
```

Staging URL: `https://plate-marketplace-api-staging.YOUR_SUBDOMAIN.workers.dev`

## Post-Deployment Configuration

### App API endpoint

The tRPC client in `lib/trpc.ts` is hardcoded to `https://homecookedplate.pages.dev`. Do not set `EXPO_PUBLIC_RORK_API_BASE_URL`. When `https://homecookedplate.com/api/trpc` is live, change that constant in `lib/trpc.ts`.

### Configure Stripe Webhook

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://plate-marketplace-api.YOUR_SUBDOMAIN.workers.dev/webhook/stripe`
4. Select events: `payment_intent.succeeded`
5. Copy the webhook signing secret
6. Update in Cloudflare:
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

## Monitoring & Debugging

### View Live Logs

```bash
npx wrangler tail
```

This streams logs in real-time from your deployed worker.

### View Logs in Dashboard

1. Go to: https://dash.cloudflare.com/
2. Navigate to: Workers & Pages
3. Click on your worker
4. Go to "Logs" tab

### Check Metrics

Cloudflare provides built-in analytics:
- Request count
- Error rate
- Response time
- Bandwidth usage

## Architecture Benefits

### Why Cloudflare Workers?

1. **Global Edge Network**: Your API runs in 300+ cities worldwide
2. **Zero Cold Starts**: Unlike serverless functions, Workers start instantly
3. **Built-in DDoS Protection**: Cloudflare's network handles attacks
4. **Rate limit binding**: The 100-a-minute and 10-a-minute counters are shared across isolates and do not write KV
5. **Free Tier**: 100,000 requests/day free

### How Rate Limiting Works

- `API_RATE_LIMIT` counts 100 requests a minute for one IP, shared across isolates
- `AUTH_RATE_LIMIT` counts 10 requests a minute for sign-in, account creation, password reset, email confirmation, and reactivation
- Ordinary requests do not write KV
- When the auth binding is missing, those routes use KV. A daily write cap falls back to memory and logs `KV_DAILY_WRITE_CAP`
- IP addresses are tracked using `cf-connecting-ip` (the client address Cloudflare sets)
- Deployed 7 November 2026 as `plate-marketplace-api`, version `202d29a1-8559-4d01-8da3-58526873e797`. The 5 November rate-limit version was `e48ba812-f010-4bfc-8e55-61e41b99d101`. The 5 November crash-reporter live version was `57626efa-5136-42bc-950a-6d212c5eec72`, with the secret `SENTRY_DSN`. Existing secrets stayed in place. `API_RATE_LIMIT` is 100 requests a minute. `AUTH_RATE_LIMIT` is 10 requests a minute. Both are shared across isolates. Five checks of `/` and `/health` each returned 200.
- The monitor **KV daily write cap** was saved 5 November 2026. It checks Workers Logs every 1 minute. It emails `support@homecookedplate.com` when the count of `plate-marketplace-api` rows whose message contains `KV_DAILY_WRITE_CAP`, averaged over 1 minute, is above 0. The preview was flat at 0 before save. Signed in, that one email covers a PlateMaker and a PlateTaker. Signed out, it covers sign-in. Web, iOS, and Android use this Worker.

### Security Features

1. **IP-based Rate Limiting**
   - Ordinary traffic: 100 requests a minute, shared when `API_RATE_LIMIT` is bound
   - Sign-in and account routes: 10 requests a minute, shared when `AUTH_RATE_LIMIT` is bound

2. **Stripe Webhook Verification**
   - HMAC-SHA256 signature validation
   - The signature compare is constant-time
   - Prevents unauthorized order creation

3. **Secure Headers**
   - CSP, HSTS, X-Frame-Options
   - XSS and clickjacking protection

4. **CORS Configuration**
   - Production allows `https://homecookedplate.com`, `https://www.homecookedplate.com`, `https://homecookedplate.pages.dev`, `https://homecookedplate-marketplace.vercel.app`, and `http://localhost` or `http://127.0.0.1`
   - Production does not allow `*.expo.dev` or `*.exp.direct`
   - Production does not allow a request that has no Origin
   - The bearer token is not a cookie. A signed-in PlateMaker and a signed-in PlateTaker send that token on kitchen, home, and order calls. Signed out, both roles call the same API without a session. Web, iOS, and Android use this Worker. The phones do not use the Origin header. This change is local until the Worker is deployed. This turn did not deploy.

`example.hi`, `supabase.test`, `health.check`, and `system.dbHealth` are not on the router. Signed in or signed out, a PlateMaker and a PlateTaker cannot call them. The profile count and database error text are not returned. This is the same Worker source. It is local until that Worker is deployed.

## Troubleshooting

### Error: "KV namespace not found"

Make sure you created the KV namespace and updated the IDs in `wrangler.toml`.

### Error: "Missing environment variables"

Set all required secrets:
```bash
npx wrangler secret list
```

Should show:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- OFFICIAL_EMAIL_FROM

### Webhook Not Working

1. Check webhook URL in Stripe dashboard
2. Verify webhook secret is set correctly
3. Check logs: `npx wrangler tail`
4. Test locally: `npx wrangler dev` (then use Stripe CLI to forward events)

### Rate Limiting Not Working

1. Verify KV namespace is bound correctly in `wrangler.toml`
2. Check logs for "KV namespace not available" warnings
3. Ensure namespace IDs match your created namespaces

## Local Development

Test your worker locally before deploying:

```bash
npx wrangler dev
```

This starts a local server with hot reload at `http://localhost:8787`

**Note:** Local development uses a different KV namespace (preview), so rate limiting data won't persist to production.

## Cost Estimation

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request
- Unlimited KV reads
- 1,000 KV writes/day

For most apps, this is sufficient. Paid plans start at $5/month for 10M requests.

## Migration from @hono/node-server

The migration is complete! Key changes:

1. ✅ Removed in-memory Map (not suitable for distributed workers)
2. ✅ Added Cloudflare KV for distributed rate limiting
3. ✅ Updated IP detection to use `cf-connecting-ip`
4. ✅ Added TypeScript types for Cloudflare Workers
5. ✅ Configured wrangler.toml for deployment

## Next Steps

1. Deploy to Cloudflare: `npx wrangler deploy`
2. Update frontend API URL in environment variables
3. Configure Stripe webhook with your Worker URL
4. Test payment flow end-to-end
5. Monitor logs with `npx wrangler tail`

## Support

- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Hono Docs: https://hono.dev/getting-started/cloudflare-workers
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
