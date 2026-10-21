import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure } from '../../../create-context';

export const deleteReviewCommentProcedure = adminProcedure
  .input(z.object({
    reviewId: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.supabaseAdmin
      .from('reviews')
      .select('id, comment, meal_id')
      .eq('id', input.reviewId)
      .maybeSingle();
    if (existing.error || !existing.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That review is not on this plate.' });
    }
    if (!String(existing.data.comment || '').trim()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That comment is already gone.' });
    }

    const removed = await ctx.supabaseAdmin
      .from('reviews')
      .update({ comment: null })
      .eq('id', input.reviewId);
    if (removed.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'That comment could not be removed.' });
    }

    const audit = await ctx.supabaseAdmin.from('audit_logs').insert({
      user_id: ctx.userId,
      action: 'REVIEW_COMMENT_DELETED',
      table_name: 'reviews',
      record_id: input.reviewId,
      new_data: { mealId: existing.data.meal_id },
    });
    if (audit.error) {
      console.error('[DeleteReviewComment] Audit failed:', audit.error.message);
    }
    return { removed: true };
  });
