import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * Deny Order Procedure
 * 
 * Allows platemakers to deny pending orders.
 * CRITICAL: If order is paid, cancels/refunds the payment intent.
 * Denied orders do not get charged - full refund to buyer.
 * 
 * SECURITY:
 * - Only platemakers can deny their own orders
 * - Verifies order belongs to platemaker (seller_id = ctx.userId)
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

    // CRITICAL: Ensure only the assigned platemaker (seller) can deny
    if (order.seller_id !== ctx.userId) {
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

    // CRITICAL: Payment Handling - Cancel/refund if order is paid
    let refundStatus: 'none' | 'cancelled' | 'refunded' = 'none';
    if (order.payment_intent_id && order.paid) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        console.error('[DenyOrder] Stripe secret key not configured');
        // Continue with order cancellation even if Stripe refund fails
      } else {
        try {
          // First, check payment intent status
          const paymentIntentResponse = await fetch(
            `https://api.stripe.com/v1/payment_intents/${order.payment_intent_id}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
              },
            }
          );

          if (paymentIntentResponse.ok) {
            const paymentIntent = await paymentIntentResponse.json();

            // If payment intent is not yet captured, cancel it
            if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'requires_payment_method') {
              const cancelResponse = await fetch(
                `https://api.stripe.com/v1/payment_intents/${order.payment_intent_id}/cancel`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${stripeSecretKey}`,
                  },
                }
              );

              if (cancelResponse.ok) {
                refundStatus = 'cancelled';
                console.log('[DenyOrder] Payment intent cancelled successfully');
              } else {
                const cancelError = await cancelResponse.text();
                console.error('[DenyOrder] Failed to cancel payment intent:', cancelError);
              }
            } 
            // If payment intent is captured (succeeded), create a full refund
            else if (paymentIntent.status === 'succeeded') {
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
                    amount: paymentIntent.amount.toString(), // Full refund
                  }).toString(),
                }
              );

              if (refundResponse.ok) {
                refundStatus = 'refunded';
                console.log('[DenyOrder] Payment refunded successfully');
              } else {
                const refundError = await refundResponse.text();
                console.error('[DenyOrder] Failed to refund payment:', refundError);
              }
            }
          } else {
            const error = await paymentIntentResponse.text();
            console.error('[DenyOrder] Failed to retrieve payment intent:', error);
          }
        } catch (stripeError) {
          console.error('[DenyOrder] Stripe API error:', stripeError);
          // Continue with order cancellation even if Stripe refund fails
        }
      }
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
      console.error('[DenyOrder] Error:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError?.message || 'Failed to deny order',
      });
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
