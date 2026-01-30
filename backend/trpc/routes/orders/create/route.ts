import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line import/no-unresolved
import { calculateOrderBreakdown } from "../../../lib/fees";

/**
 * Create Order Procedure
 * 
 * SECURITY: Uses calculateOrderBreakdown from fees.ts for UI/API consistency.
 * The SQL trigger calculate_order_price_trigger will re-verify and overwrite
 * total_price on insert/update, ensuring price tampering is impossible.
 * 
 * CRITICAL: Checks if platemaker is available_for_orders before allowing order creation.
 * 
 * Corresponds to SQL Section 2 in security_enhancements.sql
 */
export const createOrderProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string(),
      sellerId: z.string(),
      quantity: z.number().positive().max(999),
      unitPrice: z.number().min(0), // Price per unit from meals table (for calculation)
      specialInstructions: z.string().optional(),
      cookingTemperature: z.string().optional(),
      allergies: z.array(z.string()).optional(),
      deliveryAddress: z.string().optional(),
      pickupTime: z.string().optional(),
      paymentIntentId: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // CRITICAL: Check if seller is available for orders before creating order
    const { data: sellerProfile, error: sellerError } = await ctx.supabase
      .from('profiles')
      .select('role, available_for_orders')
      .eq('id', input.sellerId)
      .single();

    if (sellerError || !sellerProfile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Seller profile not found',
      });
    }

    if (sellerProfile.role !== 'platemaker') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid seller account',
      });
    }

    // Check if platemaker is available for orders
    if (sellerProfile.available_for_orders === false) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This platemaker is currently not accepting new orders',
      });
    }

    // Calculate fees based on the unit price provided (matches UI calculation)
    // SQL trigger will overwrite this if it's wrong, but we calculate here for consistency
    const breakdown = calculateOrderBreakdown(input.unitPrice, input.quantity);

    const { data, error } = await ctx.supabase
      .from('orders')
      .insert({
        meal_id: input.mealId,
        buyer_id: ctx.userId,
        seller_id: input.sellerId,
        quantity: input.quantity,
        total_price: breakdown.total, // SQL Trigger will overwrite this if it's wrong
        paid: false,
        special_instructions: input.specialInstructions,
        cooking_temperature: input.cookingTemperature,
        allergies: input.allergies || [],
        delivery_address: input.deliveryAddress,
        pickup_time: input.pickupTime,
        status: 'pending',
        payment_intent_id: input.paymentIntentId,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[CreateOrder] Error:', error);
      throw new Error(error?.message || 'Failed to create order');
    }

    return {
      id: data.id,
      mealId: data.meal_id,
      buyerId: data.buyer_id,
      sellerId: data.seller_id,
      status: data.status,
      quantity: data.quantity,
      totalPrice: parseFloat(data.total_price), // Final price from DB (after trigger)
      paid: data.paid,
      specialInstructions: data.special_instructions,
      cookingTemperature: data.cooking_temperature,
      allergies: data.allergies,
      deliveryAddress: data.delivery_address,
      pickupTime: data.pickup_time ? new Date(data.pickup_time) : undefined,
      createdAt: new Date(data.created_at),
    };
  });
