import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { loadPublicProfiles } from "../../../../lib/public-profiles";

export const listReviewsProcedure = publicProcedure
  .input(
    z.object({
      mealId: z.string().optional(),
      userId: z.string().optional(),
    }).optional()
  )
  .query(async ({ input, ctx }) => {
    let query = ctx.supabase
      .from('reviews')
      .select('*');

    if (input?.mealId) {
      query = query.eq('meal_id', input.mealId);
    }
    if (input?.userId) {
      query = query.eq('author_id', input.userId);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[ListReviews] Error:', error);
      throw new Error(error.message);
    }

    const authors = await loadPublicProfiles(
      ctx.supabaseAdmin,
      (data || []).map((review: { author_id: string }) => review.author_id)
    );

    return (data || []).map((review: any) => ({
      id: review.id,
      mealId: review.meal_id,
      authorId: review.author_id,
      authorName: authors.get(review.author_id)?.username || 'Anonymous',
      authorImage: authors.get(review.author_id)?.profile_image,
      rating: review.rating,
      comment: review.comment,
      createdAt: new Date(review.created_at),
    }));
  });
