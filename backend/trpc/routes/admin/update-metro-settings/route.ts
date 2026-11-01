import { mainAdminProcedure } from "../../../create-context";
import { z } from "zod";
import { updateGeofenceSettings } from "../../../../lib/metro-geofence";

export const updateMetroSettingsProcedure = mainAdminProcedure
  .input(
    z.object({
      name: z.string().min(1),
      is_active: z.boolean().optional(),
      trial_days: z.number().int().min(1).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Build update object with only provided fields
    const updateData: {
      is_active?: boolean;
      trial_days?: number;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    if (input.trial_days !== undefined) {
      updateData.trial_days = input.trial_days;
    }

    const { data: updated, error } = await updateGeofenceSettings(ctx.supabase, input.name, updateData);

    if (error) {
      throw new Error(`Failed to update metro settings: ${error.message}`);
    }

    if (!updated) {
      throw new Error(`Metro "${input.name}" not found`);
    }

    return updated;
  });
