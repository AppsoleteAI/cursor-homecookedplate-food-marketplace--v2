import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyParty, ORDER_STEP_NOTICES } from "../../../../lib/account-notice";
import { orderBuyerId, orderCookColumn, orderCookId, readOrderQuery } from "../../../../lib/order-row";
import { orderHasHeldTransaction, orderPaidState, paymentIntentId, readStripeIntent, stripeSucceeded } from "../../../../lib/order-payment";

/**
 * Mark Order as Ready Procedure
 * 
 * Allows platemakers (sellers) to mark their orders as "ready" for pickup/delivery.
 * Security: Only the assigned cook (platemaker_id, or seller_id when that column is set) can update their own orders.
 */
export const markAsReadyProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // First, verify the order exists and the user is the seller
    const { data: order, error: checkError } = await readOrderQuery((columns) => ctx.supabase
      .from('orders')
      .select(columns)
      .eq('id', input.orderId)
      .single());

    if (checkError || !order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Security: Ensure only the assigned platemaker (seller) can mark as ready
    if (orderCookId(order) !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not authorized to update this order. Only the assigned platemaker can mark orders as ready.',
      });
    }

    // Verify the order is in a valid state to be marked as ready
    // Orders should be in 'accepted' or 'preparing' status before being marked 'ready'
    const paidState = orderPaidState(order);
    if (paidState === 'unpaid') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Stripe has not confirmed this payment.',
      });
    }
    if (paidState === 'absent') {
      const intentId = paymentIntentId(order);
      const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      const paymentIntent = intentId && stripeSecretKey ? await readStripeIntent(stripeSecretKey, intentId) : null;
      const held = stripeSucceeded(paymentIntent)
        ? false
        : await orderHasHeldTransaction(ctx.supabaseAdmin, order.id);
      if (!stripeSucceeded(paymentIntent) && !held) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stripe has not confirmed this payment.',
        });
      }
    }

    if (order.status !== 'accepted' && order.status !== 'preparing') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot mark order as ready. Current status is "${order.status}". Order must be "accepted" or "preparing" first.`,
      });
    }

    // Update the order status to 'ready'
    const { data, error } = await ctx.supabase
      .from('orders')
      .update({ status: 'ready' })
      .eq('id', input.orderId)
      .eq(orderCookColumn(order), ctx.userId)
      .select('id, status')
      .single();

    if (error || !data) {
      console.error('[MarkAsReady] Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'Failed to mark order as ready',
      });
    }

    await notifyParty(ctx.supabaseAdmin, orderBuyerId(order), 'orderUpdates', ORDER_STEP_NOTICES.ready);

    return {
      id: data.id,
      status: data.status,
      sellerId: orderCookId(order),
      buyerId: orderBuyerId(order),
      message: 'Order has been marked as ready for pickup/delivery',
    };
  });
