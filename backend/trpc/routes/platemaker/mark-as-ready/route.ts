import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * Mark Order as Ready Procedure
 * 
 * Allows platemakers (sellers) to mark their orders as "ready" for pickup/delivery.
 * Security: Only the assigned seller (seller_id) can update their own orders.
 */
export const markAsReadyProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // First, verify the order exists and the user is the seller
    const { data: order, error: checkError } = await ctx.supabase
      .from('orders')
      .select('id, seller_id, status, buyer_id')
      .eq('id', input.orderId)
      .single();

    if (checkError || !order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Security: Ensure only the assigned platemaker (seller) can mark as ready
    if (order.seller_id !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not authorized to update this order. Only the assigned platemaker can mark orders as ready.',
      });
    }

    // Verify the order is in a valid state to be marked as ready
    // Orders should be in 'accepted' or 'preparing' status before being marked 'ready'
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
      .eq('seller_id', ctx.userId) // Double-check: ensure only the seller can update
      .select()
      .single();

    if (error || !data) {
      console.error('[MarkAsReady] Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'Failed to mark order as ready',
      });
    }

    return {
      id: data.id,
      status: data.status,
      sellerId: data.seller_id,
      buyerId: data.buyer_id,
      message: 'Order has been marked as ready for pickup/delivery',
    };
  });
