import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { createServerSupabaseClient } from "../../../../lib/supabase";

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
  .mutation(async ({ input, ctx }) => {
    console.log('[Signup] Starting signup for:', input.email);
    
    const { data: authData, error: authError } = await ctx.supabase.auth.signUp({
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
      throw new Error(authError?.message || 'Failed to create account');
    }

    console.log('[Signup] User created:', authData.user.id);
    console.log('[Signup] Session exists:', !!authData.session);

    if (!authData.session) {
      console.log('[Signup] No session - email confirmation required');
      throw new Error('Please check your email to confirm your account before logging in');
    }

    const authenticatedSupabase = createServerSupabaseClient(authData.session.access_token);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: profile, error: profileError } = await authenticatedSupabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('[Signup] Profile not found after trigger:', profileError);
      console.error('[Signup] User ID:', authData.user.id);
      
      const { data: manualProfile, error: manualError } = await authenticatedSupabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: input.username,
          email: input.email,
          role: 'platetaker',
        })
        .select()
        .single();

      if (manualError) {
        console.error('[Signup] Manual profile creation also failed:', manualError);
        if (manualError.code === '23505') {
          throw new Error('Username or email already exists');
        }
        throw new Error(`Failed to create profile: ${manualError.message || manualError.code || 'Unknown error'}`);
      }

      console.log('[Signup] Manual profile created successfully');
      await sendWelcomeEmail(input.email, input.username);

      return {
        user: {
          id: manualProfile.id,
          username: manualProfile.username,
          email: manualProfile.email,
          role: manualProfile.role as 'platemaker' | 'platetaker',
          isAdmin: manualProfile.is_admin || false,
          phone: manualProfile.phone,
          bio: manualProfile.bio,
          profileImage: manualProfile.profile_image,
          createdAt: new Date(manualProfile.created_at),
          isPaused: manualProfile.is_paused,
          twoFactorEnabled: manualProfile.two_factor_enabled,
        },
        session: authData.session,
      };
    }

    console.log('[Signup] Profile retrieved successfully from trigger');
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
