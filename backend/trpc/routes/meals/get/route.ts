import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const getMealProcedure = publicProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('meals')
      .select(`
        *,
        profiles:user_id (
          username,
          business_name
        )
      `)
      .eq('id', input.id)
      .single();

    if (error || !data) {
      throw new Error('Meal not found');
    }

    return {
      id: data.id,
      plateMakerId: data.user_id,
      plateMakerName: data.profiles?.business_name || data.profiles?.username || 'Unknown',
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
      rating: parseFloat(data.rating || '0'),
      reviewCount: data.review_count,
      featured: data.featured,
      tags: data.tags,
    };
  });
