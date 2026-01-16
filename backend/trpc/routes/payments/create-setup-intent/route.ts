import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const inputSchema = z.object({
  customerId: z.string().optional().nullable(),
});

export const createSetupIntentProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Get user profile to check for existing Stripe customer
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Use existing customer ID or the one provided
    let customerId = input.customerId || profile.stripe_customer_id;

    // If no customer exists, create one
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

    // Create Setup Intent for collecting payment method
    const params = new URLSearchParams({
      customer: customerId,
      'automatic_payment_methods[enabled]': 'true',
      usage: 'off_session', // For subscriptions
    });

    const response = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Stripe] Setup intent creation failed:', error);
      throw new Error('Failed to create setup intent');
    }

    const setupIntent = await response.json();

    console.log(`[Stripe] Setup intent created: ${setupIntent.id} for customer: ${customerId}`);

    return {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId,
    };
  });
