import { mainAdminProcedure } from "../../../create-context";
import { z } from "zod";
import { setAllGeofencesActive } from "../../../../lib/metro-geofence";

export const toggleGlobalMaintenanceProcedure = mainAdminProcedure
  .input(
    z.object({
      shouldActivate: z.boolean(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { count, error } = await setAllGeofencesActive(ctx.supabase, input.shouldActivate);

    if (error) {
      throw new Error(`Failed to toggle global maintenance: ${error.message}`);
    }

    return {
      success: true,
      count,
      isActive: input.shouldActivate,
      message: input.shouldActivate
        ? `Activated ${count} metro(s)`
        : `Deactivated ${count} metro(s)`,
    };
  });
