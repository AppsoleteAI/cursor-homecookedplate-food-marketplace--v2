import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { getStripePriceId } from '../../../../lib/stripe-utils';

const inputSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const createCheckoutSessionProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Get user profile to determine Early Bird status and membership tier
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('id, email, username, membership_tier, metro_area, trial_ends_at, stripe_customer_id')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Determine if user is Early Bird (has trial_ends_at and metro_area is not Remote/Other)
    const isEarlyBird = !!(
      profile.trial_ends_at &&
      profile.metro_area &&
      profile.metro_area !== 'Remote/Other'
    );

    // Get the appropriate price ID
    const priceId = getStripePriceId(
      profile.membership_tier || 'free',
      isEarlyBird
    );

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

    // Determine return URLs
    const defaultSuccessUrl = input.returnUrl || 'homecookedplate://payment-success';
    const defaultCancelUrl = input.returnUrl || 'homecookedplate://payment-cancel';
    
    // Build checkout session parameters
    const sessionParams = new URLSearchParams({
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${defaultSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: defaultCancelUrl,
      metadata: JSON.stringify({
        user_id: profile.id,
        is_early_bird: String(isEarlyBird),
        membership_tier: profile.membership_tier || 'free',
        metro_area: profile.metro_area || null,
      }),
    });

    // Create checkout session
    const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: sessionParams.toString(),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error('[Stripe] Checkout session creation failed:', error);
      throw new Error('Failed to create checkout session');
    }

    const session = await sessionResponse.json();

    console.log(
      `[Stripe] Checkout session created: ${session.id} for user ${profile.id}, price: ${priceId}, early_bird: ${isEarlyBird}`
    );

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      priceId,
      isEarlyBird,
    };
  });
