import { publicProcedure } from "../../../create-context";
import { z } from "zod";

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
      .select(`
        *,
        author:profiles!reviews_author_id_fkey (
          username,
          profile_image
        )
      `);

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

    return (data || []).map((review: any) => ({
      id: review.id,
      mealId: review.meal_id,
      authorId: review.author_id,
      authorName: review.author?.username || 'Anonymous',
      authorImage: review.author?.profile_image,
      rating: review.rating,
      comment: review.comment,
      createdAt: new Date(review.created_at),
    }));
  });
