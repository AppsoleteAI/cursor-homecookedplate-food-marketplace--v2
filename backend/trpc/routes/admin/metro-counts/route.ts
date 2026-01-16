import { adminProcedure } from "../../../create-context";

export const metroCountsProcedure = adminProcedure.query(async ({ ctx }) => {
  // Query metro_area_counts table - source of truth for cap monitoring
  const { data: counts, error } = await ctx.supabase
    .from('metro_area_counts')
    .select('metro_name, maker_count, taker_count, max_cap, is_active, trial_days, updated_at')
    .order('metro_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch metro counts: ${error.message}`);
  }

  return counts || [];
});
