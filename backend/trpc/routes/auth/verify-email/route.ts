import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line import/no-unresolved
import { sendWelcomeEmail } from "../../../lib/email";

/**
 * Email Verification Procedure
 * 
 * Verifies email confirmation tokens sent via Resend (production email service).
 * 
 * CRITICAL: Supabase emails are rate-limited and not suitable for production.
 * This endpoint handles verification for our custom email confirmation flow.
 * 
 * Flow:
 * 1. User signs up → receives confirmation email via Resend
 * 2. User clicks link → navigates to verify-email screen
 * 3. Frontend calls this procedure with token
 * 4. Backend validates token (exists, not expired, not used)
 * 5. Backend marks token as used
 * 6. Backend sends welcome email (optional)
 * 7. User can now log in
 */
export const verifyEmailProcedure = publicProcedure
  .input(
    z.object({
      token: z.string().min(1, "Token is required"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { token } = input;

    // Find token in database
    const { data: tokenRecord, error: tokenError } = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invalid verification token. Please check your email and try again.',
      });
    }

    // Check if token has expired
    const expiresAt = new Date(tokenRecord.expires_at);
    if (expiresAt < new Date()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Verification token has expired. Please request a new confirmation email.',
      });
    }

    // Check if token has already been used
    if (tokenRecord.used_at) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This verification link has already been used. Your email is already verified.',
      });
    }

    // Mark token as used
    const { error: updateError } = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error('[Verify Email] Failed to mark token as used:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify email. Please try again.',
      });
    }

    // Get user profile for welcome email
    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('username, email')
      .eq('id', tokenRecord.user_id)
      .single();

    // Send welcome email (optional - don't fail if this fails)
    if (profile && !profileError) {
      try {
        await sendWelcomeEmail(profile.email, profile.username);
        console.log(`[Verify Email] Welcome email sent to ${profile.email}`);
      } catch (emailError) {
        console.error('[Verify Email] Failed to send welcome email:', emailError);
        // Don't throw - welcome email is not critical
      }
    }

    return {
      success: true,
      message: 'Email verified successfully! You can now log in.',
      userId: tokenRecord.user_id,
    };
  });
