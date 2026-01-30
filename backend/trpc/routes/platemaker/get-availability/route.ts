import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

/**
 * Get Availability Status Procedure
 * 
 * Returns the current "Available For Orders" status for the authenticated platemaker.
 * 
 * SECURITY:
 * - Only platemakers can query their own availability
 * - Verifies role before returning status
 */
export const getAvailabilityProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    // CRITICAL SECURITY: Verify user role is 'platemaker' before proceeding
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role, available_for_orders, available_updated_at')
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
        message: 'Only platemakers can query their availability status',
      });
    }

    return {
      available: profile.available_for_orders ?? true, // Default to true if null
      updatedAt: profile.available_updated_at ? new Date(profile.available_updated_at) : null,
    };
  });
