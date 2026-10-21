import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';

export const unpublishMealProcedure = protectedProcedure
  .input(z.object({ mealId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { data: meal, error } = await ctx.supabaseAdmin
      .from('meals')
      .select('id, user_id')
      .eq('id', input.mealId)
      .maybeSingle();
    if (error || !meal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on your list.' });
    }
    if (meal.user_id !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the cook who listed this plate can unpublish it.' });
    }
    const saved = await ctx.supabaseAdmin
      .from('meals')
      .update({ published: false, available: false })
      .eq('id', input.mealId)
      .eq('user_id', ctx.userId);
    if (saved.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This plate could not be unpublished.' });
    }
    return { id: input.mealId, published: false };
  });
