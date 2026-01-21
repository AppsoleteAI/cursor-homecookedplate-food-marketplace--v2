// Supabase Edge Function: create-checkout-session
// Creates a Stripe Hosted Checkout Session for subscription membership upgrades.
//
// Auth: Requires a valid Supabase JWT in the Authorization header.
// Env:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - STRIPE_SECRET_KEY
// - STRIPE_PRICE_ID_EARLY_BIRD_TRIAL
// - STRIPE_PRICE_ID_STANDARD_MONTHLY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type MembershipTier = "free" | "premium";

function getStripePriceId(membershipTier: MembershipTier, isEarlyBird: boolean): string {
  const earlyBirdPriceId = Deno.env.get("STRIPE_PRICE_ID_EARLY_BIRD_TRIAL") || "";
  const standardPriceId = Deno.env.get("STRIPE_PRICE_ID_STANDARD_MONTHLY") || "price_monthly_499";

  // SUCCESS: Early Bird users (isEarlyBird=true AND premium) get the trial price ID
  if (isEarlyBird && membershipTier === "premium") {
    if (!earlyBirdPriceId) {
      console.warn(
        "[create-checkout-session] STRIPE_PRICE_ID_EARLY_BIRD_TRIAL not set, falling back to standard price",
      );
      return standardPriceId;
    }
    return earlyBirdPriceId;
  }

  // CAP_REACHED or OUTSIDE_ZONE: Remote users, Over-cap, or free tier use standard monthly price
  return standardPriceId;
}

type CreateCheckoutSessionBody = {
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

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[create-checkout-session] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!stripeSecretKey) {
      console.error("[create-checkout-session] Missing STRIPE_SECRET_KEY");
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
      console.error("[create-checkout-session] Invalid user token:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const body: CreateCheckoutSessionBody = req.method === "POST" ? await req.json() : {};

    // Get user profile to determine Early Bird status and membership tier
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, username, membership_tier, metro_area, trial_ends_at, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[create-checkout-session] Profile not found:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine if user is Early Bird (has trial_ends_at and metro_area is not Remote/Other)
    const isEarlyBird = Boolean(
      profile.trial_ends_at && profile.metro_area && profile.metro_area !== "Remote/Other",
    );

    const membershipTier: MembershipTier = (profile.membership_tier || "free") as MembershipTier;
    const priceId = getStripePriceId(membershipTier, isEarlyBird);

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
        console.warn("[create-checkout-session] Failed to save stripe_customer_id:", updateCustomerError);
      }
    }

    // Determine return URLs (deep links)
    const defaultSuccessUrl = body.returnUrl || "homecookedplate://payment-success";
    const defaultCancelUrl = body.returnUrl || "homecookedplate://payment-cancel";

    const sessionParams = new URLSearchParams({
      customer: customerId!,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${defaultSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: defaultCancelUrl,
      metadata: JSON.stringify({
        user_id: profile.id,
        is_early_bird: String(isEarlyBird),
        membership_tier: profile.membership_tier || "free",
        metro_area: profile.metro_area || null,
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
      `[Stripe] Checkout session created: ${session.id} for user ${profile.id}, price: ${priceId}, early_bird: ${isEarlyBird}`,
    );

    return new Response(
      JSON.stringify({
        checkoutUrl: session.url,
        sessionId: session.id,
        priceId,
        isEarlyBird,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[create-checkout-session] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

