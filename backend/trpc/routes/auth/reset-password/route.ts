import { publicProcedure } from "../../../create-context";
import { z } from "zod";

/**
 * Determines the appropriate redirect URL based on platform.
 * Supports both web and mobile (Expo) deep links.
 * 
 * Security: The redirect URL must be added to Supabase Auth > URL Configuration > Redirect URLs
 * - Web: https://your-app.com/reset-password
 * - Mobile: homecookedplate://(auth)/reset-password
 * - Expo Dev: exp://localhost:8081/--/(auth)/reset-password
 */
function getRedirectUrl(platform: 'web' | 'mobile' | undefined, webUrl: string): string {
  // Default to mobile deep link (matches app.json scheme: "homecookedplate")
  if (platform === 'web') {
    // For web, use the webUrl from context (set via Cloudflare Workers vars or process.env)
    return `${webUrl}/reset-password`;
  }
  
  // Mobile deep link (matches app.json scheme)
  return 'homecookedplate://(auth)/reset-password';
}

export const resetPasswordProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      platform: z.enum(['web', 'mobile']).optional(), // Optional platform hint
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Determine redirect URL based on platform hint or default to mobile
    // Use webUrl from context (set via Cloudflare Workers vars or process.env)
    const redirectTo = getRedirectUrl(input.platform, ctx.webUrl);
    
    const { error } = await ctx.supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo,
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
