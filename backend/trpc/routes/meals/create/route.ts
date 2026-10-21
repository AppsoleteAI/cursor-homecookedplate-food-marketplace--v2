import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { calculateOrderBreakdown, calculateOrderSplit } from "@/backend/lib/fees";
import { platemakerMayEnter } from "@/backend/lib/trial-access";
import { sanitizeTextField, sanitizeTextArray } from "../../../../lib/text-security";
import { portionTag, timeZoneTag } from "@/lib/meal-publish";

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
      portions: z.number().int().min(1).max(100).optional(),
      cookTimeZone: z.string().max(80).optional(),
      expiryDate: z.string().optional(),
      receiptDate: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Check if user is a platemaker and has acknowledged food safety requirements
    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role, food_safety_acknowledged, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, google_purchase_token, metro_area, stripe_account_id')
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

    if (profile.role === 'platemaker') {
      const remote = !profile.metro_area || profile.metro_area === 'Remote/Other';
      if (!remote && !platemakerMayEnter(profile)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Choose Early Bird or a paid plan before a plate goes on the menu.',
        });
      }
      if (!profile.stripe_account_id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Finish Stripe payouts before a plate goes on the menu. Buyers cannot pay until that account is connected.',
        });
      }
    }

    // Sanitize and validate all user-supplied text fields for prompt injection,
    // invisible characters, and bidirectional overrides before storing.
    const nameResult = sanitizeTextField(input.name);
    const descResult = sanitizeTextField(input.description);
    const cuisineResult = sanitizeTextField(input.cuisine);
    const ingredientsResult = sanitizeTextArray(input.ingredients);
    const tagsResult = input.tags ? sanitizeTextArray(input.tags) : { values: [], blocked: false, flags: [] };

    const textBlocked =
      nameResult.blocked ||
      descResult.blocked ||
      cuisineResult.blocked ||
      ingredientsResult.blocked ||
      tagsResult.blocked;

    if (textBlocked) {
      const allFlags = [
        ...nameResult.flags,
        ...descResult.flags,
        ...cuisineResult.flags,
        ...ingredientsResult.flags,
        ...tagsResult.flags,
      ];
      await Promise.resolve(
        ctx.supabaseAdmin
          .from('audit_logs')
          .insert({
            action: 'MEAL_TEXT_BLOCKED',
            user_id: ctx.userId,
            new_data: { flags: [...new Set(allFlags)] },
          })
      ).catch(() => {});
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Meal content contains disallowed text. Please review your submission.',
      });
    }

    const { data, error } = await ctx.supabase
      .from('meals')
      .insert({
        user_id: ctx.userId,
        name: nameResult.value,
        description: descResult.value,
        price: input.price,
        images: input.images,
        ingredients: ingredientsResult.values,
        cuisine: cuisineResult.value,
        category: input.category,
        dietary_options: input.dietaryOptions || [],
        preparation_time: input.preparationTime,
        tags: [
          ...tagsResult.values.filter((tag) => !/^portions:\d+$/.test(tag) && !tag.startsWith('tz:')),
          portionTag(input.portions ?? 1),
          ...(timeZoneTag(input.cookTimeZone) ? [timeZoneTag(input.cookTimeZone) as string] : []),
        ],
        expiry_date: input.expiryDate,
        receipt_date: input.receiptDate,
        published: false,
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
        available: true,
        published: false,
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
