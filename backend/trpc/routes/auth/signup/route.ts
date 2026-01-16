// CODE VERSION: v4-insert-then-update-20250118 (forces module reload)
// #region agent log - MODULE LOAD: Verify new code is loaded
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:MODULE_LOAD',message:'NEW CODE v4 INSERT-THEN-UPDATE LOADED',data:{codeVersion:'v4-insert-then-update-20250118',timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'module-load',hypothesisId:'I'})}).catch(()=>{});
// #endregion
import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "../../../../lib/supabase";
import { TRPCError } from "@trpc/server";
// Use process.stdout.write directly for critical logs (bypasses Bun buffering)

async function sendWelcomeEmail(email: string, username: string) {
  try {
    console.log(`[Signup] Welcome email would be sent to ${email} for ${username}`);
  } catch (error) {
    console.error('[Signup] Failed to send welcome email:', error);
  }
}

// Force module reload by adding version to export
const SIGNUP_PROCEDURE_VERSION = `v4-insert-then-update-20250118-${Date.now()}`;

// #region agent log - PROCEDURE_EXPORT: Log when procedure is exported
console.log('[Signup Route] PROCEDURE_EXPORT - Version:', SIGNUP_PROCEDURE_VERSION);
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:PROCEDURE_EXPORT',message:'Signup procedure being exported',data:{version:SIGNUP_PROCEDURE_VERSION,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'module-export',hypothesisId:'I'})}).catch(()=>{});
// #endregion

// Create procedure with runtime version check
const createSignupProcedure = () => {
  console.log('[Signup Route] Creating signup procedure with version:', SIGNUP_PROCEDURE_VERSION);
  return publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['platemaker', 'platetaker']).optional().default('platetaker'),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // #region agent log - MUTATION_ENTRY: Signup mutation handler entered
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/routes/auth/signup/route.ts:MUTATION_ENTRY',message:'NEW CODE v4 INSERT-THEN-UPDATE: Signup mutation handler entered',data:{email:input.email,username:input.username,codeVersion:SIGNUP_PROCEDURE_VERSION},timestamp:Date.now(),sessionId:'debug-session',runId:'signup-attempt',hypothesisId:'I'})}).catch(()=>{});
      // #endregion

      console.log('[Signup] Starting signup for:', input.email);

      // Use admin.createUser() - correct method for Service Role Key
      let authData: any;
      let authError: any;

      try {
        const result = await supabaseAdmin.auth.admin.createUser({
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
        
        const { data: metroName, error: geoError } = await supabaseAdmin.rpc(
          'find_metro_by_location',
          { lng: input.lng, lat: input.lat }
        );

        if (!geoError && metroName) {
          // Path A: Inside Metro - CRITICAL: Check is_active BEFORE allowing signup
          assignedMetro = metroName;
          
          // CRITICAL: Read city-level settings from metro_geofences table (source of truth)
          // MUST check is_active before allowing signup in a metro
          // Do not hardcode trial length - always use metro_geofences.trial_days
          const { data: metroSettings, error: settingsError } = await supabaseAdmin
            .from('metro_geofences')
            .select('is_active, trial_days')
            .eq('metro_name', metroName)
            .single();

          if (settingsError || !metroSettings) {
            process.stdout.write(`[GEO_LOCK] Error fetching metro settings for ${metroName}: ${settingsError?.message || 'Not found'}. Blocking signup.\n`);
            // If metro not found in geofences or error, block signup (treat as inactive)
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Metro area "${metroName}" is not currently accepting new signups. Please contact support if you believe this is an error.`,
            });
          }

          if (!metroSettings.is_active) {
            // Metro is inactive - BLOCK signup entirely
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. Metro is inactive (is_active=false). Blocking signup.\n`);
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Metro area "${metroName}" is not currently accepting new signups. Please contact support if you believe this is an error.`,
            });
          }

          // Metro is active - proceed with signup and check cap
          // Metro is active - check cap using increment_metro_count RPC to atomically check and lock trial spot
          // RPC returns integer (new count after increment) - interpret as boolean:
          // - If newCount <= 100: Spot available (true) - grant premium + trial_days trial
          // - If newCount > 100: Over cap (false) - set free tier, no trial
          const { data: newCount, error: incrementError } = await supabaseAdmin.rpc(
            'increment_metro_count',
            {
              area: metroName, // Note: RPC uses 'area' parameter name
              user_role: input.role || 'platetaker' // Note: RPC uses 'user_role' parameter name
            }
          );

          // Interpret count as boolean: hasSpot = newCount <= 100
          const hasSpot = !incrementError && newCount !== null && (newCount as number) <= 100;

          if (hasSpot) {
            // SUCCESS: Spot locked. Grant trial using trial_days from metro_geofences (source of truth)
            const trialDays = metroSettings.trial_days || 90; // Fallback to 90 if null
            trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + trialDays);
            membershipTier = 'premium';
            process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. Spot available (count: ${newCount}/100). Granting ${trialDays}-day trial (from metro_geofences.trial_days). membership_tier: ${membershipTier}\n`);
          } else {
            // METRO FULL: Route to paid path
            membershipTier = 'free';
            if (incrementError) {
              process.stdout.write(`[GEO_LOCK] increment_metro_count RPC error: ${incrementError.message || JSON.stringify(incrementError)}\n`);
            } else {
              process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. Over cap (count: ${newCount}/100). No trial. membership_tier: ${membershipTier}\n`);
            }
          } else if (geoError) {
          process.stdout.write(`[GEO_LOCK] PostGIS RPC error: ${geoError.message || JSON.stringify(geoError)}\n`);
          // On error, assign Remote/Other (no trial, free tier)
          assignedMetro = 'Remote/Other';
          membershipTier = 'free';
          process.stdout.write(`[GEO_LOCK] Remote User. Redirecting to $4.99 subscription. membership_tier: ${membershipTier}\n`);
        } else {
          // Path B: Remote/Underserved - No trial, start as free (must pay $4.99 to activate premium)
          process.stdout.write(`[GEO_LOCK] No metro area found for coordinates (${input.lat}, ${input.lng}). Assigning Remote/Other\n`);
          assignedMetro = 'Remote/Other';
          membershipTier = 'free';
          process.stdout.write(`[GEO_LOCK] Remote User. Redirecting to $4.99 subscription. membership_tier: ${membershipTier}\n`);
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
      };

      process.stdout.write(`[SIGNUP_V4] Attempting INSERT with metro_area=${assignedMetro}, trial_ends_at=${trialEndDate?.toISOString() || 'null'}, membership_tier=${membershipTier}\n`);

      // Try insert first
      let { data: profile, error: profileError } = await supabaseAdmin
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
        const updateResult = await supabaseAdmin
          .from('profiles')
          .update({
            // Update all fields to ensure metro_area, trial_ends_at, and membership_tier are finalized
            username: profileData.username,
            email: profileData.email,
            role: profileData.role,
            metro_area: profileData.metro_area, // CRITICAL: Finalize metro_area (matched metro or 'Remote/Other')
            trial_ends_at: profileData.trial_ends_at, // CRITICAL: Finalize trial_ends_at (90 days for metros, null for Remote/Other)
            membership_tier: profileData.membership_tier, // CRITICAL: Finalize membership_tier ('premium' for metro, 'free' for remote)
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
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
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
          metro_area: profile.metro_area || null,
          trial_ends_at: profile.trial_ends_at ? new Date(profile.trial_ends_at) : null,
        },
        session: authData.session,
      };
    });
};

// Export the procedure by calling the function to create a new instance
export const signupProcedure = createSignupProcedure();
