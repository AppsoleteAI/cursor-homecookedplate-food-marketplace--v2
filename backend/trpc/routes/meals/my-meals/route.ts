import { z } from "zod";
import { protectedProcedure } from "../../../create-context";

export const myMealsProcedure = protectedProcedure
  .input(z.object({ summary: z.boolean().optional() }).optional())
  .query(async ({ ctx, input }) => {
    if (input?.summary === true) {
      const { data, error } = await ctx.supabase
        .from('meals')
        .select('id, user_id, name, published, created_at')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[MyMeals] Error:', error);
        throw new Error(error.message);
      }
      return (data || []).map((meal) => ({
        id: meal.id,
        ownerId: meal.user_id,
        name: meal.name,
        category: '',
        price: 0,
        ingredients: [] as string[],
        media: [] as { uri: string; type: 'image' }[],
        freshness: { expiryDate: null, receiptDate: null, attachments: [] as string[] },
        createdAt: new Date(meal.created_at),
        published: meal.published === true,
      }));
    }

    const { data, error } = await ctx.supabase
      .from('meals')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MyMeals] Error:', error);
      throw new Error(error.message);
    }

    return (data || []).map((meal) => ({
      id: meal.id,
      ownerId: meal.user_id,
      name: meal.name,
      category: meal.category,
      price: parseFloat(meal.price),
      ingredients: meal.ingredients,
      media: (meal.images || []).map((uri: string) => ({ uri, type: 'image' as const })),
      freshness: {
        expiryDate: meal.expiry_date,
        receiptDate: meal.receipt_date,
        attachments: [],
      },
      createdAt: new Date(meal.created_at),
      published: meal.published === true,
    }));
  });
