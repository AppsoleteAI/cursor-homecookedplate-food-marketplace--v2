import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { sendEmailConfirmation } from "@/backend/lib/email";
import { readAuthIdentityKind, signupAlreadyRegisteredMessage } from "@/backend/lib/provider-profile";
import { saveKitchenPin } from "../../../../lib/kitchen-pin";
import { abandonFailedSignup, isDuplicateAuthError, planSignupMetro } from "../../../../lib/signup-account";
// Strict password validation schema - matches frontend PasswordStrengthMeter requirements
// Export for reuse in other routes (e.g., password reset, password change)
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

export const signupProcedure = publicProcedure
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

      // Metro is decided before any auth user exists. A paused city stops here.
      const plan = await planSignupMetro(ctx.supabaseAdmin, input.lat, input.lng);
      if (plan.pausedMessage) {
        process.stdout.write(`[GEO_LOCK] ${plan.pausedMessage} No auth user was created.\n`);
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: plan.pausedMessage,
        });
      }

      // Use admin.createUser() - requires Service Role Key.
      // A duplicate email is refused without checking the password or opening a session.
      let authData: { user: { id: string } | null };
      let authError: { message?: string; status?: number; code?: string | number } | null;

      try {
        const result = await ctx.supabaseAdmin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: false,
          user_metadata: { username: input.username, role: input.role }
        });
        authData = { user: result.data.user };
        authError = result.error;

      } catch (error: any) {
        authError = error;
        authData = { user: null };
      }

      if (authError || !authData.user) {
        console.error('[Signup] Auth error:', authError);
        if (isDuplicateAuthError(authError)) {
          const { data: registeredProfile } = await ctx.supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('email', input.email)
            .maybeSingle();
          const identity = await readAuthIdentityKind(ctx.supabaseAdmin, input.email);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: signupAlreadyRegisteredMessage({
              profileExists: Boolean(registeredProfile),
              passwordAccepted: false,
              identity,
            }) || 'An account with this email already exists. Please use login instead.',
          });
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: authError?.message || 'Failed to create account',
        });
      }

      const createdUserId = authData.user.id;
      console.log('[Signup] User created:', createdUserId);

      const role = (input.role || 'platetaker') as 'platemaker' | 'platetaker';
      const assignedMetro = plan.assignedMetro;
      const trialEndsAt: string | null = null;
      const membershipTier: 'free' | 'premium' = 'free';
      let earlyBirdEligible = false;
      let offeredTrialDays = 0;
      let slot: { role: string; metro: string } | null = null;
      let committed = false;

      try {
      if (plan.holdSlot) {
        process.stdout.write(`[GEO_LOCK] Verifying location for user: ${input.username}. Metro ${assignedMetro}.\n`);
        const { data: status, error: incrementError } = await ctx.supabaseAdmin.rpc(
          'increment_metro_count',
          {
            metro_name_param: assignedMetro,
            user_role: role,
          }
        );

        if (incrementError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to secure metro spot: ${incrementError.message || JSON.stringify(incrementError)}`,
          });
        }

        if (status === 'SUCCESS' && role === 'platemaker') {
          slot = { role, metro: assignedMetro };
          offeredTrialDays = plan.trialDays || 90;
          earlyBirdEligible = true;
          process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. Early Bird is open for ${offeredTrialDays} days. It is not started until the PlateMaker chooses it.\n`);
        } else if (status === 'SUCCESS') {
          slot = { role, metro: assignedMetro };
          process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. PlateTaker signup. Premium stays optional.\n`);
        } else {
          process.stdout.write(`[GEO_LOCK] Metro Match: ${assignedMetro}. CAP_REACHED. PlateMaker chooses a paid plan. Early Bird is not available.\n`);
        }
      } else {
        process.stdout.write(`[GEO_LOCK] Assigning ${assignedMetro}. No metro slot is taken.\n`);
      }

      // V4 PATTERN: INSERT-then-UPDATE (Catch 23505)
      // The Supabase profile trigger creates a record instantly. We MUST catch the unique constraint
      // error and perform an UPDATE to finalize metro_area and trial_ends_at fields.

      // Prepare profile data with finalized metro_area, trial_ends_at, and membership_tier
      const profileData = {
        id: createdUserId,
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
          .eq('id', createdUserId)
          .select()
          .single();
        profile = updateResult.data;
        profileError = updateResult.error;
        process.stdout.write(`[SIGNUP_V4] UPDATE completed. metro_area=${profile?.metro_area}, trial_ends_at=${profile?.trial_ends_at || 'null'}, membership_tier=${profile?.membership_tier}\n`);
      }


      if (profileError || !profile) {
        console.error('[Signup] Profile upsert failed:', profileError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create profile: ${profileError?.message || 'Unknown error'}`,
        });
      }

      committed = true;
      console.log('[Signup] Profile created successfully with admin client');
      if (typeof input.lat === 'number' && typeof input.lng === 'number') {
        try {
          await saveKitchenPin(ctx.supabaseAdmin, createdUserId, input.lat, input.lng);
        } catch (pinError) {
          console.error('[Signup] Kitchen pin was not saved:', pinError);
        }
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
            user_id: createdUserId,
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
      } catch (error) {
        if (!committed) {
          await abandonFailedSignup(ctx.supabaseAdmin, createdUserId, slot);
        }
        throw error;
      }
    });
