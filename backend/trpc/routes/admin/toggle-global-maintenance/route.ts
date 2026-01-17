import { adminProcedure } from "../../../create-context";
import { z } from "zod";

export const toggleGlobalMaintenanceProcedure = adminProcedure
  .input(
    z.object({
      shouldActivate: z.boolean(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Update all metros in metro_geofences table
    const { data: updated, error } = await ctx.supabase
      .from('metro_geofences')
      .update({
        is_active: input.shouldActivate,
        updated_at: new Date().toISOString(),
      })
      .select('metro_name');

    if (error) {
      throw new Error(`Failed to toggle global maintenance: ${error.message}`);
    }

    const count = updated?.length || 0;

    return {
      success: true,
      count,
      isActive: input.shouldActivate,
      message: input.shouldActivate
        ? `Activated ${count} metro(s)`
        : `Deactivated ${count} metro(s)`,
    };
  });
