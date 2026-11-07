import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { readAdminRole } from "../../../../lib/admin-role";
import { assertEmailConfirmed, CONFIRMATION_EXPIRED_MESSAGE, confirmationWindowClosed } from "../../../../lib/email-confirmation";
import { accountAllowsSignIn, LEGAL_SAVE_FAILED_MESSAGE, LEGAL_SIGN_IN_MESSAGE, legalSafetyAgreementSchema, legalSignInDecision } from "../../../../lib/legal-gate";
import { MEMBERSHIP_INELIGIBLE_MESSAGE, NO_ACCOUNT_MESSAGE } from "../../../../lib/sign-in-messages";
import { readAuthIdentityKind, signInWithoutProfileMessage } from "../../../../lib/provider-profile";
import { AUTHENTICATOR_MISMATCH_MESSAGE, mfaLookupState, verifiedTotpFactorId, verifyTotpCode } from "../../../../lib/second-factor";

/**
 * Login procedure - uses anon key (not service role key)
 * 
 * CRITICAL: Login must use anon key (not service role key) because:
 * - signInWithPassword() is a client-facing operation that should respect RLS
 * - Service role key is only for admin operations (signup, webhooks, recovery)
 * 
 * The Worker builds that client per request from its own bindings. The module
 * singleton is empty there, so login must use ctx.supabase.
 */
async function confirmationExpired(admin: { from: (table: string) => any }, email: string, userId?: string | null, knownCreatedAt?: string | null): Promise<boolean> {
  let accountId = userId || null;
  let accountCreatedAt = knownCreatedAt || null;
  if (!accountId) {
    const profile = await admin
      .from('profiles')
      .select('id, created_at')
      .ilike('email', email)
      .maybeSingle();
    accountId = profile.data?.id || null;
    accountCreatedAt = profile.data?.created_at || accountCreatedAt;
  }
  if (!accountId) return false;

  const token = await admin
    .from('email_verification_tokens')
    .select('expires_at, created_at')
    .eq('user_id', accountId)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return confirmationWindowClosed({
    expiresAt: token.data?.expires_at || null,
    accountCreatedAt: token.data?.created_at || accountCreatedAt,
  });
}

