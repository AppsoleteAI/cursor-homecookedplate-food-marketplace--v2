import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line import/no-unresolved
import { calculateOrderBreakdown, calculateOrderSplit } from "../../../lib/fees";

export const createMealProcedure = protectedProcedure
  .input(
    z.object({
      name: z.string(),
      description: z.string(),
      price: z.number().positive(),
      images: z.array(z.string()),
      ingredients: z.array(z.string()),
      cuisine: z.string(),
      category: z.enum(['breakfast', 'lunch', 'dinner', 'dessert', 'snack']),
      dietaryOptions: z.array(z.string()).optional(),
      preparationTime: z.number().positive(),
      tags: z.array(z.string()).optional(),
      expiryDate: z.string().optional(),
      receiptDate: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Check if user is a platemaker and has acknowledged food safety requirements
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role, food_safety_acknowledged')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify profile',
      });
    }

    if (profile.role === 'platemaker' && !profile.food_safety_acknowledged) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You must acknowledge food safety requirements before publishing meals. Please review cottagefoodlaws.com and acknowledge the requirements in your profile.',
      });
    }

    const { data, error } = await ctx.supabase
      .from('meals')
      .insert({
        user_id: ctx.userId,
        name: input.name,
        description: input.description,
        price: input.price,
        images: input.images,
        ingredients: input.ingredients,
        cuisine: input.cuisine,
        category: input.category,
        dietary_options: input.dietaryOptions || [],
        preparation_time: input.preparationTime,
        tags: input.tags || [],
        expiry_date: input.expiryDate,
        receipt_date: input.receiptDate,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[CreateMeal] Error:', error);
      throw new Error(error?.message || 'Failed to create meal');
    }

    // Calculate fee breakdown for chef transparency
    // Shows: listed price, what buyer pays (with fees), and what chef receives (after platform fee)
    // MANDATORY LOCATION FOR ALL FINANCIAL CALCULATIONS [cite: 2026-01-17]
    const buyerBreakdown = calculateOrderBreakdown(input.price, 1);
    const sellerSplit = calculateOrderSplit(input.price);

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      images: data.images,
      ingredients: data.ingredients,
      cuisine: data.cuisine,
      category: data.category,
      dietaryOptions: data.dietary_options,
      preparationTime: data.preparation_time,
      available: data.available,
      published: data.published,
      rating: parseFloat(data.rating || '0'),
      reviewCount: data.review_count,
      featured: data.featured,
      tags: data.tags,
      expiryDate: data.expiry_date,
      receiptDate: data.receipt_date,
      createdAt: new Date(data.created_at),
      // Fee breakdown for chef transparency
      breakdown: {
        listedPrice: input.price,
        buyerPays: buyerBreakdown.total, // What buyer pays (listed price + 10% buyer fee)
        chefReceives: sellerSplit.sellerPayout, // What chef receives (listed price - 10% seller fee)
        platformFee: buyerBreakdown.platformFee, // 10% buyer fee
        platformRevenue: sellerSplit.appRevenue, // Total platform revenue (20% = 10% buyer + 10% seller)
      },
    };
  });
