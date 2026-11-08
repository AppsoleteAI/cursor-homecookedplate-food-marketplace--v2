import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";
import { isSampleMealId, visibleSampleMeals } from "@/lib/sample-meals";
import { loadActiveOffers } from "../../../../lib/active-offer";
import { pickupGate } from "../../../../lib/kitchen-pin";
import { buyerMetroCanOrder } from "../../../../lib/metro-menu";
import { buyerPlateLinkOpens } from "@/lib/cart-line";
import { cookPermitIsSaved, countPermittedMealsWithMedia } from "../../../../lib/kitchen-permit";
import { PUBLIC_MEAL_PAGE_COLUMNS } from "../../../../lib/public-read";
import { timePublicRead } from "../../../../lib/public-read-timing";
import { logPublicReadFailure } from "../../../../lib/request-id";
import { hiddenClipVideoAddresses, hiddenMealImages, visiblePlateMedia } from "../../../../lib/hidden-clips";
import { travelBrowseOpen } from "../../../../lib/travel-browse";

export const getMealProcedure = publicProcedure
  .input(z.object({ id: z.string(), metroArea: z.string().optional() }))
  .query(async ({ input, ctx }) => {
    const mealRead = await timePublicRead("getMeal", ctx, () => ctx.supabaseRead
      .from('meals')
      .select(PUBLIC_MEAL_PAGE_COLUMNS)
      .eq('id', input.id)
      .maybeSingle());
    const data = mealRead.data as any;
    const error = mealRead.error;

    if (data && data.user_id !== ctx.userId && !(await cookPermitIsSaved(ctx.supabaseAdmin, data.user_id))) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
    }

    if (data && data.published === false && data.user_id !== ctx.userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
    }

    if (!data) {
      if (!isSampleMealId(input.id)) {
        if (error?.message) logPublicReadFailure("getMeal", ctx.requestId, error.message);
        throw new Error(error?.message || 'Meal not found');
      }
      const realWithMedia = await countPermittedMealsWithMedia(ctx.supabaseAdmin, input.metroArea);
      const sample = visibleSampleMeals(realWithMedia).find((meal) => meal.id === input.id);
      if (!sample) throw new Error('Meal not found');
      return {
        id: sample.id,
        plateMakerId: sample.plateMakerId,
        plateMakerName: sample.plateMakerName,
        plateMakerImage: '',
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
        canOrder: false,
        expiryDate: null,
        receiptDate: null,
      };
    }

    let outsideRange = false;
    const cook = await ctx.supabaseAdmin.from('profiles').select('metro_area, is_paused, available_for_orders').eq('id', data.user_id).maybeSingle();
    if (data.user_id !== ctx.userId) {
      if (!ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
      }
      const buyer = await ctx.supabaseAdmin
        .from('profiles')
        .select('metro_area, role, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, apple_expires_at, apple_revoked_at, google_purchase_token, google_expires_at')
        .eq('id', ctx.userId)
        .maybeSingle();
      if (buyer.error) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
      }
      const buyerMetro = typeof buyer.data?.metro_area === 'string' ? buyer.data.metro_area.trim() : '';
      if (!buyerMetro && !travelBrowseOpen(buyer.data)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
      }
      const gate = await pickupGate(ctx.supabaseAdmin, ctx.userId, [data.user_id]);
      const inRange = gate.mode === 'distance'
        ? gate.ok
        : buyerMetroCanOrder(cook.data?.metro_area, buyerMetro);
      const looking = !inRange && travelBrowseOpen(buyer.data);
      if (
        cook.error
        || !buyerPlateLinkOpens(cook.data?.is_paused, cook.data?.available_for_orders, false)
        || (!inRange && !looking)
      ) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
      }
      outsideRange = !inRange;
    }
    const acceptingOrders = !cook.error && cook.data?.is_paused !== true && cook.data?.available_for_orders === true;

    const cooks = await loadPublicProfiles(ctx.supabaseAdmin, [data.user_id]);
    const offers = await loadActiveOffers(ctx.supabaseAdmin, [data.id]);

    return {
      id: data.id,
      plateMakerId: data.user_id,
      plateMakerName: displayName(cooks.get(data.user_id)),
      plateMakerImage: cooks.get(data.user_id)?.profile_image || '',
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      images: visiblePlateMedia(
        data.images,
        (await hiddenMealImages(ctx.supabaseAdmin, [data.id])).get(data.id),
        await hiddenClipVideoAddresses(ctx.supabaseAdmin),
      ),
      ingredients: data.ingredients,
      cuisine: data.cuisine,
      category: data.category,
      dietaryOptions: data.dietary_options,
      preparationTime: data.preparation_time,
      available: data.available,
      acceptingOrders,
      rating: parseFloat(data.rating || '0'),
      reviewCount: data.review_count,
      featured: data.featured,
      tags: data.tags,
      canOrder: data.user_id !== ctx.userId && !outsideRange,
      isSample: false,
      promotionalOffer: offers.get(data.id) ?? undefined,
      expiryDate: data.expiry_date ?? null,
      receiptDate: data.receipt_date ?? null,
    };
  });
