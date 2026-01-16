import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../../lib/supabase"; // NOT supabaseAdmin - uses anon key

/**
 * Login procedure - uses anon key (not service role key)
 * 
 * CRITICAL: Login must use anon key (not service role key) because:
 * - signInWithPassword() is a client-facing operation that should respect RLS
 * - Service role key is only for admin operations (signup, webhooks, recovery)
 * 
 * This route directly imports and uses the 'supabase' client which uses EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
export const loginProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    // Use supabase client (anon key) for login - correct for user authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      throw new Error(error?.message || 'Invalid credentials');
    }

    // Create a new client instance with the session token for authenticated queries
    // This avoids session conflicts with the singleton client
    const authenticatedClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        },
      }
    );

    // Fetch profile using authenticated client (anon key with session token)
    const { data: profile, error: profileError } = await authenticatedClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
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
    };
  });
