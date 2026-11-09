/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { createSupabaseAdmin } from "./lib/supabase";
import { logAdminAlert } from "./lib/alerts";
import { sendExpoPushNotification } from "./lib/expo-push-notifications";
import { listedPlateMetadata, recordPlatePayment } from "./lib/record-paid-order";
import { handleChargeDispute, handleConnectWebhook, handleLostDispute, releaseDuePayouts } from "./lib/stripe-marketplace";
import { connectReturnHtml, createAccountLink } from "./lib/connect-account";
import { readAppleServerNotification } from "./lib/apple-transaction";
import { applyAppleNotification, writeResolvedTier } from "./lib/store-membership";
import type { MediaFrameBinding } from "./lib/image-security";
import { alertKvWriteCap } from "./lib/kv-write-cap";
import { limitRequest, type SharedLimiter } from "./lib/request-limit";
import { limitBody } from "./lib/body-limit";
import { assignRequestId, REQUEST_ID_HEADER } from "./lib/request-id";
import { recordOperationalFailure } from "./lib/failure-alert";
import { reportWorkerCrash, workerSentryDsn } from "./lib/worker-sentry";
import { apiIsProduction, productionApiOrigin } from "./lib/api-origin";
import { sameSecret } from "./lib/same-secret";

type Bindings = {
  RATE_LIMIT_KV?: KVNamespace;
  API_RATE_LIMIT?: SharedLimiter;
  AUTH_RATE_LIMIT?: SharedLimiter;
  ENVIRONMENT?: string;
  SUPABASE_URL?: string;
  SUPABASE_READ_REPLICA_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CONNECT_WEBHOOK_SECRET?: string;
  METRO_WEBHOOK_SECRET?: string;
  // Cloudflare Workers AI binding for image NSFW moderation
  AI?: Ai;
  // Still frames from uploaded meal videos
  MEDIA?: MediaFrameBinding;
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?: string;
  ASC_API_KEY_ID?: string;
  ASC_API_ISSUER_ID?: string;
  ASC_API_PRIVATE_KEY?: string;
  SENTRY_DSN?: string;
  EXPO_PUBLIC_SENTRY_DSN?: string;
  RESEND_API_KEY?: string;
  OFFICIAL_EMAIL_FROM?: string;
  EXPO_PUBLIC_WEB_URL?: string;
  EXPO_ACCESS_TOKEN?: string;
};

const WORKER_PROCESS_ENV = [
  'RESEND_API_KEY',
  'OFFICIAL_EMAIL_FROM',
  'EXPO_PUBLIC_WEB_URL',
  'EXPO_ACCESS_TOKEN',
  'STRIPE_SECRET_KEY',
] as const;

function applyWorkerEnv(env: Bindings | undefined) {
  if (!env) return;
  for (const name of WORKER_PROCESS_ENV) {
    const value = env[name];
    if (typeof value === 'string' && value) process.env[name] = value;
  }
}

export const app = new Hono<{ Bindings: Bindings }>();

const BUSY_MESSAGE = "Our kitchen is a bit busy right now. Please try again in a moment!";

function isCredentialPath(path: string): boolean {
  return /\/auth\.(login|signup|resetPassword|resendVerificationEmail|verifyEmail|reactivateAccount)(?:\?|$)/.test(path);
}

async function sendCapAlert(env: Bindings | undefined): Promise<void> {
  const url = env?.SUPABASE_URL;
  const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  try {
    const admin = createSupabaseAdmin({
      SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    });
    await alertKvWriteCap(admin);
  } catch {
    console.error("[Rate Limit] Cap alert was not sent");
  }
}

const rateLimit = (scope: "api" | "auth") => limitRequest(scope, {
  onWriteCap: (env) => {
    void sendCapAlert(env as Bindings | undefined);
  },
});

// CORS is first so an OPTIONS preflight is answered before the tRPC routes.
// Production allows the website origins. Expo tunnel hosts are for a non-production Worker.
app.use(
  '/api/trpc/*',
  cors({
    origin: (origin, c) => productionApiOrigin(origin, apiIsProduction(c.env)),
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
    exposeHeaders: ['Content-Length', REQUEST_ID_HEADER],
    maxAge: 600,
    credentials: true,
  })
);

