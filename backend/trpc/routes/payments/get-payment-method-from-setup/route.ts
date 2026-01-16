import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const inputSchema = z.object({
  setupIntentId: z.string().min(1),
});

export const getPaymentMethodFromSetupProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Retrieve the setup intent from Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/setup_intents/${input.setupIntentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Stripe] Setup intent retrieval failed:', error);
      throw new Error('Failed to retrieve setup intent');
    }

    const setupIntent = await response.json();

    // Verify the setup intent belongs to the current user's customer
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', ctx.userId)
      .single();

    if (profile?.stripe_customer_id && setupIntent.customer !== profile.stripe_customer_id) {
      throw new Error('Setup intent does not belong to current user');
    }

    if (!setupIntent.payment_method) {
      throw new Error('Payment method not found in setup intent');
    }

    return {
      paymentMethodId: setupIntent.payment_method as string,
    };
  });
