import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";
import { missingBuyerColumn, orderBuyerId, orderTotal } from "../../../../lib/order-row";
import { loadPickupConfirms } from "../../../../lib/pickup-confirm";

export const listOrdersProcedure = protectedProcedure
  .input(
    z.object({
      status: z.string().optional(),
      role: z.enum(['buyer', 'seller']).optional(),
    }).optional()
  )
  .query(async ({ input, ctx }) => {
    const load = (buyerColumn: 'buyer_id' | 'platetaker_id') => {
      let query = ctx.supabase
        .from('orders')
        .select(`
          *,
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

      if (input?.status) {
        query = query.eq('status', input.status);
      }

      return query.order('created_at', { ascending: false });
    };

    let { data, error } = await load('buyer_id');
    if (error && missingBuyerColumn(error.message)) {
      const retry = await load('platetaker_id');
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[ListOrders] Error:', error);
      throw new Error(error.message);
    }

    const people = await loadPublicProfiles(
      ctx.supabaseAdmin,
      (data || []).flatMap((order: { buyer_id?: string | null; platetaker_id?: string | null; seller_id: string }) => [orderBuyerId(order), order.seller_id])
    );

    const readyIds = (data || [])
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

    return (data || []).map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meal?.name || 'Unknown Meal',
      mealImage: order.meal?.images?.[0] || '',
      plateTakerId: orderBuyerId(order),
      plateTakerName: people.get(orderBuyerId(order))?.username,
      plateMakerId: order.seller_id,
      plateMakerName: displayName(people.get(order.seller_id)),
      status: order.status,
      quantity: order.quantity,
      totalPrice: orderTotal(order),
      paid: order.paid,
      specialInstructions: order.special_instructions,
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
