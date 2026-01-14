import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

export const createReviewProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string(),
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('reviews')
      .insert({
        meal_id: input.mealId,
        author_id: ctx.userId,
        rating: input.rating,
        comment: input.comment,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[CreateReview] Error:', error);
      throw new Error(error?.message || 'Failed to create review');
    }

    return {
      id: data.id,
      mealId: data.meal_id,
      authorId: data.author_id,
      rating: data.rating,
      comment: data.comment,
      createdAt: new Date(data.created_at),
    };
  });
