import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { calculateOrderSplit } from "../../../../lib/fees";

/**
 * Refund Order Procedure
 * 
 * Allows platemakers to refund orders at their 90% share (take-home amount).
 * Platform keeps 20% total fees (10% buyer fee + 10% seller fee).
 * 
 * CRITICAL: HomeCookedPlate does not refund platform fees.
 * Buyer receives refund of platemaker's 90% share only.
 * 
 * SECURITY:
 * - Only platemakers can refund their own orders
 * - Verifies order belongs to platemaker (seller_id = ctx.userId)
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
    const { data: order, error: orderError } = await ctx.supabase
      .from('orders')
      .select('id, seller_id, status, payment_intent_id, paid, total_price')
      .eq('id', input.orderId)
      .single();

    if (orderError || !order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // CRITICAL: Ensure only the assigned platemaker (seller) can refund
    if (order.seller_id !== ctx.userId) {
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

    // Verify order is paid
    if (!order.payment_intent_id || !order.paid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot refund order. Order has not been paid.',
      });
    }

    // Calculate refund amount: 90% of base order amount (platemaker's take-home)
    const orderTotalPrice = parseFloat(order.total_price.toString());
    if (!Number.isFinite(orderTotalPrice) || orderTotalPrice <= 0) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid order total price',
      });
    }

    // Calculate base amount (remove buyer fee: total_price includes 10% buyer fee)
    // Formula: total_price = baseAmount * 1.10, so baseAmount = total_price / 1.10
    const baseAmount = orderTotalPrice / 1.10;

    // Calculate platemaker's 90% share using calculateOrderSplit
    let refundAmount: number;
    try {
      const split = calculateOrderSplit(baseAmount);
      refundAmount = split.sellerPayout; // This is baseAmount * 0.90 (platemaker's take-home)
    } catch (error) {
      console.error('[RefundOrder] Error calculating refund amount:', error);
      // Fallback: use baseAmount * 0.90 directly
      refundAmount = baseAmount * 0.90;
    }

    // Round to 2 decimal places and convert to cents for Stripe
    const refundAmountCents = Math.round(refundAmount * 100);

    // Process Stripe refund
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Stripe secret key not configured',
      });
    }

    let refundId: string | null = null;
    try {
      const refundResponse = await fetch(
        'https://api.stripe.com/v1/refunds',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            payment_intent: order.payment_intent_id,
            amount: refundAmountCents.toString(), // Partial refund: 90% of base
          }).toString(),
        }
      );

      if (!refundResponse.ok) {
        const refundError = await refundResponse.text();
        console.error('[RefundOrder] Stripe refund failed:', refundError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process refund. Please contact support.',
        });
      }

      const refund = await refundResponse.json();
      refundId = refund.id;
      console.log('[RefundOrder] Stripe refund processed successfully:', refundId);
    } catch (stripeError) {
      console.error('[RefundOrder] Stripe API error:', stripeError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: stripeError instanceof Error ? stripeError.message : 'Failed to process refund',
      });
    }

    // Update order status to 'cancelled' and mark as unpaid
    const { data: updatedOrder, error: updateError } = await ctx.supabase
      .from('orders')
      .update({
        status: 'cancelled',
        paid: false,
      })
      .eq('id', input.orderId)
      .eq('seller_id', ctx.userId) // Double-check: ensure only the seller can update
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('[RefundOrder] Error updating order:', updateError);
      // Refund was processed, but order update failed - log error but don't fail
      // The refund has already been processed, so we return success
    }

    return {
      id: updatedOrder?.id || input.orderId,
      status: updatedOrder?.status || 'cancelled',
      refundAmount: parseFloat(refundAmount.toFixed(2)),
      refundId,
      platformFeeKept: parseFloat((orderTotalPrice - refundAmount).toFixed(2)),
      message: 'Order refunded successfully. HomeCookedPlate does not refund platform fees. Buyer received 90% of the base order amount.',
    };
  });
