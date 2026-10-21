import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { orderBuyerId } from '../../../../lib/order-row';

export const abandonUnpaidOrdersProcedure = protectedProcedure
  .input(z.object({
    orderIds: z.array(z.string().uuid()).min(1).max(20),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from('orders')
      .select('*')
      .in('id', input.orderIds);
    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not close the unpaid order.' });
    }

    const ids = (data || [])
      .filter((order) => orderBuyerId(order) === ctx.userId && order.paid !== true && order.status === 'pending')
      .map((order) => order.id as string);
    if (ids.length === 0) return { cancelled: 0 };

    const update = await ctx.supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled', paid: false })
      .in('id', ids);
    if (update.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not close the unpaid order.' });
    }
    return { cancelled: ids.length };
  });
