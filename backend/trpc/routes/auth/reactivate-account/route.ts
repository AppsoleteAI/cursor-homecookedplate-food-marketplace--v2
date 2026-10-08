import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const reactivateAccountProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Find the profile by email
    const email = input.email.trim();
    let lookup = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, is_paused, email')
      .eq('email', email)
      .maybeSingle();
    if (!lookup.data && !lookup.error && email !== email.toLowerCase()) {
      lookup = await ctx.supabaseAdmin
        .from('profiles')
        .select('id, is_paused, email')
        .eq('email', email.toLowerCase())
        .maybeSingle();
    }
    const profile = lookup.data;
    const profileError = lookup.error;

    if (profileError || !profile) {
      // Don't reveal if account exists for security
      return { 
        success: false, 
        message: 'If an account exists with this email and is paused, it has been reactivated.' 
      };
    }

    // Check if account is paused
    if (!profile.is_paused) {
      return { 
        success: false, 
        message: 'This account is not paused. You can log in normally.' 
      };
    }

    // Reactivate the account
    const { error: updateError } = await ctx.supabaseAdmin
      .from('profiles')
      .update({ is_paused: false })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[Reactivate Account] Error:', updateError);
      throw new Error('Failed to reactivate account. Please try again.');
    }

    return { 
      success: true, 
      message: 'Your account has been reactivated. You can now log in normally.' 
    };
  });
