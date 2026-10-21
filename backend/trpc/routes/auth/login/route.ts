import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createServerSupabaseClient } from "../../../../lib/supabase";
import { readAdminRole } from "../../../../lib/admin-role";
import { assertEmailConfirmed, CONFIRMATION_EXPIRED_MESSAGE, confirmationWindowClosed } from "../../../../lib/email-confirmation";
import { sendSignInCode } from "../../../../lib/email";
import { nextSignInAttempt, SIGN_IN_CODE_LOCKED_MESSAGE, signInCodeStillOpen, signInCodeWasLocked } from "../../../../lib/sign-in-code";

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
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
      if (!lookupError && !existingAccount) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No account uses this email.',
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

    const authenticatedClient = createServerSupabaseClient(data.session.access_token, {
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });

    // Fetch profile using authenticated client (anon key with session token)
    const { data: profile, error: profileError } = await authenticatedClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    if (profile.is_paused) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This account is paused. Reactivate it to sign in.',
      });
    }

    if (profile.two_factor_enabled) {
      if (!input.code) {
        const openCode = await ctx.supabaseAdmin
          .from('audit_logs')
          .select('id, new_data')
          .eq('user_id', profile.id)
          .eq('action', 'SIGN_IN_CODE')
          .order('created_at', { ascending: false })
          .limit(1);
        if (openCode.error) {
          await ctx.supabase.auth.signOut();
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That sign-in code could not be checked.' });
        }
        const openRow = openCode.data?.[0];
        const openStored = openRow?.new_data as { hash?: string; expiresAt?: string; used?: boolean; attempts?: number } | null;
        if (signInCodeStillOpen(openStored)) {
          await ctx.supabase.auth.signOut();
          return { needsTwoFactor: true as const, codeReused: true as const };
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const hash = await sha256(`${profile.id}:${code}`);
        const saved = await ctx.supabaseAdmin.from('audit_logs').insert({
          user_id: profile.id,
          action: 'SIGN_IN_CODE',
          table_name: 'profiles',
          new_data: { hash, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), used: false, attempts: 0 },
        }).select('id').single();
        if (saved.error || !saved.data?.id) {
          await ctx.supabase.auth.signOut();
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The sign-in code could not be saved.' });
        }
        const dropUnsent = async () => {
          await ctx.supabaseAdmin.from('audit_logs').delete().eq('id', saved.data.id);
        };
        if (!profile.email) {
          await dropUnsent();
          await ctx.supabase.auth.signOut();
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The sign-in code could not be emailed.' });
        }
        try {
          await sendSignInCode(profile.email, code);
        } catch {
          await dropUnsent();
          await ctx.supabase.auth.signOut();
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The sign-in code could not be emailed.' });
        }
        await ctx.supabase.auth.signOut();
        return { needsTwoFactor: true as const, codeReused: false as const };
      }
      const { data: latest } = await ctx.supabaseAdmin
        .from('audit_logs')
        .select('id, new_data')
        .eq('user_id', profile.id)
        .eq('action', 'SIGN_IN_CODE')
        .order('created_at', { ascending: false })
        .limit(1);
      const row = latest?.[0];
      const stored = row?.new_data as { hash?: string; expiresAt?: string; used?: boolean; attempts?: number } | null;
      const hash = await sha256(`${profile.id}:${input.code}`);
      const fresh = stored?.expiresAt ? Date.parse(stored.expiresAt) > Date.now() : false;
      if (signInCodeWasLocked(stored)) {
        await ctx.supabase.auth.signOut();
        throw new TRPCError({ code: 'UNAUTHORIZED', message: SIGN_IN_CODE_LOCKED_MESSAGE });
      }
      if (!row || !stored || stored.used || !fresh) {
        await ctx.supabase.auth.signOut();
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'That sign-in code does not match.' });
      }
      if (stored.hash !== hash) {
        const next = nextSignInAttempt(stored.attempts);
        const savedAttempt = await ctx.supabaseAdmin.from('audit_logs').update({
          new_data: { ...stored, attempts: next.attempts, used: next.locked },
        }).eq('id', row.id);
        await ctx.supabase.auth.signOut();
        if (savedAttempt.error) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That sign-in code could not be checked.' });
        }
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: next.locked
            ? SIGN_IN_CODE_LOCKED_MESSAGE
            : 'That sign-in code does not match.',
        });
      }
      await ctx.supabaseAdmin.from('audit_logs').update({
        new_data: { ...stored, used: true },
      }).eq('id', row.id);
    }

    if (profile.ordering_removed) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This account is permanently banned after lost card disputes.',
      });
    }

    return {
      needsTwoFactor: false as const,
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        role: profile.role as 'platemaker' | 'platetaker',
        isAdmin: profile.is_admin || false,
        adminRole: readAdminRole(profile),
        phone: profile.phone,
        bio: profile.bio,
        profileImage: profile.profile_image,
        createdAt: new Date(profile.created_at),
        isPaused: profile.is_paused,
        twoFactorEnabled: profile.two_factor_enabled,
      },
      session: data.session,
      legalSafetyAgreement: profile.legal_safety_agreement ?? null,
    };
  });
