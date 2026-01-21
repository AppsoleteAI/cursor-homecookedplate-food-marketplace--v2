import { adminProcedure } from "../../../create-context";
import { z } from "zod";

export const updateMaxCapProcedure = adminProcedure
  .input(
    z.object({
      metro_name: z.string().min(1),
      max_cap: z.number().int().min(0),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Update max_cap for specified metro
    const { data: updated, error } = await ctx.supabase
      .from('metro_area_counts')
      .update({ 
        max_cap: input.max_cap,
        updated_at: new Date().toISOString()
      })
      .eq('metro_name', input.metro_name)
      .select('metro_name, platemaker_count, platetaker_count, max_cap, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to update max_cap: ${error.message}`);
    }

    if (!updated) {
      throw new Error(`Metro "${input.metro_name}" not found`);
    }

    return updated;
  });
