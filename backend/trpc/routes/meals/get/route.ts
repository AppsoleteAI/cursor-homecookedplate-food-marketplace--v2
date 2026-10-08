import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";
import { countAreaMealsWithMedia, isSampleMealId, visibleSampleMeals } from "@/lib/sample-meals";

export const getMealProcedure = publicProcedure
  .input(z.object({ id: z.string(), metroArea: z.string().optional() }))
  .query(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('meals')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();

    if (!data) {
      if (!isSampleMealId(input.id)) {
        throw new Error(error?.message || 'Meal not found');
      }
      const realWithMedia = await countAreaMealsWithMedia(ctx.supabase, input.metroArea);
      const sample = visibleSampleMeals(realWithMedia).find((meal) => meal.id === input.id);
      if (!sample) throw new Error('Meal not found');
      return {
        id: sample.id,
        plateMakerId: sample.plateMakerId,
        plateMakerName: sample.plateMakerName,
        name: sample.name,
        description: sample.description,
        price: sample.price,
        images: sample.images,
        ingredients: sample.ingredients,
        cuisine: sample.cuisine,
        category: sample.category,
        dietaryOptions: sample.dietaryOptions,
        preparationTime: sample.preparationTime,
        available: false,
        rating: sample.rating,
        reviewCount: sample.reviewCount,
        featured: sample.featured,
        tags: sample.tags,
        isSample: true,
      };
    }

    const cooks = await loadPublicProfiles(ctx.supabaseAdmin, [data.user_id]);

    return {
      id: data.id,
      plateMakerId: data.user_id,
      plateMakerName: displayName(cooks.get(data.user_id)),
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
      isSample: false,
    };
  });
