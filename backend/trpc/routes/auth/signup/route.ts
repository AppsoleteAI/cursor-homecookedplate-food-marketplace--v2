// CODE VERSION: v4-insert-then-update-20250118 (forces module reload)
import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { sendEmailConfirmation } from "@/backend/lib/email";
import { saveKitchenPin } from "../../../../lib/kitchen-pin";
import { nearestMetro } from "../../../../lib/metro-radius";
// Use process.stdout.write directly for critical logs (bypasses Bun buffering)

// Force module reload by adding version to export
const SIGNUP_PROCEDURE_VERSION = `v4-insert-then-update-20250118-${Date.now()}`;

console.log('[Signup Route] PROCEDURE_EXPORT - Version:', SIGNUP_PROCEDURE_VERSION);

// Strict password validation schema - matches frontend PasswordStrengthMeter requirements
// Export for reuse in other routes (e.g., password reset, password change)
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

// Create procedure with runtime version check
const createSignupProcedure = () => {
  console.log('[Signup Route] Creating signup procedure with version:', SIGNUP_PROCEDURE_VERSION);
  return publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        email: z.string().email("Invalid email format"),
        password: passwordSchema, // Apply the strict rules here
        role: z.enum(['platemaker', 'platetaker']).optional().default('platetaker'),
        lat: z.number().nullish(),
        lng: z.number().nullish(),
        foodSafetyAcknowledged: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {

      console.log('[Signup] Starting signup for:', input.email);

      // Use admin.createUser() - requires Service Role Key
      // Use ctx.supabaseAdmin (service role) for signup operations:
      // - Creating auth users via admin.createUser() (requires service role)
      // - Inserting/updating profiles during signup (system operation)
      // - Metro count increments (thread-safe atomic writes)
      let authData: any;
      let authError: any;

      try {
        const result = await ctx.supabaseAdmin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: false,
          user_metadata: { username: input.username, role: input.role }
        });
        authData = { user: result.data.user, session: null };
        authError = result.error;

      } catch (error: any) {
        authError = error;
        authData = { user: null, session: null };
      }

      if (authError || !authData.user) {
        console.error('[Signup] Auth error:', authError);
        const isDuplicateEmail =
          authError?.message?.toLowerCase().includes('already registered') ||
          authError?.message?.toLowerCase().includes('user already exists') ||
          authError?.status === 422 ||
          authError?.code === '23505';

        if (isDuplicateEmail) {
          const passwordCheck = await ctx.supabase.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });
          const passwordMessage = passwordCheck.error?.message?.toLowerCase() || "";
          const passwordAccepted = Boolean(passwordCheck.data?.session) || passwordMessage.includes("not confirmed");
          if (!passwordAccepted) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'An account with this email already exists. Please use login instead.',
            });
          }

          const { data: existingProfile, error: existingProfileError } = await ctx.supabaseAdmin
            .from("profiles")
            .select("id, username, email, role, is_admin, phone, bio, profile_image, created_at, is_paused, two_factor_enabled, metro_area, trial_ends_at, membership_tier")
            .eq("email", input.email)
            .maybeSingle();

          if (existingProfileError || !existingProfile) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'An account with this email already exists. Please use login instead.',
            });
          }

          if (existingProfile.membership_tier === "premium" && existingProfile.trial_ends_at) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'An account with this email already exists. Please use login instead.',
            });
          }

          if (passwordCheck.data?.session) {
            await ctx.supabase.auth.signOut();
          }
          const alreadyConfirmed = Boolean(passwordCheck.data?.user?.email_confirmed_at) || Boolean(passwordCheck.data?.session);
          if (alreadyConfirmed) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'An account with this email already exists. Please use login instead.',
            });
          }

          return {
            status: (existingProfile.role === 'platetaker' ? 'SUCCESS' : 'CHOOSE_MEMBERSHIP') as 'SUCCESS' | 'CHOOSE_MEMBERSHIP',
            user: {
              id: existingProfile.id,
              username: existingProfile.username,
              email: existingProfile.email,
              role: existingProfile.role as 'platemaker' | 'platetaker',
              isAdmin: existingProfile.is_admin || false,
              phone: existingProfile.phone,
              bio: existingProfile.bio,
              profileImage: existingProfile.profile_image,
              createdAt: new Date(existingProfile.created_at),
              isPaused: existingProfile.is_paused,
              twoFactorEnabled: existingProfile.two_factor_enabled,
              metroArea: existingProfile.metro_area || null,
              trialEndsAt: existingProfile.trial_ends_at ? new Date(existingProfile.trial_ends_at) : null,
            },
            session: null,
            metro: existingProfile.metro_area || 'Remote/Other',
            needsEmailConfirmation: true,
            confirmationEmailSent: false,
          };
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: authError?.message || 'Failed to create account',
        });
      }

      console.log('[Signup] User created:', authData.user.id);

      // GEO-LOCK v4: Determine metro_area, trial_ends_at, and membership_tier
      // Inside metros: Check is_active (from metro_geofences) and the Early Bird slot rule - one PlateMaker per 10,000 people, from 200 to 1,000
      // Outside metros (Remote): Assign 'Remote/Other', no trial, set membership_tier to 'free' (must pay $4.99 to activate premium)
      // Source of Truth: All city-level settings (trial length, active status) MUST be read from metro_geofences table
      let assignedMetro: string | null = null;
      const trialEndsAt: string | null = null;
      let membershipTier: 'free' | 'premium' = 'free'; // Default to free
      let earlyBirdEligible = false;
      let offeredTrialDays = 0;

      if (typeof input.lat === 'number' && typeof input.lng === 'number') {
        process.stdout.write(`[GEO_LOCK] Verifying location for user: ${input.username} at (${input.lat}, ${input.lng})\n`);
        
        // Consolidated RPC: Get metro settings by location (combines lookup + settings query)
        // Returns metro_name, is_active, and trial_days if metro found, otherwise returns no rows
        // Use ctx.supabaseAdmin (service role) for system operations during signup
        const nearest = nearestMetro(input.lat, input.lng);
        const settingsRead = nearest
          ? await ctx.supabaseAdmin
            .from('metro_geofences')
            .select('metro_name, is_active, trial_days')
            .eq('metro_name', nearest.name)
            .maybeSingle()
          : null;
        const metroError = settingsRead?.error ?? null;
        if (metroError) {
          process.stdout.write(`[GEO_LOCK] Could not read metro settings: ${metroError.message || JSON.stringify(metroError)}. Using the nearest 50-mile metro.\n`);
        }
        const saved = settingsRead?.data ?? null;
        const metro = nearest
          ? {
            metro_name: nearest.name,
            is_active: saved?.is_active !== false,
            trial_days: typeof saved?.trial_days === 'number' ? saved.trial_days : 90,
          }
          : null;

        if (!metro) {
          process.stdout.write(`[GEO_LOCK] No metro area found for coordinates (${input.lat}, ${input.lng}). Assigning Remote/Other\n`);
          assignedMetro = 'Remote/Other';
          membershipTier = 'free';
          process.stdout.write(`[GEO_LOCK] Remote User. Early Bird is not available. membership_tier: ${membershipTier}\n`);
        } else {
          // Metro found - Check is_active FIRST (Panic Button check)
          // Throw error immediately if inactive - do not proceed with signup
          if (!metro.is_active) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: `Signups in ${metro.metro_name} are currently paused for maintenance.`,
            });
          }

          // Metro is active - proceed with signup and check cap
          assignedMetro = metro.metro_name;
          
          // Database Integrity: Always use increment_metro_count RPC for signups
          // RPC handles row-level locking for concurrency safety (do not manage counts in frontend)
          // RPC returns status string 'SUCCESS' or 'CAP_REACHED'
          // Use ctx.supabaseAdmin (service role) for writes - ensures thread-safe atomic increment
          const { data: status, error: incrementError } = await ctx.supabaseAdmin.rpc(
            'increment_metro_count',
            {
              metro_name_param: metro.metro_name, // RPC parameter: text
              user_role: input.role || 'platetaker' // RPC parameter: text
            }
          );

          if (incrementError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to secure metro spot: ${incrementError.message || JSON.stringify(incrementError)}`,
            });
          }

          if (status === 'SUCCESS' && (input.role || 'platetaker') === 'platemaker') {
            // The spot is held. Early Bird starts only when the PlateMaker chooses it. No card.
            offeredTrialDays = metro.trial_days ?? 90;
            earlyBirdEligible = true;
            membershipTier = 'free';
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. Early Bird is open for ${offeredTrialDays} days. It is not started until the PlateMaker chooses it.\n`);
          } else if (status === 'SUCCESS') {
            membershipTier = 'free';
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. PlateTaker signup. Premium stays optional.\n`);
          } else {
            membershipTier = 'free';
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. CAP_REACHED. PlateMaker chooses a paid plan. Early Bird is not available.\n`);
          }
        }
      } else {
        // No coordinates provided: Assign Remote/Other (no trial, free tier)
        process.stdout.write(`[GEO_LOCK] No coordinates provided. Assigning Remote/Other\n`);
        assignedMetro = 'Remote/Other';
        membershipTier = 'free';
        process.stdout.write(`[GEO_LOCK] Remote User. Early Bird is not available. membership_tier: ${membershipTier}\n`);
      }

      // V4 PATTERN: INSERT-then-UPDATE (Catch 23505)
      // The Supabase profile trigger creates a record instantly. We MUST catch the unique constraint
      // error and perform an UPDATE to finalize metro_area and trial_ends_at fields.

      // Prepare profile data with finalized metro_area, trial_ends_at, and membership_tier
      const profileData = {
        id: authData.user.id,
        username: input.username,
        email: input.email,
        role: input.role as 'platemaker' | 'platetaker',
        metro_area: assignedMetro, // Always set: matched metro or 'Remote/Other'
        trial_ends_at: trialEndsAt, // Early Bird writes this later, when the PlateMaker claims it.
        membership_tier: membershipTier, // 'premium' for metro with available trial slot, 'free' otherwise
        food_safety_acknowledged: input.role === 'platemaker' ? (input.foodSafetyAcknowledged || false) : false, // Only set for platemakers
      };

      process.stdout.write(`[SIGNUP_V4] Attempting INSERT with metro_area=${assignedMetro}, trial_ends_at=${trialEndsAt || 'null'}, membership_tier=${membershipTier}\n`);

      // Try insert first
      // Use ctx.supabaseAdmin (service role) for profile creation during signup (system operation)
      let { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      // If insert fails with duplicate key (23505), trigger already created profile - UPDATE to finalize
      if (profileError?.code === '23505') {
        process.stdout.write(`[SIGNUP_V4] Profile exists (23505), performing UPDATE to finalize metro_area, trial_ends_at, and membership_tier\n`);
        // Use ctx.supabaseAdmin (service role) for profile updates during signup (system operation)
        const updateResult = await ctx.supabaseAdmin
          .from('profiles')
          .update({
            // Update all fields to ensure metro_area, trial_ends_at, and membership_tier are finalized
            username: profileData.username,
            email: profileData.email,
            role: profileData.role,
            metro_area: profileData.metro_area, // CRITICAL: Finalize metro_area (matched metro or 'Remote/Other')
            trial_ends_at: profileData.trial_ends_at, // CRITICAL: Finalize trial_ends_at (dynamic trial_days from metro_geofences for metros, null for Remote/Other)
            membership_tier: profileData.membership_tier, // CRITICAL: Finalize membership_tier ('premium' for metro, 'free' for remote)
            food_safety_acknowledged: profileData.food_safety_acknowledged, // Store food safety acknowledgment for platemakers
          })
          .eq('id', authData.user.id)
          .select()
          .single();
        profile = updateResult.data;
        profileError = updateResult.error;
        process.stdout.write(`[SIGNUP_V4] UPDATE completed. metro_area=${profile?.metro_area}, trial_ends_at=${profile?.trial_ends_at || 'null'}, membership_tier=${profile?.membership_tier}\n`);
      }


      if (profileError || !profile) {
        console.error('[Signup] Profile upsert failed:', profileError);
        try {
          await ctx.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          console.log('[Signup] Cleaned up auth user after profile creation failure');
        } catch (cleanupError) {
          console.error('[Signup] Failed to cleanup auth user:', cleanupError);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create profile: ${profileError?.message || 'Unknown error'}`,
        });
      }

      console.log('[Signup] Profile created successfully with admin client');
      if (typeof input.lat === 'number' && typeof input.lng === 'number') {
        await saveKitchenPin(ctx.supabaseAdmin, authData.user.id, input.lat, input.lng);
      }

      // Generate email confirmation token and send via Resend (production email service)
      // CRITICAL: Supabase emails are rate-limited and not suitable for production
      let confirmationToken: string | null = null;
      let confirmationEmailSent = false;
      try {
        // Generate secure token
        confirmationToken = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

        // Store token in database
        const { error: tokenError } = await ctx.supabaseAdmin
          .from('email_verification_tokens')
          .insert({
            user_id: authData.user.id,
            token: confirmationToken,
            email: input.email,
            expires_at: expiresAt.toISOString(),
          });

        if (tokenError) {
          console.error('[Signup] Failed to store confirmation token:', tokenError);
          // Don't fail signup if token storage fails - log and continue
        } else {
          // Send confirmation email via Resend (production email service)
          const webUrl = ctx.webUrl || process.env.EXPO_PUBLIC_WEB_URL || 'https://homecookedplate.com';
          await sendEmailConfirmation(
            input.email,
            input.username,
            confirmationToken,
            webUrl
          );
          confirmationEmailSent = true;
          console.log('[Signup] Email confirmation sent via Resend');
        }
      } catch (emailError) {
        console.error('[Signup] Failed to send confirmation email:', emailError);
        confirmationEmailSent = false;
      }

      // Note: Welcome email is sent after email verification, not during signup

      // Prepare user object
      const user = {
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
        metroArea: profile.metro_area || null,
        trialEndsAt: profile.trial_ends_at ? new Date(profile.trial_ends_at) : null,
      };

      // The Resend link is what sets email_confirmed_at. Signup does not open a session.
      const session = null;

      // PlateTakers use the app free. Premium is optional.
      if ((input.role || 'platetaker') === 'platetaker') {
        return {
          status: 'SUCCESS' as const,
          user,
          session,
          metro: assignedMetro || 'Remote/Other',
          needsEmailConfirmation: true,
          confirmationEmailSent,
        };
      }

      // PlateMakers choose Early Bird or a paid plan before the kitchen opens.
      return {
        status: 'CHOOSE_MEMBERSHIP' as const,
        user,
        session,
        metro: assignedMetro || 'Remote/Other',
        earlyBirdEligible,
        trialDays: offeredTrialDays,
        needsEmailConfirmation: true,
        confirmationEmailSent,
      };
    });
};

// Export the procedure by calling the function to create a new instance
export const signupProcedure = createSignupProcedure();
