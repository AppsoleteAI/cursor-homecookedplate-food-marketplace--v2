import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { displayName, loadPublicProfiles } from "../../../../lib/public-profiles";

export const listOrdersProcedure = protectedProcedure
  .input(
    z.object({
      status: z.string().optional(),
      role: z.enum(['buyer', 'seller']).optional(),
    }).optional()
  )
  .query(async ({ input, ctx }) => {
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
      query = query.eq('buyer_id', ctx.userId);
    } else if (input?.role === 'seller') {
      query = query.eq('seller_id', ctx.userId);
    } else {
      query = query.or(`buyer_id.eq.${ctx.userId},seller_id.eq.${ctx.userId}`);
    }

    if (input?.status) {
      query = query.eq('status', input.status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[ListOrders] Error:', error);
      throw new Error(error.message);
    }

    const people = await loadPublicProfiles(
      ctx.supabaseAdmin,
      (data || []).flatMap((order: { buyer_id: string; seller_id: string }) => [order.buyer_id, order.seller_id])
    );

    return (data || []).map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meal?.name || 'Unknown Meal',
      mealImage: order.meal?.images?.[0] || '',
      plateTakerId: order.buyer_id,
      plateTakerName: people.get(order.buyer_id)?.username,
      plateMakerId: order.seller_id,
      plateMakerName: displayName(people.get(order.seller_id)),
      status: order.status,
      quantity: order.quantity,
      totalPrice: parseFloat(order.total_price),
      paid: order.paid,
      specialInstructions: order.special_instructions,
      cookingTemperature: order.cooking_temperature,
      allergies: order.allergies,
      deliveryAddress: order.delivery_address,
      pickupTime: order.pickup_time ? new Date(order.pickup_time) : undefined,
      orderDate: new Date(order.created_at),
    }));
  });
