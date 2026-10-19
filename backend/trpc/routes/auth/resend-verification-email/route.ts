import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { sendEmailConfirmation } from "@/backend/lib/email";

/**
 * Resend Email Verification Procedure
 * 
 * Allows users to request a new email confirmation link if they didn't receive
 * the original email or if the token expired.
 * 
 * CRITICAL: Supabase emails are rate-limited and not suitable for production.
 * This endpoint uses Resend (production email service) for reliable delivery.
 * 
 * Security: Only allows resending to existing unverified users to prevent email enumeration.
 */
export const resendVerificationEmailProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email("Invalid email format"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const email = input.email.trim().toLowerCase();
    const sent = {
      success: true,
      message: 'If an account exists with this email, a new verification link has been sent.',
    };

    const { data: profileRows, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, username, email')
      .ilike('email', email)
      .limit(1);

    if (profileError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to lookup user',
      });
    }

    const profile = profileRows?.[0];
    if (!profile) {
      return sent;
    }

    const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.getUserById(profile.id);
    if (authError || !authData.user) {
      return sent;
    }

    if (authData.user.email_confirmed_at) {
      return {
        success: true,
        alreadyConfirmed: true,
        message: 'This address is already confirmed. You can sign in.',
      };
    }

    const user = authData.user;

    // Check for existing unused tokens
    const { data: existingTokens } = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .select('id')
      .eq('user_id', user.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    // If there's a valid unused token, don't create a new one (rate limiting)
    if (existingTokens && existingTokens.length > 0) {
      return {
        success: true,
        message: 'A verification email was recently sent. Please check your inbox and spam folder.',
      };
    }

    const username = profile.username || email.split('@')[0];
    const deliveryEmail = (profile.email || email).trim().toLowerCase();

    // Generate new secure token
    const confirmationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // Store new token in database
    const { error: tokenError } = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: confirmationToken,
        email: deliveryEmail,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('[Resend Verification] Failed to store token:', tokenError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate verification token. Please try again.',
      });
    }

    // Send confirmation email via Resend
    try {
      const webUrl = ctx.webUrl || process.env.EXPO_PUBLIC_WEB_URL || 'https://homecookedplate.com';
      await sendEmailConfirmation(
        deliveryEmail,
        username,
        confirmationToken,
        webUrl
      );
      console.log(`[Resend Verification] Email sent to ${deliveryEmail}`);
    } catch (emailError) {
      console.error('[Resend Verification] Failed to send email:', emailError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send verification email. Please try again later.',
      });
    }

    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with this email, a new verification link has been sent.',
    };
  });
