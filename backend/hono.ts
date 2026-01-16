/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { supabaseAdmin } from "./lib/supabase";

type Bindings = {
  RATE_LIMIT_KV?: KVNamespace;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const inMemoryRateLimit = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return async (c: any, next: any) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const now = Date.now();
    const key = `ratelimit:${ip}`;

    const kv = c.env?.RATE_LIMIT_KV;
    
    if (kv) {
      const recordStr = await kv.get(key);
      let record: { count: number; resetTime: number } | null = null;

      if (recordStr) {
        try {
          record = JSON.parse(recordStr);
        } catch (e) {
          console.error('[Rate Limit] Failed to parse record:', e);
        }
      }

      if (record && now < record.resetTime) {
        if (record.count >= maxRequests) {
          return c.json(
            { error: 'Too many requests, please try again later.' },
            429
          );
        }
        record.count++;
        await kv.put(key, JSON.stringify(record), {
          expirationTtl: Math.ceil((record.resetTime - now) / 1000),
        });
      } else {
        const newRecord = {
          count: 1,
          resetTime: now + windowMs,
        };
        await kv.put(key, JSON.stringify(newRecord), {
          expirationTtl: Math.ceil(windowMs / 1000),
        });
      }
    } else {
      const record = inMemoryRateLimit.get(key);
      
      if (record && now < record.resetTime) {
        if (record.count >= maxRequests) {
          return c.json(
            { error: 'Too many requests, please try again later.' },
            429
          );
        }
        record.count++;
        inMemoryRateLimit.set(key, record);
      } else {
        inMemoryRateLimit.set(key, {
          count: 1,
          resetTime: now + windowMs,
        });
      }
      
      setTimeout(() => {
        inMemoryRateLimit.delete(key);
      }, windowMs);
    }

    await next();
  };
};

app.use("*", cors());

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

app.use("*", rateLimit(100, 60 * 1000));

app.use("/api/auth/*", rateLimit(10, 60 * 1000));

app.post("/webhook/stripe", async (c) => {
  const webhookSecret = c.env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('[Stripe Webhook] Missing environment variables');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const payload = await c.req.text();
  const sig = c.req.header('stripe-signature');

  if (!sig) {
    console.error('[Stripe Webhook] Missing signature');
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
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedSignature !== signature) {
      console.error('[Stripe Webhook] Signature verification failed');
      return c.json({ error: 'Invalid signature' }, 400);
    }

    event = JSON.parse(payload);
  } catch (err) {
    console.error('[Stripe Webhook] Verification error:', err);
    return c.json({ error: 'Webhook error' }, 400);
  }

  console.log('[Stripe Webhook] Event received:', event.type);

  // Handle payment intent events (existing logic)
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const paymentIntentId = paymentIntent.id;

    console.log('[Stripe Webhook] Payment succeeded:', paymentIntentId);

    // Use centralized admin client (supabaseAdmin) which uses Service Role Key
    // Perform a single atomic update for all orders with this payment_intent_id
    const { data: updatedOrders, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        paid: true, 
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('payment_intent_id', paymentIntentId)
      .select();

    if (updateError) {
      console.error('[Stripe Webhook] Error updating orders:', updateError);
      return c.json({ error: 'Database error' }, 500);
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      console.warn('[Stripe Webhook] No orders found for payment intent:', paymentIntentId);
    } else {
      console.log('[Stripe Webhook] Updated', updatedOrders.length, 'order(s) successfully');
    }
  }

  // Handle subscription events for membership management
  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    console.log('[Stripe Webhook] Subscription created:', subscription.id, 'for customer:', customerId);

    // Update profile to premium tier when subscription is created (even if trial)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: 'premium',
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('[Stripe Webhook] Error updating profile for subscription.created:', updateError);
      return c.json({ error: 'Database error' }, 500);
    }

    if (!updatedProfile) {
      console.warn('[Stripe Webhook] No profile found for customer:', customerId);
    } else {
      console.log('[Stripe Webhook] Updated profile to premium for subscription:', subscription.id);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const status = subscription.status;

    console.log('[Stripe Webhook] Subscription updated:', subscription.id, 'status:', status);

    // Update membership tier based on subscription status
    const membershipTier = (status === 'active' || status === 'trialing') ? 'premium' : 'free';

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: membershipTier,
        stripe_subscription_id: status === 'active' || status === 'trialing' ? subscription.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('[Stripe Webhook] Error updating profile for subscription.updated:', updateError);
      return c.json({ error: 'Database error' }, 500);
    }

    if (!updatedProfile) {
      console.warn('[Stripe Webhook] No profile found for customer:', customerId);
    } else {
      console.log('[Stripe Webhook] Updated profile membership_tier to', membershipTier, 'for subscription:', subscription.id);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    console.log('[Stripe Webhook] Subscription deleted:', subscription.id, 'for customer:', customerId);

    // Set membership back to free when subscription is deleted
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: 'free',
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('[Stripe Webhook] Error updating profile for subscription.deleted:', updateError);
      return c.json({ error: 'Database error' }, 500);
    }

    if (!updatedProfile) {
      console.warn('[Stripe Webhook] No profile found for customer:', customerId);
    } else {
      console.log('[Stripe Webhook] Updated profile to free tier after subscription deletion:', subscription.id);
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
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: profile.id,
          title: 'Free Trial Ending Soon',
          body: `Your free trial ends in 3 days. Your card will be charged $4.99 on ${trialEndDate}.`,
          type: 'subscription',
          read: false,
        });

      console.log('[Stripe Webhook] Created trial ending notification for user:', profile.id);

      // Send Expo push notification if push token exists
      if (profile.expo_push_token) {
        const metroArea = profile.metro_area || 'your area';
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
      } else {
        console.log('[Stripe Webhook] No expo_push_token found for user:', profile.id, '- skipping push notification');
      }
    }
  }

  return c.json({ received: true });
});

