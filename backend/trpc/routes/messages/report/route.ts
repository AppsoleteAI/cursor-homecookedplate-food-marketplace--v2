import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { orderBuyerId, orderCookId, readOrderQuery } from '../../../../lib/order-row';
import { notifyModerators } from '../../../../lib/content-moderation';

export const reportMessageProcedure = protectedProcedure
  .input(z.object({ messageId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const message = await ctx.supabaseAdmin
      .from('order_messages')
      .select('id, order_id, sender_id, sender_role, text')
      .eq('id', input.messageId)
      .maybeSingle();
    if (message.error || !message.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That message is not in this order.' });
    }
    const reported = message.data;
    if (reported.sender_id === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot report your own message.' });
    }
    const order = await readOrderQuery((columns) => ctx.supabaseAdmin
      .from('orders')
      .select(columns)
      .eq('id', reported.order_id)
      .maybeSingle());
    const buyerId = orderBuyerId(order.data || {});
    if (order.error || !order.data || (buyerId !== ctx.userId && orderCookId(order.data) !== ctx.userId)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not part of this order conversation.' });
    }
    const saved = await ctx.supabaseAdmin.from('content_reports').insert({
      reporter_id: ctx.userId,
      target_type: 'order_message',
      target_id: input.messageId,
      status: 'pending',
    });
    if (saved.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This report was not saved. The moderator queue is not on this kitchen yet.' });
    }
    await ctx.supabaseAdmin.from('order_messages').update({ moderation_status: 'pending' }).eq('id', input.messageId);
    await notifyModerators(ctx.supabaseAdmin, ctx.userId, {
      title: 'Message report',
      body: 'An order message was reported and is waiting for a moderator.',
    });
    return { reported: true };
  });
