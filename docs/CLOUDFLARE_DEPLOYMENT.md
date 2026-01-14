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
```

Each command will prompt you to enter the value.

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

### Update Your App's API Endpoint

Update your frontend environment variable to point to the Cloudflare Worker:

```bash
# In your .env or Expo environment
EXPO_PUBLIC_RORK_API_BASE_URL=https://plate-marketplace-api.YOUR_SUBDOMAIN.workers.dev
```

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
4. **KV Storage**: Distributed rate limiting across all edge locations
5. **Free Tier**: 100,000 requests/day free

### How Rate Limiting Works

- Uses Cloudflare KV for distributed storage
- IP addresses are tracked using `cf-connecting-ip` header (real client IP)
- Automatic TTL cleanup (no manual maintenance)
- Scales globally without configuration

### Security Features

1. **IP-based Rate Limiting**
   - Global: 100 requests/minute
   - Auth endpoints: 10 requests/minute

2. **Stripe Webhook Verification**
   - HMAC-SHA256 signature validation
   - Prevents unauthorized order creation

3. **Secure Headers**
   - CSP, HSTS, X-Frame-Options
   - XSS and clickjacking protection

4. **CORS Configuration**
   - Allows all origins (customize in backend/hono.ts if needed)

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
