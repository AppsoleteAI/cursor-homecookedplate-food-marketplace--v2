import { adminProcedure } from "../../../create-context";

export const getMetroCountsProcedure = adminProcedure
  .query(async ({ ctx }) => {
    // Query all metro area counts using admin client to bypass RLS
    const { data: counts, error } = await ctx.supabaseAdmin
      .from('metro_area_counts')
      .select('metro_name, platemaker_count, platetaker_count')
      .order('metro_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch metro counts: ${error.message}`);
    }

    // Transform to match component expectations
    // Naming Convention: Use platemaker/platetaker (not maker/taker)
    return (counts || []).map(metro => ({
      name: metro.metro_name,
      platemaker_count: metro.platemaker_count,
      platetaker_count: metro.platetaker_count,
    }));
  });
