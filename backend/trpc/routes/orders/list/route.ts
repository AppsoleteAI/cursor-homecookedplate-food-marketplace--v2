import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";
import { missingBuyerColumn, orderBuyerId, orderColumnsAfterError, orderListColumns, orderTotal } from "../../../../lib/order-row";
import { loadPickupConfirms } from "../../../../lib/pickup-confirm";
import { noteForViewer } from "../../../../lib/content-moderation";
import { firstPlatePhoto } from "@/lib/food-review-clips";
import { hiddenClipVideoAddresses, hiddenMealImages, visiblePlateMedia } from "../../../../lib/hidden-clips";

export const listOrdersProcedure = protectedProcedure
  .input(
    z.object({
      status: z.string().optional(),
      role: z.enum(['buyer', 'seller']).optional(),
    }).optional()
  )
  .query(async ({ input, ctx }) => {
    const load = (columns: string, buyerColumn: 'buyer_id' | 'platetaker_id') => {
      let query = ctx.supabase
        .from('orders')
        .select(`
          ${columns},
          meal:meals!orders_meal_id_fkey (
            name,
            images
          )
        `);

      if (input?.role === 'buyer') {
        query = query.eq(buyerColumn, ctx.userId);
      } else if (input?.role === 'seller') {
        query = query.eq('seller_id', ctx.userId);
      } else {
        query = query.or(`${buyerColumn}.eq.${ctx.userId},seller_id.eq.${ctx.userId}`);
      }

      if (input?.role === 'seller') {
        query = query.eq('paid', true);
      }

      if (input?.status) {
        query = query.eq('status', input.status);
      }

      return query.order('created_at', { ascending: false });
    };

    let columns = orderListColumns('buyer_id');
    let buyerColumn: 'buyer_id' | 'platetaker_id' = 'buyer_id';
    let { data, error } = await load(columns, buyerColumn);
    for (let attempt = 0; attempt < 6 && error; attempt += 1) {
      if (missingBuyerColumn(error.message) && buyerColumn === 'buyer_id') {
        buyerColumn = 'platetaker_id';
        columns = orderListColumns('platetaker_id');
      } else {
        const next = orderColumnsAfterError(columns, error.message);
        if (!next) break;
        columns = next;
      }
      const retry = await load(columns, buyerColumn);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[ListOrders] Error:', error);
      throw new Error(error.message);
    }

    const rows = (data || []) as any[];

    const people = await loadPublicProfiles(
      ctx.supabaseAdmin,
      rows.flatMap((order: { buyer_id?: string | null; platetaker_id?: string | null; seller_id: string }) => [orderBuyerId(order), order.seller_id])
    );

    const readyIds = rows
      .filter((order: { status?: string }) => order.status === 'ready')
      .map((order: { id: string }) => order.id);
    const confirms = await loadPickupConfirms(ctx.supabaseAdmin, readyIds);
    const blocks = await ctx.supabaseAdmin
      .from('cook_buyer_blocks')
      .select('platemaker_id')
      .eq('platetaker_id', ctx.userId);
    const blockedCooks = new Set(
      (blocks.error ? [] : blocks.data || []).map((row: { platemaker_id?: string }) => row.platemaker_id).filter(Boolean)
    );

    const visible = rows.filter((order: { seller_id?: string; paid?: boolean; buyer_id?: string | null; platetaker_id?: string | null }) => {
      if (order.seller_id === ctx.userId && orderBuyerId(order) !== ctx.userId && order.paid !== true) return false;
      return true;
    });

    const hiddenVideos = await hiddenClipVideoAddresses(ctx.supabaseAdmin);
    const hiddenStills = await hiddenMealImages(ctx.supabaseAdmin, visible.map((order: { meal_id?: string }) => order.meal_id || ''));
    return visible.map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meal?.name || 'Unknown Meal',
      mealImage: firstPlatePhoto(visiblePlateMedia(order.meal?.images, hiddenStills.get(order.meal_id), hiddenVideos)),
      plateTakerId: orderBuyerId(order),
      plateTakerName: people.get(orderBuyerId(order))?.username,
      plateMakerId: order.seller_id,
      plateMakerName: displayName(people.get(order.seller_id)),
      status: order.status,
      quantity: order.quantity,
      totalPrice: orderTotal(order),
      paid: order.paid,
      specialInstructions: noteForViewer({
        text: order.special_instructions,
        status: order.instructions_status,
        buyerId: orderBuyerId(order),
        sellerId: order.seller_id,
        viewerId: ctx.userId,
      }).text ?? undefined,
      instructionsStatus: order.instructions_status ?? null,
      cookingTemperature: order.cooking_temperature,
      allergies: order.allergies,
      deliveryAddress: order.delivery_address,
      pickupTime: order.pickup_time ? new Date(order.pickup_time) : undefined,
      pickupTimeZone: typeof order.pickup_timezone === 'string' ? order.pickup_timezone : undefined,
      pickupConfirmedBy: confirms.get(order.id) ?? [],
      cookBlocked: blockedCooks.has(order.seller_id),
      orderDate: new Date(order.created_at),
    }));
  });
