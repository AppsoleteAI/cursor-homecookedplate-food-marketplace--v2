import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const checkTrialEligibilityProcedure = publicProcedure
  .input(
    z.object({
      lat: z.number(),
      lng: z.number(),
      role: z.enum(['platemaker', 'platetaker']),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Step 1: Use PostGIS RPC to find metro area (per RORK_INSTRUCTIONS.md Section 2)
    // Use ctx.supabase (anon key) for RPC - respects RLS if enabled
    const { data: metroName, error: rpcError } = await ctx.supabase.rpc(
      'find_metro_by_location',
      { lng: input.lng, lat: input.lat }
    );

    // If no metro found or RPC error, return not eligible
    if (rpcError || !metroName) {
      return {
        eligible: false,
        metro: null,
        spotsRemaining: 0,
        reason: rpcError ? 'geocoding_error' : 'outside_metro',
      };
    }

    // Step 2: Check current counts for this metro
    // Use ctx.supabase (anon key) for reads - respects RLS
    // Note: metro_area_counts doesn't have RLS enabled, but we use anon key for consistency
    const { data: counts, error: countsError } = await ctx.supabase
      .from('metro_area_counts')
      .select('platemaker_count, platetaker_count')
      .eq('metro_name', metroName)
      .single();

    // If metro doesn't exist in counts table, initialize it
    // Use ctx.supabaseAdmin (service role) ONLY for writes - this is a system operation
    if (countsError || !counts) {
      await ctx.supabaseAdmin
        .from('metro_area_counts')
        .insert({ metro_name: metroName, platemaker_count: 0, platetaker_count: 0 })
        .onConflict('metro_name')
        .merge();

      // Retry the query using anon key (read operation)
      const { data: retryCounts } = await ctx.supabase
        .from('metro_area_counts')
        .select('platemaker_count, platetaker_count')
        .eq('metro_name', metroName)
        .single();

      if (!retryCounts) {
        return {
          eligible: false,
          metro: metroName,
          spotsRemaining: 0,
          reason: 'database_error',
        };
      }

      const isMaker = input.role === 'platemaker';
      const currentCount = isMaker ? retryCounts.platemaker_count : retryCounts.platetaker_count;
      const maxCount = 100; // Hardcoded limit per RORK_INSTRUCTIONS.md
      const spotsRemaining = Math.max(0, maxCount - currentCount);

      return {
        eligible: currentCount < maxCount,
        metro: metroName,
        spotsRemaining,
        reason: currentCount < maxCount ? 'eligible' : 'quota_full',
      };
    }

    // Step 3: Check eligibility based on role and count
    const isMaker = input.role === 'platemaker';
    const currentCount = isMaker ? counts.platemaker_count : counts.platetaker_count;
    const maxCount = 100; // Hardcoded limit per RORK_INSTRUCTIONS.md
    const spotsRemaining = Math.max(0, maxCount - currentCount);

    return {
      eligible: currentCount < maxCount,
      metro: metroName,
      spotsRemaining,
      reason: currentCount < maxCount ? 'eligible' : 'quota_full',
    };
  });