app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    xXssProtection: "1; mode=block",
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
    },
  })
);

app.use("*", assignRequestId());

app.use("*", rateLimit("api"));

const credentialLimit = rateLimit("auth");

app.use("/api/trpc/*", async (c, next) => {
  if (!isCredentialPath(c.req.path)) {
    await next();
    return;
  }
  return credentialLimit(c, next);
});

app.use("/api/auth/*", credentialLimit);

app.use("*", limitBody());

async function noteFailure(env: Bindings | undefined, kind: 'payment_error' | 'webhook_error' | 'security_alert', message: string) {
  const supabaseUrl = env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return;
  try {
    const admin = createSupabaseAdmin({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
    });
    await recordOperationalFailure(kind, message, admin);
  } catch {
    console.error('[Alerts] Failure was not recorded.');
  }
}

async function syncStripeMembership(
  admin: ReturnType<typeof createSupabaseAdmin>,
  customerId: string,
  subscriptionId: string | null,
): Promise<'ok' | 'missing' | 'error'> {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, apple_expires_at, apple_revoked_at, google_purchase_token, google_expires_at')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (error) {
    console.error('[Stripe Webhook] Could not read the membership profile:', error.message);
    return 'error';
  }
  if (!profile) {
    console.warn('[Stripe Webhook] No profile found for customer:', customerId);
    return 'missing';
  }
  const next = { ...profile, stripe_subscription_id: subscriptionId };
  const saved = await admin.from('profiles').update({
    stripe_subscription_id: subscriptionId,
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  if (saved.error) {
    console.error('[Stripe Webhook] Could not save the Stripe subscription:', saved.error.message);
    return 'error';
  }
  await writeResolvedTier(admin, next);
  return 'ok';
}

async function stripeSignatureMatches(signedPayload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return sameSecret(computedSignature, signature);
}

app.post("/webhook/stripe", async (c) => {
  const webhookSecret = c.env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const connectWebhookSecret = c.env?.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('[Stripe Webhook] Missing environment variables');
    await noteFailure(c.env, 'webhook_error', 'Stripe webhook is missing its server configuration.');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const payload = await c.req.text();
  const sig = c.req.header('stripe-signature');

  if (!sig) {
    console.error('[Stripe Webhook] Missing signature');
    await noteFailure(c.env, 'webhook_error', 'Stripe webhook arrived without a signature.');
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event;
  try {
    const timestamp = sig.split(',').find(s => s.startsWith('t='))?.split('=')[1];
    const signature = sig.split(',').find(s => s.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !signature) {
      throw new Error('Invalid signature format');
    }

    const signedPayload = `${timestamp}.${payload}`;
    const secrets = [webhookSecret, connectWebhookSecret].filter((value): value is string => !!value);
    let verified = false;
    for (const secret of secrets) {
      if (await stripeSignatureMatches(signedPayload, signature, secret)) {
        verified = true;
        break;
      }
    }
    if (!verified) {
      console.error('[Stripe Webhook] Signature verification failed');
      await noteFailure(c.env, 'security_alert', 'Stripe webhook signature was rejected.');
      return c.json({ error: 'Invalid signature' }, 400);
    }

    const eventTimestamp = Number(timestamp);
    if (!Number.isFinite(eventTimestamp) || Math.abs(Date.now() / 1000 - eventTimestamp) > 300) {
      console.error('[Stripe Webhook] Timestamp outside tolerance');
      await noteFailure(c.env, 'security_alert', 'Stripe webhook timestamp was outside tolerance.');
      return c.json({ error: 'Timestamp outside tolerance' }, 400);
    }

    event = JSON.parse(payload);
  } catch (err) {
    console.error('[Stripe Webhook] Verification error:', err);
    await noteFailure(c.env, 'webhook_error', 'Stripe webhook could not be verified.');
    return c.json({ error: 'Webhook error' }, 400);
  }

  console.log('[Stripe Webhook] Event received:', event.type);

  // Create Supabase admin client for all webhook operations
  const supabaseAdmin = createSupabaseAdmin({ SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey });

  // Handle payment intent events (existing logic)
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const paymentIntentId = paymentIntent.id;

    console.log('[Stripe Webhook] Payment succeeded:', paymentIntentId);

    // Use centralized admin client (supabaseAdmin) which uses Service Role Key
    // Perform a single atomic update for all orders with this payment_intent_id
    try {
      const listed = listedPlateMetadata(paymentIntent.metadata);
      const updated = await recordPlatePayment(supabaseAdmin, {
        paymentIntentId,
        chargeId: paymentIntent.latest_charge || paymentIntent.charges?.data?.[0]?.id || null,
        transferId: paymentIntent.charges?.data?.[0]?.transfer || null,
        applicationFeeId: paymentIntent.charges?.data?.[0]?.application_fee?.id || null,
        currency: paymentIntent.currency || 'usd',
        deliveryFee: Number(paymentIntent.metadata?.delivery_fee ?? 0),
        amountCents: paymentIntent.amount,
        listedOrderIds: listed.listedOrderIds,
        listedBaseCents: listed.listedBaseCents,
        stripeSecretKey: c.env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY,
      });
      if (updated === 0) {
        console.warn('[Stripe Webhook] Payment was not applied to a plate order:', paymentIntentId);
      } else {
        console.log('[Stripe Webhook] Marked', updated, 'order(s) paid. The cook still accepts.');
      }
    } catch (updateError) {
      console.error('[Stripe Webhook] Error updating orders:', updateError);
      await recordOperationalFailure('payment_error', 'A paid plate could not be recorded from the Stripe webhook.', supabaseAdmin);
      return c.json({ error: 'Database error' }, 500);
    }
  }

  // Handle subscription events for membership management
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const status = subscription.status;
    const active = event.type !== 'customer.subscription.deleted' && (status === 'active' || status === 'trialing');
    console.log('[Stripe Webhook] Subscription', event.type, subscription.id, 'status:', status);
    const synced = await syncStripeMembership(supabaseAdmin, customerId, active ? subscription.id : null);
    if (synced === 'error') {
      await recordOperationalFailure('payment_error', 'Stripe membership could not be saved from the webhook.', supabaseAdmin);
      return c.json({ error: 'Database error' }, 500);
    }
  }

  if (event.type === 'customer.subscription.trial_will_end') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const trialEnd = subscription.trial_end;

    console.log('[Stripe Webhook] Trial ending soon for subscription:', subscription.id, 'trial ends:', new Date(trialEnd * 1000).toISOString());

    // Find profile to get user info for notification and push token
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username, expo_push_token, metro_area')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile) {
      // Create database notification for user
      const trialEndDate = new Date(trialEnd * 1000).toLocaleDateString();
      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: profile.id,
          title: 'Free Trial Ending Soon',
          body: `Your free trial ends in 3 days. Your card will be charged $4.99 on ${trialEndDate}.`,
          type: 'subscription',
          read: false,
        });

      if (notificationError) {
        console.error('[Stripe Webhook] Error creating database notification for user:', profile.id, notificationError);
      } else {
        console.log('[Stripe Webhook] Created trial ending notification for user:', profile.id);
      }

      // Send Expo push notification if push token exists
      if (profile.expo_push_token) {
        const metroArea = profile.metro_area || 'your area';
        try {
          const pushSent = await sendExpoPushNotification(profile.expo_push_token, {
            title: "Your Trial is Almost Up! ⏳",
            body: `Your 90-day Early Bird trial in ${metroArea} ends in 3 days. No action needed to keep your premium access!`,
            data: {
              type: 'trial_ending',
              subscriptionId: subscription.id,
            },
          });

          if (pushSent) {
            console.log('[Stripe Webhook] Sent push notification for trial ending to user:', profile.id);
          } else {
            console.warn('[Stripe Webhook] Failed to send push notification for trial ending to user:', profile.id);
          }
        } catch (pushError) {
          console.error('[Stripe Webhook] Error sending push notification for trial ending to user:', profile.id, pushError);
        }
      } else {
        console.log('[Stripe Webhook] No expo_push_token found for user:', profile.id, '- skipping push notification');
      }
    }
  }

  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
    const stripeSecretKey = c.env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[Stripe Webhook] Missing Stripe key for dispute');
      await recordOperationalFailure('payment_error', 'A card dispute arrived without a Stripe key on the Worker.', supabaseAdmin);
      return c.json({ error: 'Server configuration error' }, 500);
    }
    try {
      if (event.type === 'charge.dispute.created') {
        await handleChargeDispute(supabaseAdmin, stripeSecretKey, event.data.object);
      } else {
        await handleLostDispute(supabaseAdmin, stripeSecretKey, event.data.object);
      }
    } catch (disputeError) {
      console.error('[Stripe Webhook] Dispute handling failed:', disputeError);
      await recordOperationalFailure('payment_error', 'A card dispute could not be recorded.', supabaseAdmin);
      return c.json({ error: 'Dispute handling failed' }, 500);
    }
  }

  if (
    event.type === 'account.updated'
    || event.type === 'transfer.created'
    || event.type === 'transfer.failed'
    || event.type === 'payout.paid'
    || event.type === 'payout.failed'
  ) {
    const connectResult = await handleConnectWebhook(supabaseAdmin, event);
    if (connectResult === 'error') {
      await recordOperationalFailure('payment_error', 'A Stripe Connect payout event could not be saved.', supabaseAdmin);
      return c.json({ error: 'Connect event failed' }, 500);
    }
  }

  return c.json({ received: true });
});

