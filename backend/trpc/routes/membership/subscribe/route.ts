import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { supabaseAdmin } from '../../../../lib/supabase';

// Major metropolitan areas eligible for trial promotion
export const MAJOR_METROS = [
  "New York-Newark-Jersey City",
  "Los Angeles-Long Beach-Anaheim",
  "Chicago-Naperville-Elgin",
  "Dallas-Fort Worth-Arlington",
  "Houston-The Woodlands-Sugar Land",
  "Washington-Arlington-Alexandria",
  "Philadelphia-Camden-Wilmington",
  "Miami-Fort Lauderdale-Pompano Beach",
  "Atlanta-Sandy Springs-Alpharetta",
  "Boston-Cambridge-Newton",
  "Phoenix-Mesa-Chandler",
  "San Francisco-Oakland-Berkeley",
  "Riverside-San Bernardino-Ontario",
  "Detroit-Warren-Dearborn",
  "Seattle-Tacoma-Bellevue",
  "Minneapolis-St. Paul-Bloomington",
  "San Diego-Chula Vista-Carlsbad",
  "Tampa-St. Petersburg-Clearwater",
  "Denver-Aurora-Lakewood",
  "Baltimore-Columbia-Towson",
  "St. Louis",
  "Orlando-Kissimmee-Sanford",
  "Charlotte-Concord-Gastonia",
  "San Antonio-New Braunfels",
  "Portland-Vancouver-Hillsboro",
  "Sacramento-Roseville-Folsom",
  "Pittsburgh",
  "Austin-Round Rock-Georgetown",
  "Las Vegas-Henderson-Paradise",
  "Cincinnati",
  "Kansas City",
  "Columbus",
  "Indianapolis-Carmel-Anderson",
  "Cleveland-Elyria",
  "Nashville-Davidson-Murfreesboro-Franklin",
  "Virginia Beach-Norfolk-Newport News",
  "Providence-Warwick",
  "Jacksonville",
  "Milwaukee-Waukesha",
  "Oklahoma City",
  "Raleigh-Cary",
  "Memphis",
  "Richmond",
  "Louisville/Jefferson County",
  "New Orleans-Metairie",
  "Salt Lake City",
  "Hartford-West Hartford-East Hartford",
  "Buffalo-Cheektowaga",
  "Birmingham-Hoover",
  "Rochester"
];

/**
 * Check if a location string matches any major metro area
 * Uses case-insensitive partial matching for flexibility
 */
function isEligibleMetro(location: string | null | undefined): { eligible: boolean; metroName: string | null } {
  if (!location) {
    return { eligible: false, metroName: null };
  }

  const locationLower = location.toLowerCase();
  
  for (const metro of MAJOR_METROS) {
    // Check if location contains the metro name (case-insensitive)
    if (locationLower.includes(metro.toLowerCase()) || metro.toLowerCase().includes(locationLower)) {
      return { eligible: true, metroName: metro };
    }
  }

  return { eligible: false, metroName: null };
}

const inputSchema = z.object({
  paymentMethodId: z.string().min(1),
  useTrial: z.boolean().default(false),
  lat: z.number().optional(),        // GPS latitude
  lng: z.number().optional(),        // GPS longitude
  locationText: z.string().optional().nullable(), // User-entered location (fallback)
});

