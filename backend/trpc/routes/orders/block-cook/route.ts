import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { missingBuyerColumn, orderBuyerId } from '../../../../lib/order-row';
import { notifyParty } from '../../../../lib/account-notice';
import { notifyModerators } from '../../../../lib/content-moderation';

export const blockCookProcedure = protectedProcedure
  .input(z.object({
    orderId: z.string().uuid(),
    action: z.enum(['block', 'report', 'unblock']),
  }))
  .mutation(async ({ ctx, input }) => {
    let order = await ctx.supabaseAdmin
      .from('orders')
      .select('seller_id, buyer_id')
      .eq('id', input.orderId)
      .maybeSingle();
    if (order.error && missingBuyerColumn(order.error.message)) {
      order = await ctx.supabaseAdmin
        .from('orders')
        .select('seller_id, platetaker_id')
        .eq('id', input.orderId)
        .maybeSingle();
    }
    const buyerId = orderBuyerId(order.data || {});
    if (order.error || !order.data || buyerId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the PlateTaker on this order can do that.' });
    }
    const cookId = order.data.seller_id;
    if (!cookId || cookId === ctx.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order has no cook to report.' });
    }

    if (input.action === 'unblock') {
      const removed = await ctx.supabaseAdmin
        .from('cook_buyer_blocks')
        .delete()
        .eq('platemaker_id', cookId)
        .eq('platetaker_id', ctx.userId);
      if (removed.error) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This block was not removed.' });
      }
      try {
        await notifyParty(ctx.supabaseAdmin, cookId, 'orderUpdates', {
          title: 'Block removed',
          body: 'A buyer removed a block. They can place a new order.',
        }, { evenWhenOrderUpdatesOff: true });
      } catch (noticeError) {
        console.error('[BlockCook] Unblock notice was not sent:', noticeError);
      }
      return { blocked: false, reported: false };
    }

    if (input.action === 'block') {
      const { error } = await ctx.supabaseAdmin.from('cook_buyer_blocks').insert({
        platemaker_id: cookId,
        platetaker_id: ctx.userId,
      });
      if (error && error.code !== '23505') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This cook was not blocked.' });
      }
      try {
        await notifyParty(ctx.supabaseAdmin, cookId, 'orderUpdates', {
          title: 'Buyer block',
          body: 'A buyer blocked new orders from their account.',
        }, { evenWhenOrderUpdatesOff: true });
      } catch (noticeError) {
        console.error('[BlockCook] Block notice was not sent:', noticeError);
      }
      return { blocked: true, reported: false };
    }

    const saved = await ctx.supabaseAdmin.from('audit_logs').insert({
      user_id: ctx.userId,
      action: 'ORDER_REPORT',
      table_name: 'orders',
      record_id: input.orderId,
      new_data: { cookId },
    });
    if (saved.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This report was not saved.' });
    }
    await ctx.supabaseAdmin.from('content_reports').insert({
      reporter_id: ctx.userId,
      target_type: 'order',
      target_id: input.orderId,
      status: 'pending',
    });
    await notifyModerators(ctx.supabaseAdmin, ctx.userId, {
      title: 'Order report',
      body: 'A PlateTaker reported an order. It is waiting for a moderator.',
    });
    try {
      await notifyParty(ctx.supabaseAdmin, cookId, 'orderUpdates', {
        title: 'Order report',
        body: 'A buyer reported this order.',
      }, { evenWhenOrderUpdatesOff: true });
    } catch (noticeError) {
      console.error('[BlockCook] Report notice was not sent:', noticeError);
    }
    return { blocked: false, reported: true };
  });
