import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "../../../../lib/supabase";

export const checkTrialEligibilityProcedure = publicProcedure
  .input(
    z.object({
      lat: z.number(),
      lng: z.number(),
      role: z.enum(['platemaker', 'platetaker']),
    })
  )
  .mutation(async ({ input }) => {
    // Step 1: Use PostGIS RPC to find metro area (per RORK_INSTRUCTIONS.md Section 2)
    const { data: metroName, error: rpcError } = await supabaseAdmin.rpc(
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
    const { data: counts, error: countsError } = await supabaseAdmin
      .from('metro_area_counts')
      .select('maker_count, taker_count')
      .eq('metro_name', metroName)
      .single();

    // If metro doesn't exist in counts table, initialize it
    if (countsError || !counts) {
      await supabaseAdmin
        .from('metro_area_counts')
        .insert({ metro_name: metroName, maker_count: 0, taker_count: 0 })
        .onConflict('metro_name')
        .merge();

      // Retry the query
      const { data: retryCounts } = await supabaseAdmin
        .from('metro_area_counts')
        .select('maker_count, taker_count')
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
      const currentCount = isMaker ? retryCounts.maker_count : retryCounts.taker_count;
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
    const currentCount = isMaker ? counts.maker_count : counts.taker_count;
    const maxCount = 100; // Hardcoded limit per RORK_INSTRUCTIONS.md
    const spotsRemaining = Math.max(0, maxCount - currentCount);

    return {
      eligible: currentCount < maxCount,
      metro: metroName,
      spotsRemaining,
      reason: currentCount < maxCount ? 'eligible' : 'quota_full',
    };
  });
