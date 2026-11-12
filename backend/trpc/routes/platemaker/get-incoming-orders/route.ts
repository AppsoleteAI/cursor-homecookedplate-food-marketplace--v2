import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { loadPublicProfiles } from "../../../../lib/public-profiles";
import { orderBuyerId, orderCookId, orderListColumns, orderListFilterAfterError, orderTotal, type OrderListFilter } from "../../../../lib/order-row";
import { confirmedPaidIds } from "../../../../lib/order-payment";
import { loadPickupConfirms } from "../../../../lib/pickup-confirm";
import { loadOrderNotes, noteForViewer } from "../../../../lib/content-moderation";
import { firstPlatePhoto } from "@/lib/food-review-clips";
import { hiddenClipVideoAddresses, hiddenMealImages, visiblePlateMedia } from "../../../../lib/hidden-clips";

/**
 * Get Incoming Orders Procedure
 * 
 * Returns incoming orders for the authenticated platemaker, sorted chronologically (oldest first).
 * Includes pending, accepted, and preparing orders.
 * 
 * SECURITY:
 * - Only platemakers can view their own incoming orders
 * - Verifies role and filters by the cook column (platemaker_id, or seller_id when that column is set)
 * - Orders sorted by created_at ASC (chronological order)
 */
export const getIncomingOrdersProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    // CRITICAL SECURITY: Verify user role is 'platemaker' before proceeding
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    if (profile.role !== 'platemaker') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only platemakers can view incoming orders',
      });
    }

    // Filter by the cook's own rows. The live table uses platemaker_id and has no paid column.
    const loadIncoming = (filter: OrderListFilter) => {
      let query = ctx.supabase
        .from('orders')
        .select(`
          ${filter.columns},
          meals:meal_id (
            id,
            name,
            images,
            price
          )
        `)
        .eq(filter.cookColumn, ctx.userId)
        .in('status', ['pending', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: true });
      if (filter.requirePaid) query = query.eq('paid', true);
      return query;
    };

    let filter: OrderListFilter = {
      cookColumn: 'seller_id',
      requirePaid: true,
      buyerColumn: 'buyer_id',
      columns: orderListColumns('buyer_id'),
    };
    let incoming = await loadIncoming(filter);
    for (let attempt = 0; attempt < 6 && incoming.error; attempt += 1) {
      const next = orderListFilterAfterError(filter, incoming.error.message);
      if (!next) break;
      filter = next;
      incoming = await loadIncoming(filter);
    }
    let orders = (incoming.data || []) as any[];
    const ordersError = incoming.error;

    if (ordersError) {
      console.error('[GetIncomingOrders] Error fetching orders:', ordersError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch incoming orders',
      });
    }

    // Handle edge case: no orders
    if (!filter.requirePaid) {
      const stripeSecret = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      const paidIds = await confirmedPaidIds(orders, ctx.supabaseAdmin, stripeSecret);
      orders = orders.filter((order: { id: string }) => paidIds.has(order.id));
    }

    if (orders.length === 0) {
      return [];
    }

    const buyers = await loadPublicProfiles(
      ctx.supabaseAdmin,
      orders.map((order: { buyer_id?: string | null; platetaker_id?: string | null }) => orderBuyerId(order)),
      true
    );

    const confirms = await loadPickupConfirms(
      ctx.supabaseAdmin,
      orders.filter((order: { status?: string }) => order.status === 'ready').map((order: { id: string }) => order.id),
    );

    const notes = await loadOrderNotes(ctx.supabaseAdmin, orders.map((order: { id: string }) => order.id));
    const hiddenVideos = await hiddenClipVideoAddresses(ctx.supabaseAdmin);
    const hiddenStills = await hiddenMealImages(ctx.supabaseAdmin, orders.map((order: { meal_id?: string }) => order.meal_id || ''));
    return orders.map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meals?.name || 'Unknown Meal',
      mealImage: firstPlatePhoto(visiblePlateMedia(order.meals?.images, hiddenStills.get(order.meal_id), hiddenVideos)),
      mealPrice: order.meals?.price ? parseFloat(order.meals.price.toString()) : 0,
      buyerId: orderBuyerId(order),
      buyerName: buyers.get(orderBuyerId(order))?.username || 'Unknown Buyer',
      buyerEmail: buyers.get(orderBuyerId(order))?.email || '',
      status: order.status,
      pickupConfirmedBy: confirms.get(order.id) ?? [],
      quantity: order.quantity,
      totalPrice: orderTotal(order),
      paid: true,
      paymentIntentId: order.payment_intent_id,
      specialInstructions: noteForViewer({
        text: notes.get(order.id)?.text ?? order.special_instructions,
        status: notes.get(order.id)?.status ?? order.instructions_status,
        buyerId: orderBuyerId(order),
        sellerId: orderCookId(order),
        viewerId: ctx.userId,
      }).text ?? undefined,
      instructionsStatus: order.instructions_status ?? null,
      cookingTemperature: order.cooking_temperature,
      allergies: order.allergies || [],
      deliveryAddress: order.delivery_address,
      pickupTime: order.pickup_time ? new Date(order.pickup_time) : null,
      estimatedCompletionTime: order.estimated_completion_time
        ? new Date(order.estimated_completion_time)
        : null,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
    }));
  });