app.post("/webhook/apple", async (c) => {
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Apple Webhook] Missing environment variables');
    await noteFailure(c.env, 'webhook_error', 'App Store webhook is missing its server configuration.');
    return c.json({ error: 'Server configuration error' }, 500);
  }
  let signedPayload = '';
  try {
    const body = await c.req.json() as { signedPayload?: unknown };
    signedPayload = typeof body.signedPayload === 'string' ? body.signedPayload : '';
  } catch {
    return c.json({ error: 'App Store notification could not be read' }, 400);
  }
  if (signedPayload.length < 40) {
    return c.json({ error: 'App Store notification could not be read' }, 400);
  }
  const supabaseAdmin = createSupabaseAdmin({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
  });
  try {
    const note = readAppleServerNotification(signedPayload);
    await applyAppleNotification(supabaseAdmin, note);
  } catch (error) {
    console.error('[Apple Webhook] Notification was not applied.', error instanceof Error ? error.message : error);
    await recordOperationalFailure('webhook_error', 'App Store notification was not applied.', supabaseAdmin);
    return c.json({ error: 'App Store notification was not applied' }, 400);
  }
  return c.json({ received: true });
});

// Database webhook endpoint for metro cap reached notifications
// Triggered by Supabase Database Webhooks when metro_area_counts.platemaker_count or platetaker_count hits max_cap
app.post("/webhook/metro-cap-reached", async (c) => {
  const metroWebhookSecret = c.env?.METRO_WEBHOOK_SECRET || process.env.METRO_WEBHOOK_SECRET;
  const providedSecret = c.req.header('x-metro-webhook-secret');
  if (!metroWebhookSecret || !providedSecret || !sameSecret(providedSecret, metroWebhookSecret)) {
    console.error('[Metro Cap Webhook] Missing or invalid webhook secret');
    await noteFailure(c.env, 'security_alert', 'Metro webhook secret was rejected.');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Metro Cap Webhook] Missing environment variables');
    await noteFailure(c.env, 'webhook_error', 'Metro cap webhook is missing its server configuration.');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  // Create Supabase admin client for webhook operations
  const supabaseAdmin = createSupabaseAdmin({ SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey });

  try {
    const payload = await c.req.json();
    
    // Supabase Database Webhooks send payload with 'type' and 'record' fields
    // Expected payload: { type: 'UPDATE', record: { metro_name, platemaker_count, platetaker_count, max_cap }, old_record: {...} }
    const { type, record, old_record } = payload;

    if (type !== 'UPDATE' || !record) {
      console.warn('[Metro Cap Webhook] Invalid payload type or missing record:', { type, hasRecord: !!record });
      return c.json({ received: true, message: 'Ignored - not an UPDATE event' });
    }

    const metroName = record.metro_name;
    const platemakerCount = record.platemaker_count;
    const platetakerCount = record.platetaker_count;
    const maxCap = record.max_cap || 100;
    const oldPlatemakerCount = old_record?.platemaker_count || 0;
    const oldPlatetakerCount = old_record?.platetaker_count || 0;

    // Check if platemaker_count or platetaker_count just hit max_cap
    const makerHitCap = platemakerCount === maxCap && oldPlatemakerCount < maxCap;
    const takerHitCap = platetakerCount === maxCap && oldPlatetakerCount < maxCap;

    if (!makerHitCap && !takerHitCap) {
      // Not a cap-reached event, ignore
      return c.json({ received: true, message: 'Count not at cap' });
    }

    console.log(`[Metro Cap Webhook] Metro "${metroName}" reached cap:`, {
      makerHitCap,
      takerHitCap,
      platemakerCount,
      platetakerCount,
      maxCap,
    });

    // Source of Truth: Log to admin_system_alerts table (all system notifications must go here)
    const roles = [];
    if (makerHitCap) roles.push('Platemakers');
    if (takerHitCap) roles.push('Platetakers');
    
    const alertMessage = `Metro "${metroName}" has reached the maximum capacity (${maxCap}/${maxCap}) for ${roles.join(' and ')}.`;
    
    // Use standard utility for consistent alert formatting
    await logAdminAlert('metro_cap_reached', alertMessage, {
      severity: 'high',
      title: `City Max Alert: ${metroName}`,
      metadata: {
        metro_name: metroName,
        platemaker_count: platemakerCount,
        platetaker_count: platetakerCount,
        max_cap: maxCap,
        platemaker_hit_cap: makerHitCap,
        platetaker_hit_cap: takerHitCap,
        timestamp: new Date().toISOString(),
      },
    }, supabaseAdmin);

    return c.json({ received: true, message: 'Metro cap notification processed' });
  } catch (error) {
    console.error('[Metro Cap Webhook] Error processing webhook:', error);
    await recordOperationalFailure('webhook_error', 'Metro cap webhook could not be processed.', supabaseAdmin);
    return c.json({ error: 'Webhook processing error' }, 500);
  }
});

