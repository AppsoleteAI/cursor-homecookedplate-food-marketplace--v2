import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

export const createMealProcedure = protectedProcedure
  .input(
    z.object({
      name: z.string(),
      description: z.string(),
      price: z.number().positive(),
      images: z.array(z.string()),
      ingredients: z.array(z.string()),
      cuisine: z.string(),
      category: z.enum(['breakfast', 'lunch', 'dinner', 'dessert', 'snack']),
      dietaryOptions: z.array(z.string()).optional(),
      preparationTime: z.number().positive(),
      tags: z.array(z.string()).optional(),
      expiryDate: z.string().optional(),
      receiptDate: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('meals')
      .insert({
        user_id: ctx.userId,
        name: input.name,
        description: input.description,
        price: input.price,
        images: input.images,
        ingredients: input.ingredients,
        cuisine: input.cuisine,
        category: input.category,
        dietary_options: input.dietaryOptions || [],
        preparation_time: input.preparationTime,
        tags: input.tags || [],
        expiry_date: input.expiryDate,
        receipt_date: input.receiptDate,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[CreateMeal] Error:', error);
      throw new Error(error?.message || 'Failed to create meal');
    }

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      images: data.images,
      ingredients: data.ingredients,
      cuisine: data.cuisine,
      category: data.category,
      dietaryOptions: data.dietary_options,
      preparationTime: data.preparation_time,
      available: data.available,
      published: data.published,
      rating: parseFloat(data.rating || '0'),
      reviewCount: data.review_count,
      featured: data.featured,
      tags: data.tags,
      expiryDate: data.expiry_date,
      receiptDate: data.receipt_date,
      createdAt: new Date(data.created_at),
    };
  });
