import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * Accept Order Procedure
 * 
 * Allows platemakers to accept pending orders.
 * Optionally accepts an estimated completion time (ETA).
 * 
 * SECURITY:
 * - Only platemakers can accept their own orders
 * - Verifies order belongs to platemaker (seller_id = ctx.userId)
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
    const { data: order, error: orderError } = await ctx.supabase
      .from('orders')
      .select('id, seller_id, status, payment_intent_id, paid')
      .eq('id', input.orderId)
      .single();

    if (orderError || !order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // CRITICAL: Ensure only the assigned platemaker (seller) can accept
    if (order.seller_id !== ctx.userId) {
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
      .eq('seller_id', ctx.userId) // Double-check: ensure only the seller can update
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('[AcceptOrder] Error:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError?.message || 'Failed to accept order',
      });
    }

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      estimatedCompletionTime: updatedOrder.estimated_completion_time
        ? new Date(updatedOrder.estimated_completion_time)
        : null,
      message: 'Order has been accepted successfully',
    };
  });