export const loginProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
      code: z.string().regex(/^\d{6}$/).optional(),
      legalSafetyAgreement: legalSafetyAgreementSchema.optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      const authError = error as { message?: string; code?: string } | null;
      const authText = `${authError?.code ?? ''} ${authError?.message ?? ''}`.toLowerCase();
      if (authText.includes('email_not_confirmed') || authText.includes('email not confirmed')) {
        const expired = await confirmationExpired(ctx.supabaseAdmin, input.email);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: expired
            ? CONFIRMATION_EXPIRED_MESSAGE
            : 'Confirm your email before signing in. The link in that email lasts 24 hours.',
        });
      }
      const { data: existingAccount, error: lookupError } = await ctx.supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', input.email)
        .maybeSingle();
      const identity = await readAuthIdentityKind(ctx.supabaseAdmin, input.email);
      if (!lookupError && !existingAccount) {
        const unfinished = signInWithoutProfileMessage(identity);
        throw new TRPCError({
          code: unfinished ? 'CONFLICT' : 'NOT_FOUND',
          message: unfinished || NO_ACCOUNT_MESSAGE,
        });
      }
      if (identity === 'provider') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: signInWithoutProfileMessage('provider') || NO_ACCOUNT_MESSAGE,
        });
      }
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'That password does not match.',
      });
    }

    try {
      assertEmailConfirmed(data.user.email_confirmed_at);
    } catch (confirmationError) {
      await ctx.supabase.auth.signOut();
      const expired = await confirmationExpired(ctx.supabaseAdmin, input.email, data.user.id, data.user.created_at);
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: expired
          ? CONFIRMATION_EXPIRED_MESSAGE
          : confirmationError instanceof Error
            ? confirmationError.message
            : 'Confirm your email before signing in. The link in that email lasts 24 hours.',
      });
    }

    // The password session is aal1. A verified factor cannot read its profile through that token.
    // The user id comes from the password sign-in, and the service role reads the row.
    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      await ctx.supabase.auth.signOut();
      const identity = await readAuthIdentityKind(ctx.supabaseAdmin, input.email);
      const unfinished = signInWithoutProfileMessage(identity);
      throw new TRPCError({
        code: unfinished ? 'CONFLICT' : 'NOT_FOUND',
        message: unfinished || NO_ACCOUNT_MESSAGE,
      });
    }

    if (profile.is_paused) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This account is paused. Reactivate it to sign in.',
      });
    }

    const createdAt = new Date(profile.created_at);
    const legalDecision = legalSignInDecision({
      stored: profile.legal_safety_agreement,
      submitted: input.legalSafetyAgreement,
      createdAt,
    });
    if (legalDecision === 'refuse') {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({ code: 'FORBIDDEN', message: LEGAL_SIGN_IN_MESSAGE });
    }
    if (legalDecision === 'save') {
      const saved = await ctx.supabaseAdmin
        .from('profiles')
        .update({ legal_safety_agreement: input.legalSafetyAgreement })
        .eq('id', profile.id)
        .select('legal_safety_agreement')
        .single();
      if (saved.error || !accountAllowsSignIn(saved.data?.legal_safety_agreement, createdAt)) {
        await ctx.supabase.auth.signOut();
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: LEGAL_SAVE_FAILED_MESSAGE });
      }
      profile.legal_safety_agreement = saved.data.legal_safety_agreement;
    }

    let session = data.session;
    const listed = await ctx.supabaseAdmin.auth.admin.mfa.listFactors({ userId: profile.id });
    const lookup = mfaLookupState(listed.error?.message);
    if (lookup === 'failed') {
      await ctx.supabase.auth.signOut({ scope: 'local' });
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That authenticator could not be checked.' });
    }
    const factorId = verifiedTotpFactorId(listed.data?.factors);
    const verifiedCount = (listed.data?.factors ?? []).filter((factor) => factor.status === 'verified').length;
    if (verifiedCount > 0 && !factorId) {
      await ctx.supabase.auth.signOut({ scope: 'local' });
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This account has a second factor this app cannot ask for.' });
    }
    if (factorId) {
      if (!input.code) {
        await ctx.supabase.auth.signOut({ scope: 'local' });
        return { needsTwoFactor: true as const };
      }
      const upgraded = await verifyTotpCode({
        supabaseUrl: ctx.supabaseUrl,
        anonKey: ctx.supabaseAnonKey,
        accessToken: data.session.access_token,
        factorId,
        code: input.code,
      });
      if (!upgraded) {
        await ctx.supabase.auth.signOut({ scope: 'local' });
        throw new TRPCError({ code: 'UNAUTHORIZED', message: AUTHENTICATOR_MISMATCH_MESSAGE });
      }
      session = {
        ...data.session,
        access_token: upgraded.access_token,
        refresh_token: upgraded.refresh_token,
      };
    }

    if (profile.ordering_removed) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: MEMBERSHIP_INELIGIBLE_MESSAGE,
      });
    }

    return {
      needsTwoFactor: false as const,
      user: {
        id: profile.id,
        username: profile.username,
        businessName: typeof profile.business_name === 'string' ? profile.business_name : '',
        email: profile.email,
        role: profile.role as 'platemaker' | 'platetaker',
        isAdmin: profile.is_admin || false,
        adminRole: readAdminRole(profile),
        phone: profile.phone,
        bio: profile.bio,
        profileImage: profile.profile_image,
        createdAt: new Date(profile.created_at),
        isPaused: profile.is_paused,
        twoFactorEnabled: Boolean(factorId),
      },
      session,
      legalSafetyAgreement: profile.legal_safety_agreement ?? null,
    };
  });
