import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

export const createOrderProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string(),
      sellerId: z.string(),
      quantity: z.number().positive().max(999),
      totalPrice: z.number().min(0),
      specialInstructions: z.string().optional(),
      cookingTemperature: z.string().optional(),
      allergies: z.array(z.string()).optional(),
      deliveryAddress: z.string().optional(),
      pickupTime: z.string().optional(),
      paymentIntentId: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('orders')
      .insert({
        meal_id: input.mealId,
        buyer_id: ctx.userId,
        seller_id: input.sellerId,
        quantity: input.quantity,
        total_price: input.totalPrice,
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
      totalPrice: parseFloat(data.total_price),
      paid: data.paid,
      specialInstructions: data.special_instructions,
      cookingTemperature: data.cooking_temperature,
      allergies: data.allergies,
      deliveryAddress: data.delivery_address,
      pickupTime: data.pickup_time ? new Date(data.pickup_time) : undefined,
      createdAt: new Date(data.created_at),
    };
  });
