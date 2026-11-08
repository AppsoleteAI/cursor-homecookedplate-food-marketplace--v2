import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { orderBuyerId, orderTotal, readOrderQuery } from "../../../../lib/order-row";
import { listedPlateMetadata, platePaymentCovers } from "../../../../lib/record-paid-order";

export const updatePaymentIntentProcedure = protectedProcedure
  .input(
    z.object({
      orderIds: z.array(z.string().uuid()),
      paymentIntentId: z.string().min(3),
    })
  )
  .mutation(async ({ input, ctx }) => {
    if (input.orderIds.length === 0) {
      throw new Error('At least one order ID is required');
    }
    const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe has not confirmed this payment.' });
    }

    const { data: orders, error } = await readOrderQuery((columns) => ctx.supabaseAdmin
      .from('orders')
      .select(columns)
      .in('id', input.orderIds));
    if (error || !orders || orders.length !== input.orderIds.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more orders could not be found' });
    }
    for (const order of orders) {
      if (orderBuyerId(order) !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only pay for your own orders' });
      }
      if (order.paid === true) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order is already paid' });
      }
      if (order.payment_intent_id && order.payment_intent_id !== input.paymentIntentId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order is already linked to a payment' });
      }
    }

    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${input.paymentIntentId}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    });
    if (!response.ok) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That payment could not be found.' });
    }
    const paymentIntent = await response.json() as {
      amount?: number;
      status?: string;
      metadata?: { order_ids?: string; base_cents?: string; buyer_id?: string; delivery_fee?: string };
    };
    if (paymentIntent.metadata?.buyer_id && paymentIntent.metadata.buyer_id !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment belongs to another account.' });
    }
    if (paymentIntent.status === 'canceled') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This payment was canceled.' });
    }
    const buyer = await ctx.supabaseAdmin
      .from('profiles')
      .select('role, membership_tier')
      .eq('id', ctx.userId)
      .maybeSingle();
    const listed = listedPlateMetadata(paymentIntent.metadata);
    const covers = platePaymentCovers({
      orderIds: orders.map((order: { id: string }) => order.id),
      bases: orders.map((order: { total_price?: unknown; total_price_cents?: unknown }) => orderTotal(order)),
      deliveryFee: Number(paymentIntent.metadata?.delivery_fee ?? 0),
      amountCents: paymentIntent.amount ?? 0,
      buyerRole: buyer.data?.role,
      buyerTier: buyer.data?.membership_tier,
      listedOrderIds: listed.listedOrderIds,
      listedBaseCents: listed.listedBaseCents,
    });
    if (!covers) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That payment does not match these plate prices.',
      });
    }

    const saved = await ctx.supabaseAdmin
      .from('orders')
      .update({ payment_intent_id: input.paymentIntentId })
      .in('id', input.orderIds)
      .eq('paid', false);
    if (saved.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The payment could not be linked to these orders.' });
    }

    return {
      success: true,
      updatedCount: input.orderIds.length,
      orderIds: input.orderIds,
    };
  });
