// Supabase Edge Function: create-checkout-session
// Creates a Stripe Hosted Checkout Session for subscription membership upgrades.
//
// Auth: Requires a valid Supabase JWT in the Authorization header.
// Env:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - STRIPE_SECRET_KEY
// - STRIPE_PRICE_ID_EARLY_BIRD_TRIAL
// - STRIPE_PRICE_ID_MONTHLY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type MembershipRole = "platemaker" | "platetaker";
type MembershipInterval = "month" | "year";

function membershipCents(role: MembershipRole, interval: MembershipInterval): number {
  if (role === "platetaker") return interval === "year" ? 7599 : 799;
  return interval === "year" ? 3999 : 499;
}

function membershipName(role: MembershipRole, interval: MembershipInterval): string {
  const who = role === "platetaker" ? "PlateTaker" : "PlateMaker";
  return `HomeCookedPlate ${who} ${interval === "year" ? "yearly" : "monthly"}`;
}

type CreateCheckoutSessionBody = {
  returnUrl?: string;
  interval?: MembershipInterval;
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
      .select("id, email, username, role, membership_tier, metro_area, trial_ends_at, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[create-checkout-session] Profile not found:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role: MembershipRole = profile.role === "platemaker" ? "platemaker" : "platetaker";
    const interval: MembershipInterval = body.interval === "year" ? "year" : "month";
    const unitAmount = membershipCents(role, interval);
    const productName = membershipName(role, interval);

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
          "metadata[user_id]": profile.id,
          "metadata[username]": profile.username,
        }).toString(),
      });

      if (!customerResponse.ok) {
        const errorText = await customerResponse.text();
        console.error("[Stripe] Customer creation failed:", errorText);
        let stripeMessage = "Failed to create Stripe customer";
        try {
          const parsed = JSON.parse(errorText);
          if (typeof parsed?.error?.message === "string") stripeMessage = parsed.error.message;
        } catch {
          stripeMessage = "Failed to create Stripe customer";
        }
        return new Response(JSON.stringify({ error: stripeMessage }), {
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

    const websiteReturn = "https://homecookedplate.com/membership";
    const returnUrl = body.returnUrl && /^https?:\/\//i.test(body.returnUrl)
      ? body.returnUrl
      : websiteReturn;

    const sessionParams = new URLSearchParams({
      customer: customerId!,
      mode: "subscription",
      "line_items[0][quantity]": "1",
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      "metadata[user_id]": profile.id,
      "metadata[role]": role,
      "metadata[interval]": interval,
      "metadata[membership_tier]": profile.membership_tier || "free",
      "metadata[metro_area]": profile.metro_area || "",
      "payment_method_types[0]": "card",
    });

    sessionParams.set("line_items[0][price_data][currency]", "usd");
    sessionParams.set("line_items[0][price_data][unit_amount]", String(unitAmount));
    sessionParams.set("line_items[0][price_data][recurring][interval]", interval);
    sessionParams.set("line_items[0][price_data][product_data][name]", productName);

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
      let stripeMessage = "Failed to create checkout session";
      try {
        const parsed = JSON.parse(errorText);
        if (typeof parsed?.error?.message === "string") stripeMessage = parsed.error.message;
      } catch {
        stripeMessage = "Failed to create checkout session";
      }
      return new Response(JSON.stringify({ error: stripeMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await sessionResponse.json();

    console.log(
      `[Stripe] Checkout session created: ${session.id} for user ${profile.id}, role: ${role}, interval: ${interval}, cents: ${unitAmount}`,
    );

    return new Response(
      JSON.stringify({
        checkoutUrl: session.url,
        sessionId: session.id,
        role,
        interval,
        unitAmount,
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

