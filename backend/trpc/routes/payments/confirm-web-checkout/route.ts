import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { missingBuyerColumn, orderBuyerId } from '../../../../lib/order-row';

export const confirmWebCheckoutProcedure = protectedProcedure
  .input(z.object({
    sessionId: z.string().min(3).max(200),
  }))
  .query(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error('Stripe secret key not configured');

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    });
    if (!response.ok) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That checkout could not be found.' });
    }
    const session = await response.json() as { payment_intent?: string | { id?: string } };
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This checkout has no payment yet.' });
    }

    const paymentResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    });
    if (!paymentResponse.ok) {
      throw new Error('Failed to retrieve payment intent');
    }
    const paymentIntent = await paymentResponse.json() as { status?: string; metadata?: { buyer_id?: string } };
    if (paymentIntent.metadata?.buyer_id && paymentIntent.metadata.buyer_id !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment belongs to another account.' });
    }
    if (!paymentIntent.metadata?.buyer_id) {
      const byBuyer = await ctx.supabaseAdmin
        .from('orders')
        .select('buyer_id')
        .eq('payment_intent_id', paymentIntentId);
      const orderRows = byBuyer.error && missingBuyerColumn(byBuyer.error.message)
        ? await ctx.supabaseAdmin
          .from('orders')
          .select('platetaker_id')
          .eq('payment_intent_id', paymentIntentId)
        : byBuyer;
      const ownsPlate = ((orderRows.data || []) as { buyer_id?: string | null; platetaker_id?: string | null }[]).some((order) => orderBuyerId(order) === ctx.userId);
      if (!ownsPlate) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment belongs to another account.' });
      }
    }

    return {
      paymentIntentId,
      status: paymentIntent.status ?? 'unknown',
    };
  });
