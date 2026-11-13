import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { orderBuyerId, readOrderQuery, writeOrderPatch } from '../../../../lib/order-row';
import { orderPaidState, orderPaymentConfirmed } from '../../../../lib/order-payment';

export const abandonUnpaidOrdersProcedure = protectedProcedure
  .input(z.object({
    orderIds: z.array(z.string().uuid()).min(1).max(20),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await readOrderQuery((columns) => ctx.supabaseAdmin
      .from('orders')
      .select(columns)
      .in('id', input.orderIds) as PromiseLike<{ data: any; error: { message?: string } | null }>);
    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not close the unpaid order.' });
    }

    const stripeSecret = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    const ids: string[] = [];
    for (const order of (data || []) as any[]) {
      if (orderBuyerId(order) !== ctx.userId || order.status !== 'pending') continue;
      if (orderPaidState(order) === 'paid') continue;
      if (orderPaidState(order) === 'absent' && await orderPaymentConfirmed(order, ctx.supabaseAdmin, stripeSecret)) continue;
      ids.push(order.id as string);
    }
    if (ids.length === 0) return { cancelled: 0 };

    const update = await writeOrderPatch(
      (patch) => ctx.supabaseAdmin.from('orders').update(patch).in('id', ids),
      { status: 'cancelled', paid: false },
    );
    if (update.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not close the unpaid order.' });
    }
    return { cancelled: ids.length };
  });
