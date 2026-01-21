import { adminProcedure } from "../../../create-context";

export const resetAllCountsProcedure = adminProcedure
  .mutation(async ({ ctx }) => {
    // Reset all counts in metro_area_counts table
    // Use correct column names: platemaker_count and platetaker_count
    const { data: updated, error } = await ctx.supabase
      .from('metro_area_counts')
      .update({
        platemaker_count: 0,
        platetaker_count: 0,
        updated_at: new Date().toISOString(),
      })
      .select('metro_name');

    if (error) {
      throw new Error(`Failed to reset counts: ${error.message}`);
    }

    const count = updated?.length || 0;

    return {
      success: true,
      count,
      message: `Reset counts for ${count} metro(s)`,
    };
  });
