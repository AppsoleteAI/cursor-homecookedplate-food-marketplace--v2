import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { countAreaMealsWithMedia, visibleSampleMeals } from "@/lib/sample-meals";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";

export const listMealsProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string().optional(),
      cuisine: z.string().optional(),
      category: z.string().optional(),
      featured: z.boolean().optional(),
      metroArea: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional()
  )
  .query(async ({ input, ctx }) => {
    let query = ctx.supabase
      .from('meals')
      .select('*')
      .eq('published', true)
      .eq('available', true);

    if (input?.userId) {
      query = query.eq('user_id', input.userId);
    }
    if (input?.cuisine) {
      query = query.eq('cuisine', input.cuisine);
    }
    if (input?.category) {
      query = query.eq('category', input.category);
    }
    if (input?.featured !== undefined) {
      query = query.eq('featured', input.featured);
    }

    if (input?.limit) {
      query = query.limit(input.limit);
    }
    if (input?.offset) {
      query = query.range(input.offset, input.offset + (input.limit || 10) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[ListMeals] Error:', error);
      throw new Error(error.message);
    }

    const cooks = await loadPublicProfiles(
      ctx.supabaseAdmin,
      (data || []).map((meal: { user_id: string }) => meal.user_id)
    );

    const realMeals = (data || []).map((meal: any) => ({
      id: meal.id,
      plateMakerId: meal.user_id,
      plateMakerName: displayName(cooks.get(meal.user_id)),
      name: meal.name,
      description: meal.description,
      price: parseFloat(meal.price),
      images: meal.images,
      ingredients: meal.ingredients,
      cuisine: meal.cuisine,
      category: meal.category,
      dietaryOptions: meal.dietary_options,
      preparationTime: meal.preparation_time,
      available: meal.available,
      rating: parseFloat(meal.rating || '0'),
      reviewCount: meal.review_count,
      featured: meal.featured,
      tags: meal.tags,
      isSample: false,
    }));

    if (input?.userId) return realMeals;

    const realWithMedia = await countAreaMealsWithMedia(ctx.supabase, input?.metroArea);
    const realIds = new Set(realMeals.map((meal) => meal.id));
    const samples = visibleSampleMeals(realWithMedia).filter((meal) => {
      if (realIds.has(meal.id)) return false;
      if (input?.cuisine && meal.cuisine !== input.cuisine) return false;
      if (input?.category && meal.category !== input.category) return false;
      if (input?.featured !== undefined && Boolean(meal.featured) !== input.featured) return false;
      return true;
    });

    return [...realMeals, ...samples];
  });