// tRPC server middleware - THE FIX: Destructure both the tRPC opts AND the Hono context 'c'
app.use(
  '/api/trpc/*',
  trpcServer({
    endpoint: '/api/trpc', // Explicitly set the endpoint to match the Hono route
    router: appRouter,
    // THE FIX: Destructure both the tRPC opts AND the Hono context 'c'
    createContext: async (opts, c) => {
      // Passes Cloudflare secrets (c.env) or local .env (process.env)
      // Note: If you are using Bun locally, c.env might be empty, so we use the ?? operator to fall back to process.env
      const env = {
        SUPABASE_URL: c.env?.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
        SUPABASE_READ_REPLICA_URL: c.env?.SUPABASE_READ_REPLICA_URL,
        SUPABASE_SERVICE_ROLE_KEY: c.env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: c.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        EXPO_PUBLIC_WEB_URL: c.env?.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_WEB_URL,
        // Cloudflare Workers AI binding — only available in CF runtime (undefined in local Bun dev)
        AI: c.env?.AI,
        MEDIA: c.env?.MEDIA,
        GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: c.env?.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
        ASC_API_KEY_ID: c.env?.ASC_API_KEY_ID || process.env.ASC_API_KEY_ID,
        ASC_API_ISSUER_ID: c.env?.ASC_API_ISSUER_ID || process.env.ASC_API_ISSUER_ID,
        ASC_API_PRIVATE_KEY: c.env?.ASC_API_PRIVATE_KEY || process.env.ASC_API_PRIVATE_KEY,
        STRIPE_SECRET_KEY: c.env?.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY,
        RESEND_API_KEY: c.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY,
        SENTRY_DSN: c.env?.SENTRY_DSN,
        EXPO_PUBLIC_SENTRY_DSN: c.env?.EXPO_PUBLIC_SENTRY_DSN,
      };
      if (env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
      if (env.RESEND_API_KEY) process.env.RESEND_API_KEY = env.RESEND_API_KEY;
      return await createContext(opts, env, c.get("requestId"), (work) => {
        try {
          c.executionCtx.waitUntil(work);
        } catch {
          void work;
        }
      });
    },
    onError: ({ path, error }) => {
      console.error(`❌ tRPC Error on ${path}:`, error);
      // Log additional context for debugging
      if (error.cause) {
        console.error('Error cause:', error.cause);
      }
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    },
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

app.get("/stripe/connect-return", (c) => {
  return c.html(connectReturnHtml());
});

app.get("/stripe/connect-refresh", async (c) => {
  const accountId = c.req.query('account') || '';
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) {
    return c.text('This payout link is missing its Stripe account.', 400);
  }
  const stripeSecretKey = c.env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return c.text('Payout setup is not available right now.', 500);
  }
  const admin = createSupabaseAdmin({ SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey });
  const profile = await admin.from('profiles').select('id').eq('stripe_account_id', accountId).maybeSingle();
  if (profile.error || !profile.data?.id) {
    return c.text('This payout link does not match a HomeCookedPlate cook.', 404);
  }
  const link = await createAccountLink(stripeSecretKey, accountId);
  if (!link.ok) return c.text('Stripe could not open payout setup. Return to the app and tap Set up Stripe payouts.', 502);
  return c.redirect(link.url, 302);
});

// Health check endpoint - tests Supabase connection from Cloudflare Workers
app.get("/health", async (c) => {
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const healthStatus = {
    timestamp: new Date().toISOString(),
    api: {
      status: 'ok',
      message: 'API is running',
    },
    supabase: {
      connected: false,
      url: supabaseUrl ? (supabaseUrl.includes('supabase.co') ? 'Configured' : supabaseUrl) : 'Not configured',
      hasCredentials: !!(supabaseUrl && supabaseServiceKey),
      tables: {} as Record<string, boolean>,
      error: null as string | null,
    },
    environment: {
      platform: 'cloudflare-worker',
      hasEnvVars: !!(supabaseUrl && supabaseServiceKey),
    },
  };

  if (!supabaseUrl || !supabaseServiceKey) {
    healthStatus.supabase.error = 'Supabase credentials not configured in Cloudflare Workers';
    return c.json(healthStatus, 503);
  }

  try {
    const { createSupabaseAdmin } = await import('./lib/supabase.js');
    const supabaseAdmin = createSupabaseAdmin({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
    });

    // Test connection with a simple count query on profiles table
    const { error: queryError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (queryError) {
      // Check if it's a "relation does not exist" error (table not created)
      if (queryError.message?.includes('does not exist') || queryError.code === '42P01') {
        healthStatus.supabase.error = 'Database connected, but profiles table does not exist. Please run SQL migrations in Supabase SQL Editor.';
        healthStatus.supabase.connected = true; // Connection works, just missing tables
        return c.json(healthStatus, 503);
      }
      
      healthStatus.supabase.error = `Query failed: ${queryError.message}`;
      return c.json(healthStatus, 503);
    }

    // Connection successful and table exists
    healthStatus.supabase.connected = true;
    healthStatus.supabase.tables = {
      profiles: true, // We know it exists if the query succeeded
    };
    return c.json(healthStatus, 200);

  } catch (error) {
    healthStatus.supabase.error = error instanceof Error ? error.message : 'Unknown error';
    healthStatus.supabase.connected = false;
    return c.json(healthStatus, 503);
  }
});

async function releaseHeldPayoutsFromEnv(env: Bindings) {
  const stripeSecretKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) return;
  const supabaseAdmin = createSupabaseAdmin({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
  });
  await releaseDuePayouts(supabaseAdmin, stripeSecretKey);
}

app.onError((error, c) => {
  const message = error instanceof Error ? error.message : "unknown";
  console.error("[API] Unhandled error:", message);
  let path = c.req.path;
  try {
    path = new URL(c.req.url).pathname;
  } catch {
    path = c.req.path;
  }
  const pending = reportWorkerCrash({
    error,
    method: c.req.method,
    path,
    dsn: workerSentryDsn(c.env),
  });
  try {
    c.executionCtx.waitUntil(pending);
  } catch {
    void pending;
  }
  if (c.req.path.startsWith("/api/trpc")) {
    return c.json({
      error: {
        json: {
          message: BUSY_MESSAGE,
          code: -32603,
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        },
      },
    }, 500);
  }
  return c.json({ error: BUSY_MESSAGE }, 500);
});

export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) => {
    applyWorkerEnv(env);
    return app.fetch(request, env, ctx);
  },
  scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    applyWorkerEnv(env);
    ctx.waitUntil(releaseHeldPayoutsFromEnv(env).catch((error) => reportWorkerCrash({
      error,
      method: 'SCHEDULED',
      path: '/cron/payouts',
      dsn: workerSentryDsn(env),
    })));
  },
};
