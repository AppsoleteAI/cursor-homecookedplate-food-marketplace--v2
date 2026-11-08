import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { notifyModerators } from '../../../../lib/content-moderation';
import { isStoredVideoAddress } from '@/lib/food-review-clips';
import { mealImageReportId, setMealImageHeld, setProfileImageHeld } from '../../../../lib/hidden-clips';

const QUEUE = 'This report was not saved. The moderator queue is not on this kitchen yet.';

export const reportMealImageProcedure = protectedProcedure
  .input(z.object({
    mealId: z.string().min(1).max(80),
    imageUrl: z.string().url().max(500),
  }))
  .mutation(async ({ input, ctx }) => {
    if (isStoredVideoAddress(input.imageUrl)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Report a video from the clip.' });
    }
    const meal = await ctx.supabaseAdmin
      .from('meals')
      .select('id, user_id, images')
      .eq('id', input.mealId)
      .maybeSingle();
    if (meal.error || !meal.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
    }
    if (meal.data.user_id === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot report your own photo.' });
    }
    const images = Array.isArray(meal.data.images) ? meal.data.images : [];
    if (!images.includes(input.imageUrl)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That photo is not on this plate.' });
    }
    const saved = await ctx.supabaseAdmin.from('content_reports').insert({
      reporter_id: ctx.userId,
      target_type: 'meal_image',
      target_id: mealImageReportId(input.mealId, input.imageUrl),
      status: 'pending',
    });
    if (saved.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: QUEUE });
    }
    const held = await setMealImageHeld(ctx.supabaseAdmin, input.mealId, input.imageUrl, true);
    if (!held) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: QUEUE });
    }
    await notifyModerators(ctx.supabaseAdmin, ctx.userId, {
      title: 'Photo report',
      body: 'A food photo is waiting for a moderator.',
    });
    return { reported: true };
  });

export const reportProfileImageProcedure = protectedProcedure
  .input(z.object({
    userId: z.string().uuid(),
  }))
  .mutation(async ({ input, ctx }) => {
    if (input.userId === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot report your own photo.' });
    }
    const profile = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, profile_image')
      .eq('id', input.userId)
      .maybeSingle();
    if (profile.error || !profile.data?.profile_image) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That profile photo is not on this account.' });
    }
    const saved = await ctx.supabaseAdmin.from('content_reports').insert({
      reporter_id: ctx.userId,
      target_type: 'profile_image',
      target_id: input.userId,
      status: 'pending',
    });
    if (saved.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: QUEUE });
    }
    const held = await setProfileImageHeld(ctx.supabaseAdmin, input.userId, true);
    if (!held) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: QUEUE });
    }
    await notifyModerators(ctx.supabaseAdmin, ctx.userId, {
      title: 'Profile photo report',
      body: 'A profile photo is waiting for a moderator.',
    });
    return { reported: true };
  });
