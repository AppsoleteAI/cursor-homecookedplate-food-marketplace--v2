import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { countAreaMealsWithMedia, visibleSampleMeals } from "@/lib/sample-meals";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";
import { mealVisibleInMetro } from "../../../../lib/metro-menu";
import { publicMenuKeepsPlate } from "@/lib/cart-line";
import { loadActiveOffers } from "../../../../lib/active-offer";

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
    let viewerMetro = input?.userId ? undefined : input?.metroArea?.trim() || undefined;
    if (!input?.userId) {
      if (!ctx.userId) {
        viewerMetro = undefined;
      } else {
        const profile = await ctx.supabaseAdmin.from('profiles').select('metro_area').eq('id', ctx.userId).maybeSingle();
        const saved = typeof profile.data?.metro_area === 'string' ? profile.data.metro_area.trim() : '';
        viewerMetro = saved || undefined;
      }
    }
    const area = viewerMetro;
    const base = () => {
      const select = area
        ? '*, cook:profiles!meals_user_id_fkey!inner(metro_area)'
        : '*';
      let query = ctx.supabase
        .from('meals')
        .select(select)
        .eq('published', true)
        .eq('available', true);
      if (input?.userId) query = query.eq('user_id', input.userId);
      if (input?.cuisine) query = query.eq('cuisine', input.cuisine);
      if (input?.category) query = query.eq('category', input.category);
      if (input?.featured !== undefined) query = query.eq('featured', input.featured);
      if (area === 'Remote/Other') {
        query = query.or('metro_area.is.null,metro_area.eq.,metro_area.eq."Remote/Other"', { referencedTable: 'cook' });
      } else if (area) {
        query = query.eq('cook.metro_area', area);
      }
      if (input?.limit) query = query.limit(input.limit);
      if (input?.offset) query = query.range(input.offset, input.offset + (input.limit || 10) - 1);
      return query.order('created_at', { ascending: false });
    };

    let { data, error } = await base() as {
      data: { id: string; user_id: string }[] | null;
      error: { message: string } | null;
    };
    let joinFailed = false;
    if (error && area) {
      joinFailed = true;
      let fallback = ctx.supabase.from('meals').select('*').eq('published', true).eq('available', true);
      if (input?.cuisine) fallback = fallback.eq('cuisine', input.cuisine);
      if (input?.category) fallback = fallback.eq('category', input.category);
      if (input?.featured !== undefined) fallback = fallback.eq('featured', input.featured);
      const retry = await fallback.order('created_at', { ascending: false }) as {
        data: { id: string; user_id: string }[] | null;
        error: { message: string } | null;
      };
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[ListMeals] Error:', error);
      throw new Error(error.message);
    }

    const cookIds = [...new Set((data || []).map((meal: { user_id: string }) => meal.user_id).filter(Boolean))];
    const cooks = await loadPublicProfiles(ctx.supabaseAdmin, cookIds);
    const metroLookup = cookIds.length === 0
      ? { data: [] as { id: string; metro_area: string | null }[] }
      : await ctx.supabaseAdmin.from('profiles').select('id, metro_area, is_paused, available_for_orders').in('id', cookIds);
    const metroRows = metroLookup.data;
    const cookMetros = new Map<string, string | null>(
      (metroRows || []).map((row: { id: string; metro_area: string | null }) => [row.id, row.metro_area])
    );
    const cookState = new Map<string, { is_paused?: boolean; available_for_orders?: boolean | null }>(
      (metroRows || []).map((row: { id: string; is_paused?: boolean; available_for_orders?: boolean | null }) => [row.id, row])
    );
    const offers = await loadActiveOffers(
      ctx.supabaseAdmin,
      (data || []).map((meal: { id: string }) => meal.id)
    );

    const realMeals = (data || []).filter((meal: { user_id: string }) => {
      if (input?.userId) return true;
      const state = cookState.get(meal.user_id);
      if (!publicMenuKeepsPlate(state?.is_paused, state?.available_for_orders)) return false;
      return mealVisibleInMetro(cookMetros.get(meal.user_id), viewerMetro);
    }).map((meal: any) => ({
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
      acceptingOrders: cookState.get(meal.user_id)?.is_paused !== true && cookState.get(meal.user_id)?.available_for_orders === true,
      rating: parseFloat(meal.rating || '0'),
      reviewCount: meal.review_count,
      featured: meal.featured,
      tags: meal.tags,
      isSample: false,
      promotionalOffer: offers.get(meal.id) ?? undefined,
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

    const merged = [...realMeals, ...samples];
    if (!joinFailed) return merged;
    const start = input?.offset ?? 0;
    return input?.limit ? merged.slice(start, start + input.limit) : merged.slice(start);
  });
