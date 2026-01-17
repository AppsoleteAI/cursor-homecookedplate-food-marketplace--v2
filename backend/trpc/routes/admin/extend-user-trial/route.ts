import { adminProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "../../../../lib/supabase";

export const extendUserTrialProcedure = adminProcedure
  .input(
    z.object({
      userId: z.string().uuid("Invalid user ID format"),
      extensionDays: z.number().int().min(1).max(365).default(30),
    })
  )
  .mutation(async ({ input }) => {
    // 1. Verify user exists
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username, trial_ends_at')
      .eq('id', input.userId)
      .single();

    if (fetchError || !profile) {
      throw new Error(`User not found: ${input.userId}`);
    }

    // 2. Calculate new expiration date
    // If trial_ends_at is null, use current date as base
    const currentEnd = profile.trial_ends_at 
      ? new Date(profile.trial_ends_at) 
      : new Date();
    
    // Add extension days
    const newEndDate = new Date(currentEnd);
    newEndDate.setDate(newEndDate.getDate() + input.extensionDays);

    // 3. Update with admin privileges (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        trial_ends_at: newEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', input.userId);

    if (updateError) {
      throw new Error(`Failed to extend trial: ${updateError.message}`);
    }

    return { 
      success: true, 
      newDate: newEndDate.toISOString(),
      userId: input.userId,
      extensionDays: input.extensionDays,
      userEmail: profile.email,
      userUsername: profile.username,
    };
  });
