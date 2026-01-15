import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { createServerSupabaseClient, supabaseAdmin } from "../../../../lib/supabase";
import { TRPCError } from "@trpc/server";

async function sendWelcomeEmail(email: string, username: string) {
  try {
    console.log(`[Signup] Welcome email would be sent to ${email} for ${username}`);
  } catch (error) {
    console.error('[Signup] Failed to send welcome email:', error);
  }
}

export const signupProcedure = publicProcedure
  .input(
    z.object({
      username: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(6),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Signup] Starting signup for:', input.email);
    
    // Use admin client for signup (bypasses RLS)
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: undefined,
        data: {
          username: input.username,
        }
      }
    });

    if (authError || !authData.user) {
      console.error('[Signup] Auth error:', authError);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: authError?.message || 'Failed to create account',
      });
    }

    console.log('[Signup] User created:', authData.user.id);
    console.log('[Signup] Session exists:', !!authData.session);

    if (!authData.session) {
      console.log('[Signup] No session - email confirmation required');
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please check your email to confirm your account before logging in',
      });
    }

    // Immediately create profile using admin client (bypasses RLS)
    // Don't wait for trigger - use admin client to ensure it works
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: input.username,
        email: input.email,
        role: 'platetaker',
      })
      .select()
      .single();

    // Cleanup on failure - delete auth user if profile creation fails
    if (profileError || !profile) {
      console.error('[Signup] Profile creation failed:', profileError);
      console.error('[Signup] User ID:', authData.user.id);
      
      // Attempt to clean up the auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        console.log('[Signup] Cleaned up auth user after profile creation failure');
      } catch (cleanupError) {
        console.error('[Signup] Failed to cleanup auth user:', cleanupError);
      }

      if (profileError?.code === '23505') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Username or email already exists',
        });
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to create profile: ${profileError?.message || profileError?.code || 'Unknown error'}`,
      });
    }

    console.log('[Signup] Profile created successfully with admin client');
    await sendWelcomeEmail(input.email, input.username);

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
      session: authData.session,
    };
  });
