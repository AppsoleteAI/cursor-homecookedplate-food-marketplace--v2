import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyParty } from "../../../../lib/account-notice";
import { orderBuyerId, orderCookColumn, orderCookId, readOrderQuery } from "../../../../lib/order-row";
import { orderCancelPatch, orderPaymentConfirmed, paymentIntentId } from "../../../../lib/order-payment";

/**
 * Deny Order Procedure
 * 
 * Allows platemakers to deny pending orders.
 * CRITICAL: If order is paid, cancels/refunds the payment intent.
 * Denied orders do not get charged - full refund to buyer.
 * 
 * SECURITY:
 * - Only platemakers can deny their own orders
 * - Verifies order belongs to platemaker (platemaker_id, or seller_id when that column is set)
 * - Only pending orders can be denied
 */
export const denyOrderProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
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
        message: 'Only platemakers can deny orders',
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

    // CRITICAL: Ensure only the assigned platemaker (seller) can deny
    if (orderCookId(order) !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not authorized to deny this order. Only the assigned platemaker can deny orders.',
      });
    }

    // Verify order status is 'pending'
    if (order.status !== 'pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot deny order. Current status is "${order.status}". Only pending orders can be denied.`,
      });
    }

    const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    const paid = await orderPaymentConfirmed(order, ctx.supabaseAdmin, stripeSecretKey);
    const intentId = paymentIntentId(order);
    let refundStatus: 'none' | 'cancelled' | 'refunded' = 'none';
    if (intentId && paid) {
      if (!stripeSecretKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The card refund could not be started. This order is still open.',
        });
      }
      const paymentIntentResponse = await fetch(
        `https://api.stripe.com/v1/payment_intents/${intentId}`,
        { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
      );
      if (!paymentIntentResponse.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The card refund could not be checked. This order is still open.',
        });
      }
      const paymentIntent = await paymentIntentResponse.json() as { status?: string; amount?: number };
      if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'requires_payment_method') {
        const cancelResponse = await fetch(
          `https://api.stripe.com/v1/payment_intents/${intentId}/cancel`,
          { method: 'POST', headers: { Authorization: `Bearer ${stripeSecretKey}` } },
        );
        if (!cancelResponse.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'The card could not be cancelled. This order is still open.',
          });
        }
        refundStatus = 'cancelled';
      } else if (paymentIntent.status === 'succeeded') {
        const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            payment_intent: intentId,
            amount: String(paymentIntent.amount),
          }).toString(),
        });
        if (!refundResponse.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'The card refund did not go through. This order is still open.',
          });
        }
        refundStatus = 'refunded';
      } else if (paymentIntent.status === 'canceled') {
        refundStatus = 'cancelled';
      } else {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The card is not ready to refund. This order is still open.',
        });
      }
    }

    // Update order status to 'cancelled' and mark as unpaid
    const { data: updatedOrder, error: updateError } = await ctx.supabaseAdmin
      .from('orders')
      .update(orderCancelPatch(order))
      .eq('id', input.orderId)
      .eq(orderCookColumn(order), ctx.userId)
      .select('id, status')
      .single();

    if (updateError || !updatedOrder) {
      console.error('[DenyOrder] Error:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError?.message || 'Failed to deny order',
      });
    }

    try {
      await notifyParty(ctx.supabaseAdmin, orderBuyerId(order), 'orderUpdates', {
        title: 'Order update',
        body: 'This order was denied.',
      });
    } catch (noticeError) {
      console.error('[DenyOrder] Notice was not sent:', noticeError);
    }

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      refundStatus,
      message: refundStatus === 'refunded' || refundStatus === 'cancelled'
        ? 'Order denied and payment refunded. Buyer will not be charged.'
        : 'Order denied successfully.',
    };
  });
