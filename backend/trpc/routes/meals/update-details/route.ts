import { protectedProcedure } from '../../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sanitizeTextArray, sanitizeTextField } from '../../../../lib/text-security';
import { cuisineToMealCategory, portionTag, timeZoneTag } from '@/lib/meal-publish';

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const updateMealDetailsProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string().min(1),
      cuisine: z.string().min(1),
      ingredients: z.array(z.string()).min(1),
      expiryDate: dateField,
      receiptDate: dateField,
      portions: z.number().int().min(1).max(100).optional(),
      cookTimeZone: z.string().max(80).optional(),
    }).refine((value) => Boolean(value.expiryDate || value.receiptDate), {
      message: 'Add an expiration date or a receipt date.',
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const cuisineResult = sanitizeTextField(input.cuisine);
    const ingredientsResult = sanitizeTextArray(input.ingredients);
    if (cuisineResult.blocked || ingredientsResult.blocked || cuisineResult.value.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Meal content contains disallowed text. Please review your submission.',
      });
    }
    const ingredients = ingredientsResult.values.filter((value) => value.length > 0);
    if (ingredients.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'List the ingredients.' });
    }

    const current = await ctx.supabase
      .from('meals')
      .select('tags')
      .eq('id', input.mealId)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (current.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save meal details.' });
    }
    const tags = Array.isArray(current.data?.tags) ? current.data.tags as string[] : [];
    const zone = timeZoneTag(input.cookTimeZone);
    const nextTags = [
      ...tags.filter((tag) => !/^portions:\d+$/.test(tag) && !tag.startsWith('tz:')),
      ...(input.portions ? [portionTag(input.portions)] : tags.filter((tag) => /^portions:\d+$/.test(tag))),
      ...(zone ? [zone] : tags.filter((tag) => tag.startsWith('tz:'))),
    ];

    const { data, error } = await ctx.supabase
      .from('meals')
      .update({
        cuisine: cuisineResult.value,
        category: cuisineToMealCategory(cuisineResult.value),
        ingredients,
        description: ingredients.join(', '),
        expiry_date: input.expiryDate ?? null,
        receipt_date: input.receiptDate ?? null,
        tags: nextTags,
        published: true,
      })
      .eq('id', input.mealId)
      .eq('user_id', ctx.userId)
      .select('id, cuisine, category, ingredients, expiry_date, receipt_date')
      .maybeSingle();

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save meal details.' });
    }
    if (!data) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only update your own plate.' });
    }

    return {
      id: data.id,
      cuisine: data.cuisine,
      category: data.category,
      ingredients: data.ingredients,
      expiryDate: data.expiry_date,
      receiptDate: data.receipt_date,
    };
  });
