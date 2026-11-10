// Supabase Edge Function: create-subscription
// Unused. Membership amounts stay in SUBSCRIPTION_PRICES in backend/lib/fees.ts.
// Store membership uses the App Store and Play products.
// This function must not call Stripe and must not read a Stripe price id.
// Do not deploy this file from a docs note.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const unused = new Response(
  JSON.stringify({
    error: "create-subscription is unused and must not call Stripe",
  }),
  {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  }
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return unused;
});
