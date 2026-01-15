import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const resetPasswordProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: 'homecookedplate://(auth)/reset-password',
    });

    // Don't reveal if email exists for security (prevent email enumeration)
    // Always return success message regardless of whether email exists
    if (error) {
      console.error('[Reset Password] Error:', error);
      // Still return success to prevent email enumeration
    }

    // Always return success message
    return { success: true, message: 'If an account exists with this email, a password reset link has been sent.' };
  });
