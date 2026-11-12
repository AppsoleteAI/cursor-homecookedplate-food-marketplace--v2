import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";
import { orderBuyerId, orderCookId, orderListColumns, orderListFilterAfterError, orderTotal, type OrderListFilter } from "../../../../lib/order-row";
import { confirmedPaidIds, orderPaidState } from "../../../../lib/order-payment";
import { loadPickupConfirms } from "../../../../lib/pickup-confirm";
import { loadOrderNotes, noteForViewer } from "../../../../lib/content-moderation";
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
    const load = (filter: OrderListFilter) => {
      let query = ctx.supabase
        .from('orders')
        .select(`
          ${filter.columns},
          meal:meals!orders_meal_id_fkey (
            name,
            images
          )
        `);

      if (input?.role === 'buyer') {
        query = query.eq(filter.buyerColumn, ctx.userId);
      } else if (input?.role === 'seller') {
        query = query.eq(filter.cookColumn, ctx.userId);
      } else {
        query = query.or(`${filter.buyerColumn}.eq.${ctx.userId},${filter.cookColumn}.eq.${ctx.userId}`);
      }

      if (filter.requirePaid) {
        query = query.eq('paid', true);
      }

      if (input?.status) {
        query = query.eq('status', input.status);
      }

      return query.order('created_at', { ascending: false });
    };

    let filter: OrderListFilter = {
      cookColumn: 'seller_id',
      requirePaid: input?.role === 'seller',
      buyerColumn: 'buyer_id',
      columns: orderListColumns('buyer_id'),
    };
    let { data, error } = await load(filter);
    for (let attempt = 0; attempt < 6 && error; attempt += 1) {
      const next = orderListFilterAfterError(filter, error.message);
      if (!next) break;
      filter = next;
      const retry = await load(filter);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[ListOrders] Error:', error);
      throw new Error(error.message);
    }

    const rows = (data || []) as any[];

    const stripeSecret = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    const needsPaidProof = !filter.requirePaid && rows.some((order: { paid?: boolean | null }) => orderPaidState(order) === 'absent');
    const paidIds = needsPaidProof ? await confirmedPaidIds(rows, ctx.supabaseAdmin, stripeSecret) : null;
    const rowIsPaid = (order: { id: string; paid?: boolean | null }) => {
      const state = orderPaidState(order);
      if (state === 'paid') return true;
      if (state === 'unpaid') return false;
      return paidIds?.has(order.id) === true;
    };

    const people = await loadPublicProfiles(
      ctx.supabaseAdmin,
      rows.flatMap((order: { buyer_id?: string | null; platetaker_id?: string | null; seller_id?: string | null; platemaker_id?: string | null }) => [orderBuyerId(order), orderCookId(order)])
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

    const visible = rows.filter((order: { id: string; paid?: boolean | null; seller_id?: string | null; platemaker_id?: string | null; buyer_id?: string | null; platetaker_id?: string | null }) => {
      if (input?.role === 'seller') return rowIsPaid(order);
      const cookSide = orderCookId(order) === ctx.userId && orderBuyerId(order) !== ctx.userId;
      if (cookSide && !rowIsPaid(order)) return false;
      return true;
    });

    const notes = await loadOrderNotes(ctx.supabaseAdmin, visible.map((order: { id?: string }) => order.id || ''));
    const hiddenVideos = await hiddenClipVideoAddresses(ctx.supabaseAdmin);
    const hiddenStills = await hiddenMealImages(ctx.supabaseAdmin, visible.map((order: { meal_id?: string }) => order.meal_id || ''));
    return visible.map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meal?.name || 'Unknown Meal',
      mealImage: firstPlatePhoto(visiblePlateMedia(order.meal?.images, hiddenStills.get(order.meal_id), hiddenVideos)),
      plateTakerId: orderBuyerId(order),
      plateTakerName: people.get(orderBuyerId(order))?.username,
      plateMakerId: orderCookId(order),
      plateMakerName: displayName(people.get(orderCookId(order))),
      status: order.status,
      quantity: order.quantity,
      totalPrice: orderTotal(order),
      paid: rowIsPaid(order),
      specialInstructions: noteForViewer({
        text: notes.get(order.id)?.text ?? order.special_instructions,
        status: notes.get(order.id)?.status ?? order.instructions_status,
        buyerId: orderBuyerId(order),
        sellerId: orderCookId(order),
        viewerId: ctx.userId,
      }).text ?? undefined,
      instructionsStatus: order.instructions_status ?? null,
      cookingTemperature: order.cooking_temperature,
      allergies: order.allergies,
      deliveryAddress: order.delivery_address,
      pickupTime: order.pickup_time ? new Date(order.pickup_time) : undefined,
      pickupTimeZone: typeof order.pickup_timezone === 'string' ? order.pickup_timezone : undefined,
      pickupConfirmedBy: confirms.get(order.id) ?? [],
      cookBlocked: blockedCooks.has(orderCookId(order)),
      orderDate: new Date(order.created_at),
    }));
  });
