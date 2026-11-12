import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orderBuyerId, orderCookColumn, orderCookId, orderTotal, readOrderQuery } from "../../../../lib/order-row";
import { notifyParty, ORDER_STEP_NOTICES } from "../../../../lib/account-notice";
import { listedPlateMetadata, platePaymentCovers } from "../../../../lib/record-paid-order";
import { orderHasHeldTransaction, orderPaidState, paymentIntentId, readStripeIntent, stripeSucceeded } from "../../../../lib/order-payment";

/**
 * Accept Order Procedure
 * 
 * Allows platemakers to accept pending orders.
 * Optionally accepts an estimated completion time (ETA).
 * 
 * SECURITY:
 * - Only platemakers can accept their own orders
 * - Verifies order belongs to platemaker (platemaker_id, or seller_id when that column is set)
 * - Only pending orders can be accepted
 */
export const acceptOrderProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      estimatedCompletionTime: z.string().optional(), // Optional ISO timestamp
    })
  )
  .mutation(async ({ ctx, input }) => {
    // CRITICAL SECURITY: Verify user role is 'platemaker' before proceeding
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    if (profile.role !== 'platemaker') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only platemakers can accept orders',
      });
    }

    // Verify order exists and belongs to this platemaker
    const { data: order, error: orderError } = await readOrderQuery((columns) => ctx.supabase
      .from('orders')
      .select(columns)
      .eq('id', input.orderId)
      .single());

    if (orderError || !order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // CRITICAL: Ensure only the assigned platemaker (seller) can accept
    if (orderCookId(order) !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not authorized to accept this order. Only the assigned platemaker can accept orders.',
      });
    }

    // Verify order status is 'pending'
    if (order.status !== 'pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot accept order. Current status is "${order.status}". Only pending orders can be accepted.`,
      });
    }

    const paidState = orderPaidState(order);
    if (paidState === 'unpaid') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Stripe has not confirmed this payment. It cannot be accepted.',
      });
    }
    const intentId = paymentIntentId(order);
    const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    const paymentIntent = intentId && stripeSecretKey ? await readStripeIntent(stripeSecretKey, intentId) : null;
    const stripeOk = stripeSucceeded(paymentIntent);
    const held = paidState === 'absent' && !stripeOk
      ? await orderHasHeldTransaction(ctx.supabaseAdmin, order.id)
      : false;
    if (!stripeOk && !held) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Stripe has not confirmed this payment. It cannot be accepted.',
      });
    }
    if (stripeOk && paymentIntent && intentId) {
      const siblings = await readOrderQuery((columns) => ctx.supabaseAdmin
        .from('orders')
        .select(columns)
        .eq('payment_intent_id', intentId));
      if (siblings.error || !siblings.data || siblings.data.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stripe has not confirmed this payment. It cannot be accepted.',
        });
      }
      const buyer = await ctx.supabaseAdmin
        .from('profiles')
        .select('role, membership_tier')
        .eq('id', orderBuyerId(siblings.data[0]))
        .maybeSingle();
      const listed = listedPlateMetadata(paymentIntent.metadata);
      const covers = platePaymentCovers({
        orderIds: siblings.data.map((row: { id: string }) => row.id),
        bases: siblings.data.map((row: { total_price?: unknown; total_price_cents?: unknown }) => orderTotal(row)),
        deliveryFee: Number(paymentIntent.metadata?.delivery_fee ?? 0),
        amountCents: paymentIntent.amount ?? 0,
        buyerRole: buyer.data?.role,
        buyerTier: buyer.data?.membership_tier,
        listedOrderIds: listed.listedOrderIds,
        listedBaseCents: listed.listedBaseCents,
      });
      if (!covers) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stripe has not confirmed this payment for these plate prices.',
        });
      }
    }

    // Validate estimated completion time if provided
    let estimatedCompletionTime: string | null = null;
    if (input.estimatedCompletionTime) {
      const etaDate = new Date(input.estimatedCompletionTime);
      if (isNaN(etaDate.getTime())) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid estimated completion time format',
        });
      }
      if (etaDate <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Estimated completion time must be in the future',
        });
      }
      estimatedCompletionTime = etaDate.toISOString();
    }

    // Update order status to 'accepted' and optionally set ETA
    const updateData: { status: string; estimated_completion_time?: string } = {
      status: 'accepted',
    };
    if (estimatedCompletionTime) {
      updateData.estimated_completion_time = estimatedCompletionTime;
    }

    const { data: updatedOrder, error: updateError } = await ctx.supabase
      .from('orders')
      .update(updateData)
      .eq('id', input.orderId)
      .eq(orderCookColumn(order), ctx.userId)
      .select('id, status, estimated_completion_time')
      .single();

    if (updateError || !updatedOrder) {
      console.error('[AcceptOrder] Error:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError?.message || 'Failed to accept order',
      });
    }

    await notifyParty(ctx.supabaseAdmin, orderBuyerId(order), 'orderUpdates', ORDER_STEP_NOTICES.accepted);

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      estimatedCompletionTime: updatedOrder.estimated_completion_time
        ? new Date(updatedOrder.estimated_completion_time)
        : null,
      message: 'Order has been accepted successfully',
    };
  });
