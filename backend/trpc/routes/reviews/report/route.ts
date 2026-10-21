import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { notifyParty } from '../../../../lib/account-notice';
import { adminIdsFromProfiles, reviewReportNotice } from '../../../../lib/admin-role';

export const reportReviewCommentProcedure = protectedProcedure
  .input(z.object({
    reviewId: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.supabaseAdmin
      .from('reviews')
      .select('id, comment, author_id, meal_id')
      .eq('id', input.reviewId)
      .maybeSingle();
    if (existing.error || !existing.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That review is not on this plate.' });
    }
    if (!String(existing.data.comment || '').trim()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That comment is already gone.' });
    }
    if (existing.data.author_id === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot report your own comment.' });
    }

    const prior = await ctx.supabaseAdmin
      .from('audit_logs')
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('action', 'REVIEW_REPORT')
      .eq('record_id', input.reviewId)
      .limit(1);
    if (prior.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'This report could not be saved.' });
    }
    if ((prior.data || []).length > 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You already reported this comment.' });
    }

    const saved = await ctx.supabaseAdmin.from('audit_logs').insert({
      user_id: ctx.userId,
      action: 'REVIEW_REPORT',
      table_name: 'reviews',
      record_id: input.reviewId,
      new_data: { mealId: existing.data.meal_id, authorId: existing.data.author_id },
    });
    if (saved.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'This report could not be saved.' });
    }

    const withRoles = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, is_admin, main_admin, monitor_admin')
      .or('is_admin.eq.true,main_admin.eq.true,monitor_admin.eq.true');
    const admins = withRoles.error
      ? await ctx.supabaseAdmin
        .from('profiles')
        .select('id, is_admin')
        .eq('is_admin', true)
      : withRoles;
    const meal = await ctx.supabaseAdmin.from('meals').select('name').eq('id', existing.data.meal_id).maybeSingle();
    const notice = reviewReportNotice(meal.data?.name);
    const adminRows = (admins.data || []) as { id?: string | null; is_admin?: boolean | null; main_admin?: boolean | null; monitor_admin?: boolean | null }[];
    for (const adminId of adminIdsFromProfiles(adminRows)) {
      if (adminId === ctx.userId) continue;
      try {
        await notifyParty(ctx.supabaseAdmin, adminId, 'reviewsRatings', notice, { evenWhenKindOff: true });
      } catch (noticeError) {
        console.error('[ReviewReport] An admin was not told:', noticeError);
      }
    }
    return { reported: true };
  });
