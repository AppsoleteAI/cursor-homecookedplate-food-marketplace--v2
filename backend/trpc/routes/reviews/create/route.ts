import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { notifyParty } from "../../../../lib/account-notice";
import { missingBuyerColumn, orderBuyerId } from "../../../../lib/order-row";
import { reviewAverage } from "../../../../lib/review-stars";
import { screenReviewComment } from "../../../../lib/comment-language";

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
      comment: z.string().max(200, 'A review comment can be 200 characters.').optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const screened = screenReviewComment(input.comment);
    if (!screened.ok) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: screened.message });
    }
    const meal = await ctx.supabaseAdmin.from('meals').select('user_id, name').eq('id', input.mealId).maybeSingle();
    if (!meal.data?.user_id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
    }
    if (meal.data.user_id === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'A cook cannot review their own plate.' });
    }
    let order = await ctx.supabaseAdmin
      .from('orders')
      .select('seller_id, status, meal_id, buyer_id')
      .eq('id', input.orderId)
      .maybeSingle();
    if (order.error && missingBuyerColumn(order.error.message)) {
      order = await ctx.supabaseAdmin
        .from('orders')
        .select('seller_id, status, meal_id, platetaker_id')
        .eq('id', input.orderId)
        .maybeSingle();
    }
    const buyerId = orderBuyerId(order.data || {});
    if (order.error || !order.data || order.data.meal_id !== input.mealId || buyerId !== ctx.userId || order.data.status !== 'completed') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'A review needs a completed order for this plate.' });
    }
    if (order.data.seller_id === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'A cook cannot review their own plate.' });
    }

    const { data, error } = await ctx.supabase
      .from('reviews')
      .insert({
        meal_id: input.mealId,
        order_id: input.orderId, // Required by RLS policy
        author_id: ctx.userId,
        rating: input.rating,
        comment: screened.value,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[CreateReview] Error:', error);
      throw new Error(error?.message || 'Failed to create review');
    }

    const stored = await ctx.supabaseAdmin.from('reviews').select('rating').eq('meal_id', input.mealId);
    if (!stored.error) {
      const stars = reviewAverage((stored.data || []).map((row: { rating?: number }) => Number(row.rating)));
      await ctx.supabaseAdmin.from('meals').update({
        rating: stars.average,
        review_count: stars.count,
      }).eq('id', input.mealId);
    }

    if (meal.data.user_id !== ctx.userId) {
      await notifyParty(ctx.supabaseAdmin, meal.data.user_id, 'reviewsRatings', {
        title: 'New review',
        body: `${input.rating} stars on ${meal.data.name || 'your plate'}.`,
      });
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
