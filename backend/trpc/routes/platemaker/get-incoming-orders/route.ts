import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { loadPublicProfiles } from "../../../../lib/public-profiles";
import { orderBuyerId, orderTotal } from "../../../../lib/order-row";
import { loadPickupConfirms } from "../../../../lib/pickup-confirm";
import { noteForViewer } from "../../../../lib/content-moderation";

/**
 * Get Incoming Orders Procedure
 * 
 * Returns incoming orders for the authenticated platemaker, sorted chronologically (oldest first).
 * Includes pending, accepted, and preparing orders.
 * 
 * SECURITY:
 * - Only platemakers can view their own incoming orders
 * - Verifies role and filters by seller_id = ctx.userId
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

    // CRITICAL: Always filter by seller_id = ctx.userId to ensure data isolation
    // Filter by active order statuses: pending, accepted, preparing
    // Order by created_at ASC (chronological order, oldest first)
    const { data: orders, error: ordersError } = await ctx.supabase
      .from('orders')
      .select(`
        *,
        meals:meal_id (
          id,
          name,
          images,
          price
        )
      `)
      .eq('seller_id', ctx.userId)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('[GetIncomingOrders] Error fetching orders:', ordersError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch incoming orders',
      });
    }

    // Handle edge case: no orders
    if (!orders || orders.length === 0) {
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

    return orders.map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meals?.name || 'Unknown Meal',
      mealImage: order.meals?.images?.[0] || '',
      mealPrice: order.meals?.price ? parseFloat(order.meals.price.toString()) : 0,
      buyerId: orderBuyerId(order),
      buyerName: buyers.get(orderBuyerId(order))?.username || 'Unknown Buyer',
      buyerEmail: buyers.get(orderBuyerId(order))?.email || '',
      status: order.status,
      pickupConfirmedBy: confirms.get(order.id) ?? [],
      quantity: order.quantity,
      totalPrice: orderTotal(order),
      paid: order.paid,
      paymentIntentId: order.payment_intent_id,
      specialInstructions: noteForViewer({
        text: order.special_instructions,
        status: order.instructions_status,
        buyerId: orderBuyerId(order),
        sellerId: order.seller_id,
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
