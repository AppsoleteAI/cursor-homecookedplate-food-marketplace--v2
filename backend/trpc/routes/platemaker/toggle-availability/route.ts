import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * Toggle Availability Procedure
 * 
 * Allows platemakers to toggle their "Available For Orders" status on/off.
 * When toggled off, new orders will be blocked until toggled back on.
 * 
 * SECURITY:
 * - Only platemakers can toggle their own availability
 * - Verifies role before allowing toggle
 */
export const toggleAvailabilityProcedure = protectedProcedure
  .input(
    z.object({
      available: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
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
        message: 'Only platemakers can toggle their availability status',
      });
    }

    // Update availability status
    const { data, error } = await ctx.supabase
      .from('profiles')
      .update({
        available_for_orders: input.available,
        available_updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.userId)
      .select('available_for_orders, available_updated_at')
      .single();

    if (error || !data) {
      console.error('[ToggleAvailability] Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'Failed to update availability status',
      });
    }

    return {
      available: data.available_for_orders,
      updatedAt: new Date(data.available_updated_at),
      message: input.available
        ? 'You are now accepting new orders'
        : 'You are no longer accepting new orders. Existing orders will continue.',
    };
  });
