import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure } from '../../../create-context';
import { notifyParty } from '../../../../lib/account-notice';
import { missingBuyerColumn, orderBuyerId } from '../../../../lib/order-row';
import { scanText } from '../../../../lib/text-security';

async function otherParty(admin: { from: (table: string) => any }, orderId: string, senderId: string) {
  let order = await admin.from('orders').select('buyer_id, seller_id').eq('id', orderId).maybeSingle();
  if (order.error && missingBuyerColumn(order.error.message)) {
    order = await admin.from('orders').select('platetaker_id, seller_id').eq('id', orderId).maybeSingle();
  }
  if (!order.data) return null;
  const buyerId = orderBuyerId(order.data);
  return senderId === buyerId ? order.data.seller_id : buyerId;
}

export const listModerationQueueProcedure = adminProcedure.query(async ({ ctx }) => {
  const messages = await ctx.supabaseAdmin
    .from('order_messages')
    .select('id, text, sender_role, created_at')
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);
  const notes = await ctx.supabaseAdmin
    .from('orders')
    .select('id, special_instructions, created_at')
    .eq('instructions_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);
  const comments = await ctx.supabaseAdmin
    .from('reviews')
    .select('id, comment, created_at')
    .eq('comment_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);
  const reports = await ctx.supabaseAdmin
    .from('content_reports')
    .select('id, target_type, target_id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  return {
    messages: (messages.data || []).map((row: { id: string; text: string; sender_role: string; created_at: string }) => ({
      id: row.id,
      kind: 'message' as const,
      text: row.text,
      detail: row.sender_role,
      createdAt: row.created_at,
    })),
    notes: (notes.data || []).map((row: { id: string; special_instructions: string | null; created_at: string }) => ({
      id: row.id,
      kind: 'note' as const,
      text: row.special_instructions || '',
      detail: 'plate note',
      createdAt: row.created_at,
    })),
    comments: (comments.data || []).map((row: { id: string; comment: string | null; created_at: string }) => ({
      id: row.id,
      kind: 'comment' as const,
      text: row.comment || '',
      detail: 'review comment',
      createdAt: row.created_at,
    })),
    reports: (reports.data || []).map((row: { id: string; target_type: string; target_id: string; created_at: string }) => ({
      id: row.id,
      kind: 'report' as const,
      text: row.target_id,
      detail: row.target_type,
      createdAt: row.created_at,
    })),
  };
});

export const decideModerationProcedure = adminProcedure
  .input(z.object({
    kind: z.enum(['message', 'note', 'comment', 'report']),
    id: z.string().min(1),
    decision: z.enum(['allow', 'remove']),
  }))
  .mutation(async ({ ctx, input }) => {
    if (input.kind === 'message') {
      const row = await ctx.supabaseAdmin.from('order_messages').select('id, order_id, sender_id, text').eq('id', input.id).maybeSingle();
      if (!row.data) throw new TRPCError({ code: 'NOT_FOUND', message: 'That message is not waiting.' });
      const status = input.decision === 'allow' ? 'allowed' : 'removed';
      const saved = await ctx.supabaseAdmin.from('order_messages').update({ moderation_status: status }).eq('id', input.id);
      if (saved.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That message was not updated.' });
      if (status === 'allowed') {
        const otherId = await otherParty(ctx.supabaseAdmin, row.data.order_id, row.data.sender_id);
        if (otherId) {
          await notifyParty(ctx.supabaseAdmin, otherId, 'newMessages', {
            title: 'New message',
            body: String(row.data.text || '').slice(0, 140),
          });
        }
      }
      return { status };
    }

    if (input.kind === 'note') {
      const status = input.decision === 'allow' ? 'allowed' : 'removed';
      const row = await ctx.supabaseAdmin.from('orders').select('id, seller_id').eq('id', input.id).maybeSingle();
      if (!row.data) throw new TRPCError({ code: 'NOT_FOUND', message: 'That note is not waiting.' });
      const saved = await ctx.supabaseAdmin.from('orders').update({ instructions_status: status }).eq('id', input.id);
      if (saved.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That note was not updated.' });
      if (status === 'allowed' && row.data.seller_id) {
        await notifyParty(ctx.supabaseAdmin, row.data.seller_id, 'orderUpdates', {
          title: 'Plate note',
          body: 'A moderator released a note on an order.',
        });
      }
      return { status };
    }

    if (input.kind === 'comment') {
      const row = await ctx.supabaseAdmin.from('reviews').select('id, meal_id, rating, comment').eq('id', input.id).maybeSingle();
      if (!row.data) throw new TRPCError({ code: 'NOT_FOUND', message: 'That comment is not waiting.' });
      if (input.decision === 'remove') {
        const saved = await ctx.supabaseAdmin.from('reviews').update({ comment: null, comment_status: 'removed' }).eq('id', input.id);
        if (saved.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That comment was not removed.' });
        return { status: 'removed' };
      }
      const saved = await ctx.supabaseAdmin.from('reviews').update({ comment_status: 'allowed' }).eq('id', input.id);
      if (saved.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That comment was not released.' });
      const meal = await ctx.supabaseAdmin.from('meals').select('user_id, name').eq('id', row.data.meal_id).maybeSingle();
      if (meal.data?.user_id) {
        await notifyParty(ctx.supabaseAdmin, meal.data.user_id, 'reviewsRatings', {
          title: 'New review',
          body: `${row.data.rating} stars on ${meal.data.name || 'your plate'}.`,
        });
      }
      return { status: 'allowed' };
    }

    const report = await ctx.supabaseAdmin.from('content_reports').select('id, target_type, target_id').eq('id', input.id).maybeSingle();
    if (!report.data) throw new TRPCError({ code: 'NOT_FOUND', message: 'That report is not waiting.' });
    const status = input.decision === 'allow' ? 'allowed' : 'removed';
    const saved = await ctx.supabaseAdmin.from('content_reports').update({ status }).eq('id', input.id);
    if (saved.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That report was not updated.' });
    if (report.data.target_type === 'clip') {
      await ctx.supabaseAdmin.from('food_review_clips').update({ hidden: status !== 'allowed' }).eq('id', report.data.target_id);
    }
    if (report.data.target_type === 'order_message' && status === 'removed') {
      await ctx.supabaseAdmin.from('order_messages').update({ moderation_status: 'removed' }).eq('id', report.data.target_id);
    }
    if (report.data.target_type === 'order_message' && status === 'allowed') {
      const row = await ctx.supabaseAdmin.from('order_messages').select('id, order_id, sender_id, text, moderation_status').eq('id', report.data.target_id).maybeSingle();
      if (row.data?.moderation_status === 'pending') {
        await ctx.supabaseAdmin.from('order_messages').update({ moderation_status: 'allowed' }).eq('id', report.data.target_id);
        const otherId = await otherParty(ctx.supabaseAdmin, row.data.order_id, row.data.sender_id);
        if (otherId) {
          await notifyParty(ctx.supabaseAdmin, otherId, 'newMessages', {
            title: 'New message',
            body: String(row.data.text || '').slice(0, 140),
          });
        }
      }
    }
    return { status };
  });

export const rescanStoredTextProcedure = adminProcedure.mutation(async ({ ctx }) => {
  let removed = 0;
  const messages = await ctx.supabaseAdmin
    .from('order_messages')
    .select('id, text')
    .eq('security_checked', false)
    .limit(100);
  if (messages.error) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Saved text cannot be checked until the moderator columns are on this kitchen.' });
  }
  for (const row of messages.data || []) {
    const scanned = scanText(String(row.text || ''));
    const status = scanned.blocked ? 'removed' : undefined;
    await ctx.supabaseAdmin.from('order_messages').update({
      security_checked: true,
      ...(status ? { moderation_status: status } : {}),
    }).eq('id', row.id);
    if (status) removed += 1;
  }
  const notes = await ctx.supabaseAdmin
    .from('orders')
    .select('id, special_instructions')
    .is('instructions_status', null)
    .not('special_instructions', 'is', null)
    .limit(100);
  for (const row of notes.data || []) {
    const scanned = scanText(String(row.special_instructions || ''));
    await ctx.supabaseAdmin.from('orders').update({
      instructions_status: scanned.blocked ? 'removed' : 'allowed',
    }).eq('id', row.id);
    if (scanned.blocked) removed += 1;
  }
  const plates = await ctx.supabaseAdmin
    .from('meals')
    .select('id, name, description')
    .eq('published', true)
    .limit(50);
  for (const row of plates.data || []) {
    const name = scanText(String(row.name || ''));
    const description = scanText(String(row.description || ''));
    if (!name.blocked && !description.blocked) continue;
    await ctx.supabaseAdmin.from('meals').update({ published: false }).eq('id', row.id);
    removed += 1;
  }
  return { removed };
});
