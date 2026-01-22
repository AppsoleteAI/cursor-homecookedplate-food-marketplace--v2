// Supabase Edge Function: create-subscription
// Creates Stripe Checkout Sessions for Free Trial Auto-Pay and Lifetime Promo subscriptions.
//
// IMPORTANT: This Edge Function runs in Deno runtime and CANNOT import from backend/lib/fees.ts
// - Numeric subscription prices (4.99, 39.99, 0.00) are defined in backend/lib/fees.ts for app logic
// - Stripe Price IDs must be provided via environment variables/secrets (security requirement)
// - This function is the exclusive route for membership creation (Trials and Lifetime Promos)
//
// Auth: Requires a valid Supabase JWT in the Authorization header.
// Env:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - STRIPE_SECRET_KEY
// - STRIPE_PRICE_ID_STANDARD_MONTHLY (monthly subscription price ID)
// - STRIPE_PRICE_ID_LIFETIME_FREE ($0 one-time payment price ID)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type PromoType = "FREE_TRIAL_AUTO_PAY" | "LIFETIME_PROMO";

type CreateSubscriptionBody = {
  userId: string;
  metroName: string;
  promoType: PromoType;
  deviceId: string;
  returnUrl?: string;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    // Note: Numeric prices (4.99, 39.99, 0.00) are in backend/lib/fees.ts, but we use Stripe Price IDs from env vars here
    const monthlyPriceId = Deno.env.get("STRIPE_PRICE_ID_STANDARD_MONTHLY");
    const lifetimePriceId = Deno.env.get("STRIPE_PRICE_ID_LIFETIME_FREE");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[create-subscription] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!stripeSecretKey) {
      console.error("[create-subscription] Missing STRIPE_SECRET_KEY");
      return new Response(JSON.stringify({ error: "Stripe secret key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require caller JWT (user context)
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing Authorization Bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client (service role) for profile reads/updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
      auth: { persistSession: false },
    });

    // Validate JWT, get user id
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user?.id) {
      console.error("[create-subscription] Invalid user token:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authenticatedUserId = userData.user.id;

    // Parse request body
    const body: CreateSubscriptionBody = req.method === "POST" ? await req.json() : {};
    const { userId, metroName, promoType, deviceId, returnUrl } = body;

    // Validate required fields
    if (!userId || !metroName || !promoType || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, metroName, promoType, deviceId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify authenticated user matches userId in request
    if (authenticatedUserId !== userId) {
      return new Response(JSON.stringify({ error: "User ID mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, username, membership_tier, metro_area, device_id, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[create-subscription] Profile not found:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle FREE_TRIAL_AUTO_PAY path
    // Creates subscription with 30-day trial, then auto-charges $4.99/month (price defined in backend/lib/fees.ts)
    if (promoType === "FREE_TRIAL_AUTO_PAY") {
      if (!monthlyPriceId) {
        return new Response(
          JSON.stringify({ error: "STRIPE_PRICE_ID_STANDARD_MONTHLY not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create or retrieve Stripe customer
      let customerId: string | null = profile.stripe_customer_id ?? null;

      if (!customerId) {
        const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: profile.email,
            metadata: JSON.stringify({
              user_id: profile.id,
              username: profile.username,
            }),
          }).toString(),
        });

        if (!customerResponse.ok) {
          const errorText = await customerResponse.text();
          console.error("[Stripe] Customer creation failed:", errorText);
          return new Response(JSON.stringify({ error: "Failed to create Stripe customer" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const customer = await customerResponse.json();
        customerId = customer.id;

        // Save customer ID to profile
        const { error: updateCustomerError } = await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", profile.id);

        if (updateCustomerError) {
          console.warn("[create-subscription] Failed to save stripe_customer_id:", updateCustomerError);
        }
      }

      // Determine return URLs
      const defaultSuccessUrl = returnUrl || "homecookedplate://payment-success";
      const defaultCancelUrl = returnUrl || "homecookedplate://payment-cancel";
      const origin = req.headers.get("origin") || "";

      // Create Stripe Checkout Session with 30-day trial
      const sessionParams = new URLSearchParams({
        customer: customerId!,
        mode: "subscription",
        "line_items[0][price]": monthlyPriceId,
        "line_items[0][quantity]": "1",
        "subscription_data[trial_period_days]": "30",
        "subscription_data[metadata][userId]": userId,
        "subscription_data[metadata][metroName]": metroName,
        "subscription_data[metadata][deviceId]": deviceId,
        success_url: `${defaultSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: defaultCancelUrl,
        metadata: JSON.stringify({
          user_id: userId,
          metro_name: metroName,
          device_id: deviceId,
          promo_type: "FREE_TRIAL_AUTO_PAY",
        }),
      });

      const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: sessionParams.toString(),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error("[Stripe] Checkout session creation failed:", errorText);
        return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const session = await sessionResponse.json();

      console.log(
        `[create-subscription] FREE_TRIAL_AUTO_PAY session created: ${session.id} for user ${userId}`
      );

      return new Response(
        JSON.stringify({
          checkoutUrl: session.url,
          sessionId: session.id,
          promoType: "FREE_TRIAL_AUTO_PAY",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle LIFETIME_PROMO path
    // Creates $0 one-time payment for lifetime membership (device-locked, non-transferable)
    // Price is $0.00 (defined in backend/lib/fees.ts SUBSCRIPTION_PRICES.LIFETIME)
    if (promoType === "LIFETIME_PROMO") {
      if (!lifetimePriceId) {
        return new Response(
          JSON.stringify({ error: "STRIPE_PRICE_ID_LIFETIME_FREE not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate deviceId uniqueness
      // Check if deviceId already exists and belongs to a different user
      if (profile.device_id && profile.device_id !== deviceId) {
        // User already has a different deviceId - check if this deviceId belongs to another user
        const { data: existingDeviceProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("device_id", deviceId)
          .single();

        if (existingDeviceProfile && existingDeviceProfile.id !== userId) {
          return new Response(
            JSON.stringify({
              error: "Device ID already in use by another user. Lifetime memberships are non-transferable.",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // Check if deviceId is already used by another user
        const { data: existingDeviceProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("device_id", deviceId)
          .single();

        if (existingDeviceProfile && existingDeviceProfile.id !== userId) {
          return new Response(
            JSON.stringify({
              error: "Device ID already in use by another user. Lifetime memberships are non-transferable.",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Create or retrieve Stripe customer
      let customerId: string | null = profile.stripe_customer_id ?? null;

      if (!customerId) {
        const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: profile.email,
            metadata: JSON.stringify({
              user_id: profile.id,
              username: profile.username,
            }),
          }).toString(),
        });

        if (!customerResponse.ok) {
          const errorText = await customerResponse.text();
          console.error("[Stripe] Customer creation failed:", errorText);
          return new Response(JSON.stringify({ error: "Failed to create Stripe customer" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const customer = await customerResponse.json();
        customerId = customer.id;

        // Save customer ID to profile
        const { error: updateCustomerError } = await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", profile.id);

        if (updateCustomerError) {
          console.warn("[create-subscription] Failed to save stripe_customer_id:", updateCustomerError);
        }
      }

      // Determine return URLs
      const defaultSuccessUrl = returnUrl || "homecookedplate://lifetime-active";
      const defaultCancelUrl = returnUrl || "homecookedplate://payment-cancel";

      // Create Stripe Checkout Session for $0 one-time payment
      const sessionParams = new URLSearchParams({
        customer: customerId!,
        mode: "payment",
        "line_items[0][price]": lifetimePriceId,
        "line_items[0][quantity]": "1",
        success_url: `${defaultSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: defaultCancelUrl,
        metadata: JSON.stringify({
          user_id: userId,
          metro_name: metroName,
          device_id: deviceId,
          is_lifetime: "true",
          transferable: "false",
          promo_type: "LIFETIME_PROMO",
        }),
      });

      const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: sessionParams.toString(),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error("[Stripe] Checkout session creation failed:", errorText);
        return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const session = await sessionResponse.json();

      // Update profile with device_id and lifetime membership tier
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update({
          device_id: deviceId,
          membership_tier: "lifetime",
        })
        .eq("id", userId);

      if (updateProfileError) {
        console.error("[create-subscription] Failed to update profile with device_id:", updateProfileError);
        // Continue anyway - the checkout session is created
      }

      console.log(
        `[create-subscription] LIFETIME_PROMO session created: ${session.id} for user ${userId}, deviceId: ${deviceId}`
      );

      return new Response(
        JSON.stringify({
          checkoutUrl: session.url,
          sessionId: session.id,
          promoType: "LIFETIME_PROMO",
          deviceId: deviceId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalid promoType
    return new Response(JSON.stringify({ error: `Invalid promoType: ${promoType}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-subscription] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
