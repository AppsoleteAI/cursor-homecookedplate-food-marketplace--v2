import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { orderBuyerId, readOrderQuery } from '../../../../lib/order-row';
import { listedPlateMetadata, recordPlatePayment } from '../../../../lib/record-paid-order';

const inputSchema = z.object({
  paymentIntentId: z.string(),
});

export const confirmPaymentProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const { data: ownedRaw, error: ownedError } = await readOrderQuery((columns) => ctx.supabaseAdmin
      .from('orders')
      .select(columns)
      .eq('payment_intent_id', input.paymentIntentId) as PromiseLike<{ data: any; error: { message?: string } | null }>);
    const ownedOrders = (ownedRaw || []) as any[];

    if (ownedError || ownedOrders.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    }

    const isParty = ownedOrders.some(
      (order: any) => orderBuyerId(order) === ctx.userId || order.seller_id === ctx.userId
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

    if (paymentIntent.status === 'succeeded') {
      const listed = listedPlateMetadata(paymentIntent.metadata);
      const recorded = await recordPlatePayment(ctx.supabaseAdmin, {
        paymentIntentId: input.paymentIntentId,
        chargeId: paymentIntent.latest_charge || null,
        currency: paymentIntent.currency,
        deliveryFee: Number(paymentIntent.metadata?.delivery_fee ?? 0),
        amountCents: paymentIntent.amount,
        listedOrderIds: listed.listedOrderIds,
        listedBaseCents: listed.listedBaseCents,
        stripeSecretKey,
      });
      if (recorded === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stripe has not confirmed this payment for these plate prices.',
        });
      }
    }

    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    };
  });
