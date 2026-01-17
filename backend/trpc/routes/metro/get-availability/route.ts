import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const getMetroAvailabilityProcedure = publicProcedure
  .input(
    z.object({
      metroName: z.string().min(1, "Metro name is required"),
    })
  )
  .query(async ({ input, ctx }) => {
    // Query metro_area_counts table for the specific metro
    // Use ctx.supabase (anon key) - RLS should allow public read access
    const { data: metroData, error } = await ctx.supabase
      .from('metro_area_counts')
      .select('metro_name, maker_count, taker_count, max_cap')
      .eq('metro_name', input.metroName)
      .single();

    if (error || !metroData) {
      // Metro not found - return null/empty data rather than throwing
      // This allows the UI to handle gracefully (e.g., show "Metro not available")
      return {
        metroName: input.metroName,
        makerCount: 0,
        takerCount: 0,
        maxCap: 100, // Default fallback
        makerSpotsRemaining: 0,
        takerSpotsRemaining: 0,
        found: false,
      };
    }

    const maxCap = metroData.max_cap || 100; // Fallback to 100 if null
    const makerCount = metroData.maker_count || 0;
    const takerCount = metroData.taker_count || 0;

    // Calculate spots remaining (ensure non-negative)
    const makerSpotsRemaining = Math.max(0, maxCap - makerCount);
    const takerSpotsRemaining = Math.max(0, maxCap - takerCount);

    return {
      metroName: metroData.metro_name,
      makerCount,
      takerCount,
      maxCap,
      makerSpotsRemaining,
      takerSpotsRemaining,
      found: true,
    };
  });
