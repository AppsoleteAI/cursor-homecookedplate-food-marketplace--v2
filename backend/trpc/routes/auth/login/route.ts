import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createServerSupabaseClient } from "../../../../lib/supabase";
import { assertEmailConfirmed } from "../../../../lib/email-confirmation";

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
export const loginProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
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
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Confirm your email before signing in. Check your inbox for the verification link.',
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
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: confirmationError instanceof Error
          ? confirmationError.message
          : 'Confirm your email before signing in. Check your inbox for the verification link.',
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

    if (profile.ordering_removed) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This account is permanently banned after lost card disputes.',
      });
    }

    return {
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        role: profile.role as 'platemaker' | 'platetaker',
        isAdmin: profile.is_admin || false,
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
