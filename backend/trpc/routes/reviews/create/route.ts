import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

/**
 * Create Review Procedure
 * 
 * SECURITY: Requires order_id to prevent "ghost reviews" (reviews without purchases).
 * The RLS policy "insert_review_after_purchase" enforces:
 * - order_id must exist and belong to the buyer
 * - order status must be 'completed'
 * - No duplicate reviews for the same order
 * 
 * Corresponds to SQL Section 5 in security_enhancements.sql
 */
export const createReviewProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string(),
      orderId: z.string().uuid('orderId must be a valid UUID'), // REQUIRED: Links review to completed order
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('reviews')
      .insert({
        meal_id: input.mealId,
        order_id: input.orderId, // Required by RLS policy
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
      orderId: data.order_id,
      authorId: data.author_id,
      rating: data.rating,
      comment: data.comment,
      createdAt: new Date(data.created_at),
    };
  });
