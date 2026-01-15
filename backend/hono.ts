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

  return c.json({ received: true });
});

app.use(
  "/api/trpc/*",
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
