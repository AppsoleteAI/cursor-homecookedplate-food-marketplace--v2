import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { sendEmailConfirmation } from "@/backend/lib/email";
import {
  ALREADY_CONFIRMED_SIGN_IN_MESSAGE,
  CONFIRMATION_SEND_FAILED_MESSAGE,
  confirmationExpiresAt,
  RESEND_CONFIRMATION_MESSAGE,
} from "../../../../lib/email-confirmation";

/**
 * Resend Email Verification Procedure
 *
 * An unknown address and a link that was sent share one sentence.
 * An address that is already confirmed is told to sign in. No second link is sent.
 * A link that cannot be stored, or a send the mail host refuses, is a failure.
 * That failure does not confirm the address and does not name the account.
 * Each stored link lasts 24 hours from this request.
 * An older unused link is expired so it is not sent again.
 */
const sent = {
  success: true as const,
  message: RESEND_CONFIRMATION_MESSAGE,
};

export const resendVerificationEmailProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email("Invalid email format"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const email = input.email.trim().toLowerCase();

    const { data: profileRows, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, username, email')
      .ilike('email', email)
      .limit(1);

    if (profileError) {
      console.error('[Resend Verification] The account could not be looked up');
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: CONFIRMATION_SEND_FAILED_MESSAGE });
    }
    if (!profileRows?.[0]) {
      return sent;
    }

    const profile = profileRows[0];
    const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.getUserById(profile.id);
    if (authError || !authData.user) {
      console.error('[Resend Verification] The account could not be checked');
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: CONFIRMATION_SEND_FAILED_MESSAGE });
    }
    if (authData.user.email_confirmed_at) {
      return { success: true as const, message: ALREADY_CONFIRMED_SIGN_IN_MESSAGE };
    }

    const user = authData.user;
    const webUrl = ctx.webUrl || process.env.EXPO_PUBLIC_WEB_URL || 'https://homecookedplate.com';
    const username = profile.username || email.split('@')[0];
    const deliveryEmail = (profile.email || email).trim().toLowerCase();
    const confirmationToken = randomBytes(32).toString('hex');
    const expiresAt = confirmationExpiresAt();

    const { error: tokenError } = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: confirmationToken,
        email: deliveryEmail,
        expires_at: expiresAt,
      });

    if (tokenError) {
      console.error('[Resend Verification] The new link could not be stored');
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: CONFIRMATION_SEND_FAILED_MESSAGE });
    }

    const retired = await ctx.supabaseAdmin
      .from('email_verification_tokens')
      .update({ expires_at: new Date(0).toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null)
      .neq('token', confirmationToken);
    if (retired.error) {
      console.error('[Resend Verification] An older link could not be expired');
    }

    try {
      await sendEmailConfirmation(deliveryEmail, username, confirmationToken, webUrl);
    } catch {
      console.error('[Resend Verification] The link was not sent');
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: CONFIRMATION_SEND_FAILED_MESSAGE });
    }

    return sent;
  });
