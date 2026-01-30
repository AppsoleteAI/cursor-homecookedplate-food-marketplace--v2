import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

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
        id,
        meal_id,
        buyer_id,
        seller_id,
        status,
        quantity,
        total_price,
        paid,
        payment_intent_id,
        special_instructions,
        cooking_temperature,
        allergies,
        delivery_address,
        pickup_time,
        estimated_completion_time,
        created_at,
        updated_at,
        meals:meal_id (
          id,
          name,
          images,
          price
        ),
        buyer:profiles!orders_buyer_id_fkey (
          id,
          username,
          email
        )
      `)
      .eq('seller_id', ctx.userId) // Data isolation: only this platemaker's orders
      .in('status', ['pending', 'accepted', 'preparing']) // Active orders only
      .order('created_at', { ascending: true }); // Chronological order (oldest first)

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

    // Format and return orders
    return orders.map((order: any) => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meals?.name || 'Unknown Meal',
      mealImage: order.meals?.images?.[0] || '',
      mealPrice: order.meals?.price ? parseFloat(order.meals.price.toString()) : 0,
      buyerId: order.buyer_id,
      buyerName: order.buyer?.username || 'Unknown Buyer',
      buyerEmail: order.buyer?.email || '',
      status: order.status,
      quantity: order.quantity,
      totalPrice: parseFloat(order.total_price.toString()),
      paid: order.paid,
      paymentIntentId: order.payment_intent_id,
      specialInstructions: order.special_instructions,
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
