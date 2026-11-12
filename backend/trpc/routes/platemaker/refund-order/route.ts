import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { refundCookSale } from "../../../../lib/stripe-marketplace";
import { notifyParty } from "../../../../lib/account-notice";
import { orderBuyerId, orderCookColumn, orderCookId, orderTotal, readOrderQuery } from "../../../../lib/order-row";
import { orderCancelPatch, orderPaymentConfirmed, paymentIntentId } from "../../../../lib/order-payment";

/**
 * Refund Order Procedure
 * 
 * Refunds the cook's share to the buyer. Platform fees stay with HomeCookedPlate.
 * If the 7-day hold has not ended, the Stripe transfer to the cook is never created.
 * If it already settled, the transfer is reversed.
 * 
 * SECURITY:
 * - Only platemakers can refund their own orders
 * - Verifies order belongs to platemaker (platemaker_id, or seller_id when that column is set)
 * - Only accepted/preparing/ready orders can be refunded
 */
export const refundOrderProcedure = protectedProcedure
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
        message: 'Only platemakers can refund orders',
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

    // CRITICAL: Ensure only the assigned platemaker (seller) can refund
    if (orderCookId(order) !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not authorized to refund this order. Only the assigned platemaker can refund orders.',
      });
    }

    // Verify order status allows refund
    if (!['accepted', 'preparing', 'ready'].includes(order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot refund order. Current status is "${order.status}". Only accepted, preparing, or ready orders can be refunded.`,
      });
    }

    const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    const intentId = paymentIntentId(order);
    const paid = await orderPaymentConfirmed(order, ctx.supabaseAdmin, stripeSecretKey);
    if (!intentId || !paid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot refund order. Order has not been paid.',
      });
    }

    const baseAmount = orderTotal(order);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid order total price',
      });
    }

    if (!stripeSecretKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Stripe secret key not configured',
      });
    }

    let refundResult: { refundId: string; refundAmount: number; platformFeeKept: number };
    try {
      refundResult = await refundCookSale(ctx.supabaseAdmin, stripeSecretKey, {
        orderId: input.orderId,
        sellerId: ctx.userId,
        paymentIntentId: intentId,
        baseAmount,
      });
    } catch (stripeError) {
      console.error('[RefundOrder] Stripe API error:', stripeError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: stripeError instanceof Error ? stripeError.message : 'Failed to process refund',
      });
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
      console.error('[RefundOrder] Error updating order:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The refund was sent to the card, but this order is still open.',
      });
    }

    try {
      await notifyParty(ctx.supabaseAdmin, orderBuyerId(order), 'orderUpdates', {
        title: 'Order update',
        body: 'This order was refunded.',
      });
    } catch (noticeError) {
      console.error('[RefundOrder] Notice was not sent:', noticeError);
    }

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      refundAmount: refundResult.refundAmount,
      refundId: refundResult.refundId,
      platformFeeKept: refundResult.platformFeeKept,
      message: 'Order refunded. The buyer received your payout share. HomeCookedPlate kept the platform fees. If Stripe had already paid you, that transfer was reversed.',
    };
  });
