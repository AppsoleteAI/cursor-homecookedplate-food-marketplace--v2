import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

const inputSchema = z.object({
  paymentIntentId: z.string(),
});

export const confirmPaymentProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${input.paymentIntentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Stripe] Payment intent retrieval failed:', error);
      throw new Error('Failed to retrieve payment intent');
    }

    const paymentIntent = await response.json();

    console.log('[Stripe] Payment status:', paymentIntent.status);

    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    };
  });
