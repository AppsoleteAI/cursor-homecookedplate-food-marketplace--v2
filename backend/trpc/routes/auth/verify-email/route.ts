import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sendWelcomeEmail } from "@/backend/lib/email";

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

    // A second open is the same confirmed address. PlateTaker and PlateMaker share this link.
    if (tokenRecord.used_at) {
      return {
        success: true,
        message: 'This address is already confirmed. You can sign in.',
        userId: tokenRecord.user_id,
      };
    }

    const { error: confirmError } = await ctx.supabaseAdmin.auth.admin.updateUserById(
      tokenRecord.user_id,
      { email_confirm: true }
    );
    if (confirmError) {
      console.error('[Verify Email] Failed to confirm auth email:', confirmError);
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'The confirmation link could not be saved. Please try again.',
      });
    }

    // The address is confirmed once the auth update succeeds. Recording used_at
    // stops a second open from repeating the work. A missing column must not
    // turn a confirmed address into the busy-kitchen failure.
    const { error: updateError } = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error('[Verify Email] Email is confirmed. The link could not be marked used:', updateError);
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
