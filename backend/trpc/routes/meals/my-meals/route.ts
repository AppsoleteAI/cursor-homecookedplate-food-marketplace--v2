import { protectedProcedure } from "../../../create-context";

export const myMealsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
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
      media: meal.images.map((uri: string) => ({ uri, type: 'image' as const })),
      freshness: {
        expiryDate: meal.expiry_date,
        receiptDate: meal.receipt_date,
        attachments: [],
      },
      createdAt: new Date(meal.created_at),
    }));
  });
