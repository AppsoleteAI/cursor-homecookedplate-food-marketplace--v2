import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';

const inputSchema = z.object({
  paymentIntentId: z.string(),
});

export const confirmPaymentProcedure = protectedProcedure
  .input(inputSchema)
  .query(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const { data: ownedOrders, error: ownedError } = await ctx.supabaseAdmin
      .from('orders')
      .select('id, buyer_id, seller_id')
      .eq('payment_intent_id', input.paymentIntentId);

    if (ownedError || !ownedOrders || ownedOrders.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    }

    const isParty = ownedOrders.some(
      (order) => order.buyer_id === ctx.userId || order.seller_id === ctx.userId
    );
    if (!isParty) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You cannot view this payment',
      });
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
