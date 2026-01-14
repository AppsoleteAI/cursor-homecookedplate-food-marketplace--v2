import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

export const updateOrderStatusProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string(),
      status: z.enum(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data: order, error: checkError } = await ctx.supabase
      .from('orders')
      .select('buyer_id, seller_id')
      .eq('id', input.orderId)
      .single();

    if (checkError || !order) {
      throw new Error('Order not found');
    }

    if (order.buyer_id !== ctx.userId && order.seller_id !== ctx.userId) {
      throw new Error('Not authorized to update this order');
    }

    const { data, error } = await ctx.supabase
      .from('orders')
      .update({ status: input.status })
      .eq('id', input.orderId)
      .select()
      .single();

    if (error || !data) {
      console.error('[UpdateOrderStatus] Error:', error);
      throw new Error(error?.message || 'Failed to update order status');
    }

    return {
      id: data.id,
      status: data.status,
    };
  });
