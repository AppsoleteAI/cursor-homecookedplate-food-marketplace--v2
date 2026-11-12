import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { plateTotalsMatch } from "@/backend/lib/fees";
import { holdChargedBase, prepareHomePlate, thisOrderExceedsPortions } from "@/backend/lib/plate-order-rules";
import { missingColumn, noteForViewer } from "../../../../lib/content-moderation";
import { orderBuyerId } from "../../../../lib/order-row";

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
      cookingTemperature: input.cookingTemperature,
      allergies: input.allergies,
    });
    const quantity = prepared.quantity;
    const chargedBase = prepared.chargedBase;
    const instructions = prepared.instructions;
    const pickupTimeZone = prepared.pickupTimeZone;
    const portionCap = prepared.portionCap;

    // Calculate fees based on the unit price provided (matches UI calculation)
    // SQL trigger will overwrite this if it's wrong, but we calculate here for consistency
    const noteHeld = Boolean(prepared.instructions && input.specialInstructions?.trim());
    const insertOrder = (withZone: boolean, withNote: boolean) => ctx.supabase
      .from('orders')
      .insert({
        meal_id: input.mealId,
        buyer_id: ctx.userId,
        seller_id: input.sellerId,
        quantity,
        total_price: chargedBase,
        paid: false,
        special_instructions: instructions || null,
        cooking_temperature: prepared.cookingTemperature,
        allergies: prepared.allergies,
        delivery_address: prepared.deliveryAddress,
        pickup_time: prepared.pickupTime,
        ...(withZone && pickupTimeZone ? { pickup_timezone: pickupTimeZone } : {}),
        ...(withNote ? { instructions_status: 'pending' } : {}),
        status: 'pending',
        payment_intent_id: null,
      })
      .select([
        'id',
        'meal_id',
        'buyer_id',
        'seller_id',
        'status',
        'quantity',
        'total_price',
        'paid',
        'cooking_temperature',
        'allergies',
        'delivery_address',
        'pickup_time',
        'created_at',
        ...(withZone && pickupTimeZone ? ['pickup_timezone'] : []),
      ].join(', '))
      .single();
    let withZone = true;
    let withNote = noteHeld;
    let { data, error } = await insertOrder(withZone, withNote);
    if (error && withNote && missingColumn(error.message, 'instructions_status')) {
      withNote = false;
      const retry = await insertOrder(withZone, withNote);
      data = retry.data;
      error = retry.error;
    }
    if (error && withZone && pickupTimeZone && /pickup_timezone/.test(error.message || '')) {
      withZone = false;
      const retry = await insertOrder(withZone, withNote);
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.error('[CreateOrder] Error:', error);
      throw new Error(error?.message || 'Failed to create order');
    }
    const order = data as any;
    const held = await holdChargedBase(ctx.supabaseAdmin, order.id, chargedBase);
    if (!plateTotalsMatch(held, chargedBase)) {
      const removed = await ctx.supabaseAdmin.from('orders').delete().eq('id', order.id);
      if (removed.error) {
        await ctx.supabaseAdmin.from('orders').update({ status: 'cancelled', paid: false }).eq('id', order.id);
      }
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'The sale price did not stay on this order. The order was not placed.',
      });
    }
    order.total_price = chargedBase;

    const over = await thisOrderExceedsPortions(ctx.supabaseAdmin, input.mealId, order.id, portionCap);
    if (over == null || over) {
      const removed = await ctx.supabaseAdmin.from('orders').delete().eq('id', order.id);
      if (removed.error) {
        await ctx.supabaseAdmin.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      }
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: over
          ? 'Those portions are already taken.'
          : 'Portions for this plate could not be counted. The order was not placed.',
      });
    }

    return {
      id: order.id,
      mealId: order.meal_id,
      buyerId: order.buyer_id,
      sellerId: order.seller_id,
      status: order.status,
      quantity: order.quantity,
      totalPrice: parseFloat(order.total_price), // Final price from DB (after trigger)
      paid: order.paid,
      specialInstructions: noteForViewer({
        text: instructions,
        status: withNote ? 'pending' : null,
        buyerId: orderBuyerId(order),
        sellerId: order.seller_id,
        viewerId: ctx.userId,
      }).text ?? undefined,
      instructionsStatus: withNote ? 'pending' : null,
      cookingTemperature: order.cooking_temperature,
      allergies: order.allergies,
      deliveryAddress: order.delivery_address,
      pickupTime: order.pickup_time ? new Date(order.pickup_time) : undefined,
      pickupTimeZone: typeof order.pickup_timezone === 'string' ? order.pickup_timezone : pickupTimeZone || undefined,
      createdAt: new Date(order.created_at),
    };
  });