// Database webhook endpoint for metro cap reached notifications
// Triggered by Supabase Database Webhooks when metro_area_counts.maker_count or taker_count hits max_cap
app.post("/webhook/metro-cap-reached", async (c) => {
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Metro Cap Webhook] Missing environment variables');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  try {
    const payload = await c.req.json();
    
    // Supabase Database Webhooks send payload with 'type' and 'record' fields
    // Expected payload: { type: 'UPDATE', record: { metro_name, maker_count, taker_count, max_cap }, old_record: {...} }
    const { type, record, old_record } = payload;

    if (type !== 'UPDATE' || !record) {
      console.warn('[Metro Cap Webhook] Invalid payload type or missing record:', { type, hasRecord: !!record });
      return c.json({ received: true, message: 'Ignored - not an UPDATE event' });
    }

    const metroName = record.metro_name;
    const makerCount = record.maker_count;
    const takerCount = record.taker_count;
    const maxCap = record.max_cap || 100;
    const oldMakerCount = old_record?.maker_count || 0;
    const oldTakerCount = old_record?.taker_count || 0;

    // Check if maker_count or taker_count just hit max_cap
    const makerHitCap = makerCount === maxCap && oldMakerCount < maxCap;
    const takerHitCap = takerCount === maxCap && oldTakerCount < maxCap;

    if (!makerHitCap && !takerHitCap) {
      // Not a cap-reached event, ignore
      return c.json({ received: true, message: 'Count not at cap' });
    }

    console.log(`[Metro Cap Webhook] Metro "${metroName}" reached cap:`, {
      makerHitCap,
      takerHitCap,
      makerCount,
      takerCount,
      maxCap,
    });

    // Create notifications for all admin users
    const { data: adminProfiles, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_admin', true);

    if (adminError) {
      console.error('[Metro Cap Webhook] Error fetching admin profiles:', adminError);
      // Continue anyway - webhook was received
    }

    if (adminProfiles && adminProfiles.length > 0) {
      const notifications = adminProfiles.map((admin) => {
        const roles = [];
        if (makerHitCap) roles.push('Platemakers');
        if (takerHitCap) roles.push('Platetakers');
        
        return {
          user_id: admin.id,
          title: 'Metro Cap Reached',
          body: `Metro "${metroName}" has reached the maximum capacity (${maxCap}/${maxCap}) for ${roles.join(' and ')}.`,
          type: 'metro_cap_reached',
          reference_id: null,
          read: false,
        };
      });

      const { error: notifyError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (notifyError) {
        console.error('[Metro Cap Webhook] Error creating notifications:', notifyError);
      } else {
        console.log(`[Metro Cap Webhook] Created ${notifications.length} admin notification(s) for metro cap reached`);
      }
    }

    return c.json({ received: true, message: 'Metro cap notification processed' });
  } catch (error) {
    console.error('[Metro Cap Webhook] Error processing webhook:', error);
    return c.json({ error: 'Webhook processing error' }, 500);
  }
});

app.use(
  "/api/trpc/*",
  async (c, next) => {
    // #region agent log - HYPOTHESIS G, H: Track tRPC request arrival
    fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/hono.ts:TRPC_REQUEST',message:'tRPC request received',data:{path:c.req.path,method:c.req.method,hasBody:!!c.req.body},timestamp:Date.now(),sessionId:'debug-session',runId:'trpc-request',hypothesisId:'G,H'})}).catch(()=>{});
    // #endregion
    await next();
  },
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
