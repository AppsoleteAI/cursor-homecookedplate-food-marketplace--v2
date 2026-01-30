// CODE VERSION: v4-insert-then-update-20250118 (forces module reload)
// #region agent log - MODULE LOAD: Verify new code is loaded
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:MODULE_LOAD',message:'NEW CODE v4 INSERT-THEN-UPDATE LOADED',data:{codeVersion:'v4-insert-then-update-20250118',timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'module-load',hypothesisId:'I'})}).catch(()=>{});
// #endregion
import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
// eslint-disable-next-line import/no-unresolved
import { sendEmailConfirmation } from "../../../lib/email";
// Use process.stdout.write directly for critical logs (bypasses Bun buffering)

// Force module reload by adding version to export
const SIGNUP_PROCEDURE_VERSION = `v4-insert-then-update-20250118-${Date.now()}`;

// #region agent log - PROCEDURE_EXPORT: Log when procedure is exported
console.log('[Signup Route] PROCEDURE_EXPORT - Version:', SIGNUP_PROCEDURE_VERSION);
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:PROCEDURE_EXPORT',message:'Signup procedure being exported',data:{version:SIGNUP_PROCEDURE_VERSION,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'module-export',hypothesisId:'I'})}).catch(()=>{});
// #endregion

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
        lat: z.number().optional(),
        lng: z.number().optional(),
        foodSafetyAcknowledged: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // #region agent log - MUTATION_ENTRY: Signup mutation handler entered
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:MUTATION_ENTRY',message:'NEW CODE v4 INSERT-THEN-UPDATE: Signup mutation handler entered',data:{email:input.email,username:input.username,codeVersion:SIGNUP_PROCEDURE_VERSION},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
      // #endregion

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
          email_confirm: true,
          user_metadata: { username: input.username }
        });
        authData = { user: result.data.user, session: null };
        authError = result.error;

        // #region agent log - ADMIN_CREATE_RESULT
        fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:ADMIN_CREATE_RESULT',message:'admin.createUser result',data:{hasError:!!result.error,hasUser:!!result.data?.user,errorMessage:result.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
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
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'An account with this email already exists. Please use login instead.',
          });
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: authError?.message || 'Failed to create account',
        });
      }

      console.log('[Signup] User created:', authData.user.id);

      // GEO-LOCK v4: Determine metro_area, trial_ends_at, and membership_tier
      // Inside metros: Check is_active (from metro_geofences) and "First 100" rule - grant trial_days early_bird trial ONLY if active AND under cap
      // Outside metros (Remote): Assign 'Remote/Other', no trial, set membership_tier to 'free' (must pay $4.99 to activate premium)
      // Source of Truth: All city-level settings (trial length, active status) MUST be read from metro_geofences table
      let assignedMetro: string | null = null;
      let trialEndDate: Date | null = null;
      let membershipTier: 'free' | 'premium' = 'free'; // Default to free

      if (input.lat && input.lng) {
        process.stdout.write(`[GEO_LOCK] Verifying location for user: ${input.username} at (${input.lat}, ${input.lng})\n`);
        
        // Consolidated RPC: Get metro settings by location (combines lookup + settings query)
        // Returns metro_name, is_active, and trial_days if metro found, otherwise returns no rows
        // Use ctx.supabaseAdmin (service role) for system operations during signup
        const { data: metroSettingsArray, error: metroError } = await ctx.supabaseAdmin.rpc(
          'get_metro_settings_by_location',
          { lat: input.lat, lng: input.lng }
        );

        // Check if metro was found (RPC returns array - empty if no metro found)
        const metro = metroSettingsArray && metroSettingsArray.length > 0 ? metroSettingsArray[0] : null;

        if (metroError || !metro) {
          // No metro found or error - assign Remote/Other
          if (metroError) {
            process.stdout.write(`[GEO_LOCK] Error fetching metro settings: ${metroError.message || JSON.stringify(metroError)}. Assigning Remote/Other\n`);
          } else {
            process.stdout.write(`[GEO_LOCK] No metro area found for coordinates (${input.lat}, ${input.lng}). Assigning Remote/Other\n`);
          }
          assignedMetro = 'Remote/Other';
          membershipTier = 'free';
          process.stdout.write(`[GEO_LOCK] Remote User. Redirecting to $4.99 subscription. membership_tier: ${membershipTier}\n`);
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

          if (status === 'SUCCESS') {
            // SUCCESS: Spot locked. Grant trial using trial_days from metro (source of truth)
            // USE DYNAMIC TRIAL DAYS from DB - never override with hardcoded values
            const trialDays = metro.trial_days ?? 90; // Null coalescing only for safety (shouldn't happen due to NOT NULL constraint)
            trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + trialDays);
            membershipTier = 'premium';
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. SUCCESS. Granting ${trialDays}-day trial (from metro_geofences.trial_days). membership_tier: ${membershipTier}\n`);
          } else {
            // CAP_REACHED: Metro full - user will be redirected to paid Stripe checkout
            membershipTier = 'free';
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. CAP_REACHED. Redirecting to paid checkout. membership_tier: ${membershipTier}\n`);
          }
        }
      } else {
        // No coordinates provided: Assign Remote/Other (no trial, free tier)
        process.stdout.write(`[GEO_LOCK] No coordinates provided. Assigning Remote/Other\n`);
        assignedMetro = 'Remote/Other';
        membershipTier = 'free';
        process.stdout.write(`[GEO_LOCK] Remote User. Redirecting to $4.99 subscription. membership_tier: ${membershipTier}\n`);
      }

      // V4 PATTERN: INSERT-then-UPDATE (Catch 23505)
      // The Supabase profile trigger creates a record instantly. We MUST catch the unique constraint
      // error and perform an UPDATE to finalize metro_area and trial_ends_at fields.
      // #region agent log - BEFORE_PROFILE_CREATE_OR_UPDATE
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:BEFORE_PROFILE_CREATE_OR_UPDATE',message:'About to create/update profile (handles trigger race condition)',data:{userId:authData.user.id,username:input.username,email:input.email,metroArea:assignedMetro,trialEndsAt:trialEndDate?.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
      // #endregion

      // Prepare profile data with finalized metro_area, trial_ends_at, and membership_tier
      const profileData = {
        id: authData.user.id,
        username: input.username,
        email: input.email,
        role: input.role as 'platemaker' | 'platetaker',
        metro_area: assignedMetro, // Always set: matched metro or 'Remote/Other'
        trial_ends_at: trialEndDate?.toISOString() || null, // Only set for active metros with available slots (trial_days from metro_geofences), null otherwise
        membership_tier: membershipTier, // 'premium' for metro with available trial slot, 'free' otherwise
        food_safety_acknowledged: input.role === 'platemaker' ? (input.foodSafetyAcknowledged || false) : false, // Only set for platemakers
      };

      process.stdout.write(`[SIGNUP_V4] Attempting INSERT with metro_area=${assignedMetro}, trial_ends_at=${trialEndDate?.toISOString() || 'null'}, membership_tier=${membershipTier}\n`);

      // Try insert first
      // Use ctx.supabaseAdmin (service role) for profile creation during signup (system operation)
      let { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      // If insert fails with duplicate key (23505), trigger already created profile - UPDATE to finalize
      if (profileError?.code === '23505') {
        // #region agent log - PROFILE_EXISTS_UPDATE
        fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:PROFILE_EXISTS_UPDATE',message:'Profile exists (trigger created it), updating with finalized metro_area and trial_ends_at',data:{userId:authData.user.id,metroArea:assignedMetro,trialEndsAt:trialEndDate?.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
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

      // #region agent log - AFTER_PROFILE_CREATE_OR_UPDATE
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:AFTER_PROFILE_CREATE_OR_UPDATE',message:'Profile create/update completed',data:{hasProfile:!!profile,hasError:!!profileError,errorCode:profileError?.code,errorMessage:profileError?.message?.substring(0,100),profileId:profile?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
      // #endregion

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

      // #region agent log - SIGNUP_SUCCESS
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:SIGNUP_SUCCESS',message:'Signup completed successfully',data:{profileId:profile.id,userId:authData.user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      console.log('[Signup] Profile created successfully with admin client');

      // Generate email confirmation token and send via Resend (production email service)
      // CRITICAL: Supabase emails are rate-limited and not suitable for production
      let confirmationToken: string | null = null;
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
          console.log('[Signup] Email confirmation sent via Resend');
        }
      } catch (emailError) {
        console.error('[Signup] Failed to send confirmation email:', emailError);
        // Don't fail signup if email sending fails - log and continue
        // User can request a new confirmation email later
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

      // Determine status and return appropriate structure
      // Case 1: SUCCESS - Metro active and under cap (trial granted)
      if (membershipTier === 'premium' && trialEndDate) {
        return {
          status: 'SUCCESS' as const,
          user,
          session: authData.session,
          metro: assignedMetro || 'Remote/Other',
          trialEndsAt: trialEndDate.toISOString(),
          needsEmailConfirmation: true, // Always true when using custom email flow
        };
      }

      // Case 2: REDIRECT_TO_PAYMENT - Metro cap reached or Remote/Other
      return {
        status: 'REDIRECT_TO_PAYMENT' as const,
        user,
        session: authData.session,
        metro: assignedMetro || 'Remote/Other',
        needsEmailConfirmation: true, // Always true when using custom email flow
      };
    });
};

// Export the procedure by calling the function to create a new instance
export const signupProcedure = createSignupProcedure();
