import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { loadPublicProfiles } from "../../../../lib/public-profiles";
import { commentForViewer, loadReviewComments } from "../../../../lib/content-moderation";
import { PUBLIC_REVIEW_COLUMNS } from "../../../../lib/public-read";
import { timePublicRead } from "../../../../lib/public-read-timing";
import { logPublicReadFailure } from "../../../../lib/request-id";

export const listReviewsProcedure = publicProcedure
  .input(
    z.object({
      mealId: z.string().optional(),
      userId: z.string().optional(),
    }).optional()
  )
  .query(async ({ input, ctx }) => {
    const { data, error } = await timePublicRead("listReviews", ctx, async () => {
      let query = ctx.supabaseRead
        .from('reviews')
        .select(PUBLIC_REVIEW_COLUMNS);

      if (input?.mealId) {
        query = query.eq('meal_id', input.mealId);
      }
      if (input?.userId) {
        query = query.eq('author_id', input.userId);
      }

      return await query.order('created_at', { ascending: false }) as unknown as Promise<{ data: any[] | null; error: { message?: string } | null }>;
    });

    if (error) {
      logPublicReadFailure("listReviews", ctx.requestId, error.message || 'listReviews failed');
      throw new Error(error.message || 'listReviews failed');
    }

    const comments = await loadReviewComments(
      ctx.supabaseAdmin,
      (data || []).map((review: { id?: string }) => review.id || ''),
    );
    const authors = await loadPublicProfiles(
      ctx.supabaseAdmin,
      (data || []).map((review: { author_id: string }) => review.author_id)
    );
    const mealIds = [...new Set((data || []).map((review: { meal_id?: string }) => review.meal_id).filter(Boolean))] as string[];
    const mealNames = new Map<string, string>();
    if (mealIds.length > 0) {
      const meals = await ctx.supabaseAdmin.from('meals').select('id, name').in('id', mealIds);
      for (const meal of meals.data || []) {
        if (meal.id && meal.name) mealNames.set(meal.id, meal.name);
      }
    }

    return (data || []).map((review: any) => ({
      id: review.id,
      mealId: review.meal_id,
      mealName: mealNames.get(review.meal_id) || '',
      orderId: review.order_id,
      authorId: review.author_id,
      authorName: authors.get(review.author_id)?.username || 'Anonymous',
      authorImage: authors.get(review.author_id)?.profile_image,
      rating: review.rating,
      ...commentForViewer(
        comments.get(review.id)?.comment,
        comments.get(review.id)?.comment_status,
        review.author_id,
        ctx.userId,
      ),
      createdAt: new Date(review.created_at),
    }));
  });
