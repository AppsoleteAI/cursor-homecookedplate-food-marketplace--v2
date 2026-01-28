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
import { calculateFees } from "./lib/fees";

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

// Enable CORS for your Expo origin
// MUST BE FIRST: CORS middleware must be before tRPC routes to handle OPTIONS preflight
app.use(
  '/api/trpc/*',
  cors({
    // Allow Expo web origins (development and production)
    // For development: '*' allows all origins (including Expo tunnel URLs)
    // For production: Specify exact origins for security
    origin: (origin) => {
      // Allow all origins in development (includes Expo tunnel URLs like *.exp.direct, *.expo.dev)
      if (process.env.NODE_ENV !== 'production') {
        return true; // Allow all origins in development
      }
      // Production: Allow specific Expo origins
      if (!origin) return true; // Allow requests without origin (e.g., Postman, curl)
      const allowedOrigins = [
        'https://homecookedplate.com',
        'https://www.homecookedplate.com',
        'https://homecookedplate-marketplace.vercel.app',
        // Add your production Expo web URL here when deployed
      ];
      // Also allow Expo tunnel URLs in production (for testing)
      if (origin.includes('.exp.direct') || origin.includes('.expo.dev')) {
        return true;
      }
      return allowedOrigins.includes(origin);
    },
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
    exposeHeaders: ['Content-Length'],
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

  // Create Supabase admin client for all webhook operations
  const supabaseAdmin = createSupabaseAdmin({ SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey });

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

    // Financial Architecture: Every successful Stripe webhook MUST create transaction records
    // Calculate fee breakdowns for 20% take rate (double-sided 10% fee)
    if (updatedOrders && updatedOrders.length > 0) {
      // Get Stripe charge and transfer details
      const chargeId = paymentIntent.latest_charge || paymentIntent.charges?.data?.[0]?.id;
      const transferId = paymentIntent.charges?.data?.[0]?.transfer;
      const applicationFeeId = paymentIntent.charges?.data?.[0]?.application_fee?.id;
      const currency = paymentIntent.currency || 'usd';

      // Create transaction record for each order with fee breakdowns
      // Use order.total_price as base price (each order calculates fees independently)
      for (const order of updatedOrders) {
        // Base price from order (meal.price * quantity)
        const basePrice = parseFloat(order.total_price);
        
        // Calculate fees using standard utility (20% take rate: buyer +10%, seller -10%)
        const fees = calculateFees(basePrice, 10, 10);
        
        // Calculate proportional share if multiple orders share one payment intent
        const paymentAmount = paymentIntent.amount / 100; // Total buyer payment
        const applicationFeeAmount = paymentIntent.application_fee_amount ? paymentIntent.application_fee_amount / 100 : 0;
        const totalBasePrice = updatedOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
        const orderProportion = basePrice / totalBasePrice;
        
        // Allocate fees proportionally if multiple orders
        const buyerPayment = orderProportion * paymentAmount;
        const appRevenue = orderProportion * applicationFeeAmount;
        const sellerPayout = buyerPayment - appRevenue;

        const { error: transactionError } = await supabaseAdmin
          .from('transactions')
          .insert({
            payment_intent_id: paymentIntentId,
            order_id: order.id,
            buyer_id: order.buyer_id,
            seller_id: order.seller_id,
            meal_id: order.meal_id,
            base_price: parseFloat(basePrice.toFixed(2)),
            buyer_payment: parseFloat(buyerPayment.toFixed(2)),
            seller_payout: parseFloat(sellerPayout.toFixed(2)),
            app_revenue: parseFloat(appRevenue.toFixed(2)),
            buyer_fee: parseFloat(fees.buyerFee.toFixed(2)),
            seller_fee: parseFloat(fees.sellerFee.toFixed(2)),
            total_fee: parseFloat(fees.appTotalRevenue.toFixed(2)),
            stripe_charge_id: chargeId,
            stripe_transfer_id: transferId,
            stripe_application_fee_id: applicationFeeId,
            currency,
            quantity: order.quantity,
            status: 'completed',
          });

        if (transactionError) {
          console.error('[Stripe Webhook] Error creating transaction record:', transactionError);
          // Continue processing - transaction logging is important but not critical for order fulfillment
        } else {
          console.log(`[Stripe Webhook] Created transaction record for order ${order.id}: Base=$${basePrice.toFixed(2)}, Buyer=$${buyerPayment.toFixed(2)}, Seller=$${sellerPayout.toFixed(2)}, App=$${appRevenue.toFixed(2)}`);
        }
      }
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

  return c.json({ received: true });
});

// Database webhook endpoint for metro cap reached notifications
// Triggered by Supabase Database Webhooks when metro_area_counts.platemaker_count or platetaker_count hits max_cap
app.post("/webhook/metro-cap-reached", async (c) => {
  const supabaseUrl = c.env?.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = c.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Metro Cap Webhook] Missing environment variables');
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
        SUPABASE_SERVICE_ROLE_KEY: c.env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: c.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        EXPO_PUBLIC_WEB_URL: c.env?.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_WEB_URL,
      };
      return await createContext(opts, env);
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
    const { count, error: queryError } = await supabaseAdmin
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

export default app;