export const subscribeProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Get user profile
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('id, email, username, role, location, metro_area, trial_ends_at, stripe_customer_id, stripe_subscription_id')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Check if user already has an active subscription
    if (profile.stripe_subscription_id) {
      // Verify subscription is still active in Stripe
      const subResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      );

      if (subResponse.ok) {
        const subscription = await subResponse.json();
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          throw new Error('You already have an active subscription');
        }
      }
    }

    // Check if email/username is already tied to another membership
    const { data: existingMembership } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username')
      .or(`email.eq.${profile.email},username.eq.${profile.username}`)
      .neq('id', profile.id)
      .not('stripe_subscription_id', 'is', null)
      .limit(1)
      .single();

    if (existingMembership) {
      throw new Error('This email or username is already associated with a membership');
    }

    // Get promotion config
    const { data: config, error: configError } = await supabaseAdmin
      .from('promotion_configs')
      .select('*')
      .eq('promo_name', 'EARLY_BIRD')
      .single();

    if (configError || !config) {
      throw new Error('Promotion configuration not found');
    }

    let trialDays = 0;
    let metroName: string | null = null;

    // Check trial eligibility with 3-tier location fallback
    if (input.useTrial && config.is_active) {
      // Tier 1: Try GPS coordinates with PostGIS RPC
      if (input.lat !== undefined && input.lng !== undefined) {
        const { data: gpsMetro, error: gpsError } = await supabaseAdmin.rpc(
          'find_metro_by_location',
          { lng: input.lng, lat: input.lat }
        );

        if (!gpsError && gpsMetro) {
          metroName = gpsMetro;
        }
      }

      // Tier 2: If GPS didn't work, try user-entered location text
      if (!metroName && input.locationText) {
        const { eligible, metroName: matchedMetro } = isEligibleMetro(input.locationText);
        if (eligible && matchedMetro) {
          metroName = matchedMetro;
        }
      }

      // Tier 3: Fall back to profile location
      if (!metroName && profile.location) {
        const { eligible, metroName: matchedMetro } = isEligibleMetro(profile.location);
        if (eligible && matchedMetro) {
          metroName = matchedMetro;
        }
      }

      // If we found a metro area, check quota and apply trial
      if (metroName) {
        // Check current counts for this metro
        const { data: counts, error: countsError } = await supabaseAdmin
          .from('metro_area_counts')
          .select('maker_count, taker_count')
          .eq('metro_name', metroName)
          .single();

        if (countsError || !counts) {
          // If metro doesn't exist in counts table, initialize it
          await supabaseAdmin
            .from('metro_area_counts')
            .insert({ metro_name: metroName, maker_count: 0, taker_count: 0 })
            .onConflict('metro_name')
            .merge();

          // Retry the query
          const { data: retryCounts } = await supabaseAdmin
            .from('metro_area_counts')
            .select('maker_count, taker_count')
            .eq('metro_name', metroName)
            .single();

          if (retryCounts) {
            const isMaker = profile.role === 'platemaker';
            const currentCount = isMaker ? retryCounts.maker_count : retryCounts.taker_count;
            const maxCount = isMaker ? config.max_makers_per_metro : config.max_takers_per_metro;

            if (currentCount < maxCount) {
              trialDays = config.trial_days || 0;

              // Atomically increment count using RPC
              await supabaseAdmin.rpc('increment_metro_count', {
                area: metroName,
                user_role: profile.role,
              });
            }
          }
        } else {
          const isMaker = profile.role === 'platemaker';
          const currentCount = isMaker ? counts.maker_count : counts.taker_count;
          const maxCount = isMaker ? config.max_makers_per_metro : config.max_takers_per_metro;

          if (currentCount < maxCount) {
            trialDays = config.trial_days || 0;

            // Atomically increment count using RPC
            await supabaseAdmin.rpc('increment_metro_count', {
              area: metroName,
              user_role: profile.role,
            });
          }
        }

        // If trial is applied, update profile with metro_area and trial_ends_at
        if (trialDays > 0) {
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

          await ctx.supabase
            .from('profiles')
            .update({
              metro_area: metroName,
              trial_ends_at: trialEndsAt.toISOString(),
            })
            .eq('id', profile.id);
        }
      }
    }

    // Create or retrieve Stripe customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
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
        const error = await customerResponse.text();
        console.error('[Stripe] Customer creation failed:', error);
        throw new Error('Failed to create Stripe customer');
      }

      const customer = await customerResponse.json();
      customerId = customer.id;

      // Save customer ID to profile
      await ctx.supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id);
    }

    // Attach payment method to customer
    const attachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${input.paymentMethodId}/attach`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
      }).toString(),
    });

    if (!attachResponse.ok) {
      const error = await attachResponse.text();
      console.error('[Stripe] Payment method attachment failed:', error);
      throw new Error('Failed to attach payment method');
    }

    // Set as default payment method
    const customerUpdateResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'invoice_settings[default_payment_method]': input.paymentMethodId,
      }).toString(),
    });

    if (!customerUpdateResponse.ok) {
      const error = await customerUpdateResponse.text();
      console.error('[Stripe] Failed to set default payment method:', error);
      // Continue anyway - subscription creation will handle it
    }

    // Create subscription
    const subscriptionParams = new URLSearchParams({
      customer: customerId,
      items: JSON.stringify([{ price: 'price_monthly_499' }]),
      default_payment_method: input.paymentMethodId,
      payment_behavior: 'default_incomplete',
      expand: 'latest_invoice.payment_intent',
      metadata: JSON.stringify({
        user_id: profile.id,
        promo_name: trialDays > 0 ? 'EARLY_BIRD' : null,
        metro_name: metroName || null,
      }),
    });

    if (trialDays > 0) {
      subscriptionParams.append('trial_period_days', trialDays.toString());
    }

    const subscriptionResponse = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: subscriptionParams.toString(),
    });

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.text();
      console.error('[Stripe] Subscription creation failed:', error);
      throw new Error('Failed to create subscription');
    }

    const subscription = await subscriptionResponse.json();

    // Save subscription ID to profile
    await ctx.supabase
      .from('profiles')
      .update({
        stripe_subscription_id: subscription.id,
        membership_tier: 'premium', // Set to premium immediately (even during trial)
      })
      .eq('id', profile.id);

    // Extract client secret from invoice payment intent
    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret || null;

    return {
      subscriptionId: subscription.id,
      clientSecret,
      trialDays,
      metroName,
    };
  });
