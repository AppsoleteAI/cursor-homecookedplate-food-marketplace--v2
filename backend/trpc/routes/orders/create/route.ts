import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prepareHomePlate, thisOrderExceedsPortions } from "@/backend/lib/plate-order-rules";

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
      quantity: z.number().positive().max(100),
      unitPrice: z.number().min(0), // Price per unit from meals table (for calculation)
      specialInstructions: z.string().optional(),
      cookingTemperature: z.string().optional(),
      allergies: z.array(z.string()).optional(),
      deliveryAddress: z.string().optional(),
      pickupTime: z.string().min(1),
      pickupTimeZone: z.string().min(1).max(80).optional(),
      paymentIntentId: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const prepared = await prepareHomePlate(ctx.supabaseAdmin, {
      buyerId: ctx.userId,
      sellerId: input.sellerId,
      mealId: input.mealId,
      quantity: input.quantity,
      pickupTime: input.pickupTime,
      pickupTimeZone: input.pickupTimeZone,
      specialInstructions: input.specialInstructions,
      deliveryAddress: input.deliveryAddress,
    });
    const quantity = prepared.quantity;
    const chargedBase = prepared.chargedBase;
    const instructions = prepared.instructions;
    const pickupTimeZone = prepared.pickupTimeZone;
    const portionCap = prepared.portionCap;

    // Calculate fees based on the unit price provided (matches UI calculation)
    // SQL trigger will overwrite this if it's wrong, but we calculate here for consistency
    const insertOrder = (withZone: boolean) => ctx.supabase
      .from('orders')
      .insert({
        meal_id: input.mealId,
        buyer_id: ctx.userId,
        seller_id: input.sellerId,
        quantity,
        total_price: chargedBase,
        paid: false,
        special_instructions: instructions || null,
        cooking_temperature: input.cookingTemperature,
        allergies: input.allergies || [],
        delivery_address: prepared.deliveryAddress,
        pickup_time: prepared.pickupTime,
        ...(withZone && pickupTimeZone ? { pickup_timezone: pickupTimeZone } : {}),
        status: 'pending',
        payment_intent_id: input.paymentIntentId,
      })
      .select()
      .single();
    let { data, error } = await insertOrder(true);
    if (error && pickupTimeZone && /pickup_timezone/.test(error.message || '')) {
      const retry = await insertOrder(false);
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.error('[CreateOrder] Error:', error);
      throw new Error(error?.message || 'Failed to create order');
    }

    const over = await thisOrderExceedsPortions(ctx.supabaseAdmin, input.mealId, data.id, portionCap);
    if (over == null || over) {
      const removed = await ctx.supabaseAdmin.from('orders').delete().eq('id', data.id);
      if (removed.error) {
        await ctx.supabaseAdmin.from('orders').update({ status: 'cancelled' }).eq('id', data.id);
      }
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: over
          ? 'Those portions are already taken.'
          : 'Portions for this plate could not be counted. The order was not placed.',
      });
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
      pickupTimeZone: typeof data.pickup_timezone === 'string' ? data.pickup_timezone : pickupTimeZone || undefined,
      createdAt: new Date(data.created_at),
    };
  });
