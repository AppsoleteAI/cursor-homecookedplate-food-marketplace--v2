import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

export const updatePaymentIntentProcedure = protectedProcedure
  .input(
    z.object({
      orderIds: z.array(z.string().uuid()),
      paymentIntentId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    if (input.orderIds.length === 0) {
      throw new Error('At least one order ID is required');
    }

    // Update all orders matching the provided IDs in a single atomic operation
    const { data, error } = await ctx.supabase
      .from('orders')
      .update({
        payment_intent_id: input.paymentIntentId,
      })
      .in('id', input.orderIds)
      .select();

    if (error) {
      console.error('[UpdatePaymentIntent] Error:', error);
      throw new Error(error.message || 'Failed to update payment intent');
    }

    if (!data || data.length === 0) {
      throw new Error('No orders were updated. Please verify the order IDs.');
    }

    if (data.length !== input.orderIds.length) {
      console.warn(
        '[UpdatePaymentIntent] Mismatch:',
        `Expected ${input.orderIds.length} orders, updated ${data.length}`
      );
    }

    return {
      success: true,
      updatedCount: data.length,
      orderIds: data.map(order => order.id),
    };
  });
