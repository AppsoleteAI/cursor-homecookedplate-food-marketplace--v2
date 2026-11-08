import { sessionProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SAVED_PROFILE_COLUMNS } from "../../../../lib/profile-columns";
import { auditTextField } from "../../../../lib/text-audit";
import { accountAllowsSignIn, LEGAL_SAVE_FAILED_MESSAGE, LEGAL_SIGN_IN_MESSAGE, legalSafetyAgreementSchema, submittedAgreementAllows } from "../../../../lib/legal-gate";

/**
 * Update Profile Procedure
 * 
 * SECURITY: The 'is_admin' field is protected by RLS policy "update_own_profile"
 * which automatically rejects any update where is_admin differs from the stored value.
 * Users cannot escalate their own privileges.
 * 
 * Corresponds to SQL Section 3 in security_enhancements.sql
 */
export const updateProfileProcedure = sessionProcedure
  .input(
      z.object({
        username: z.string().min(3).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
        profileImage: z.string().optional(),
        businessName: z.string().max(80).optional(),
        foodSafetyAcknowledged: z.boolean().optional(),
        legalSafetyAgreement: legalSafetyAgreementSchema.nullable().optional(),
      })
  )
  .mutation(async ({ input, ctx }) => {
    const existing = await ctx.supabaseAdmin
      .from('profiles')
      .select('legal_safety_agreement, created_at')
      .eq('id', ctx.userId)
      .maybeSingle();
    const createdAt = new Date(existing.data?.created_at ?? '');
    const allowed = accountAllowsSignIn(existing.data?.legal_safety_agreement, createdAt);
    const keys = (Object.keys(input) as (keyof typeof input)[]).filter((key) => input[key] !== undefined);
    const legalOnly = keys.length === 1 && keys[0] === 'legalSafetyAgreement';
    if (!allowed && !legalOnly) {
      throw new TRPCError({ code: 'FORBIDDEN', message: LEGAL_SIGN_IN_MESSAGE });
    }
    if (input.legalSafetyAgreement && !submittedAgreementAllows(input.legalSafetyAgreement, createdAt)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: LEGAL_SIGN_IN_MESSAGE });
    }

    const updateData: Record<string, string | boolean | object | null> = {};

    if (input.username) {
      const r = await auditTextField(ctx.supabaseAdmin, ctx.userId, 'username', input.username);
      if (r.blocked) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Username contains disallowed content.' });
      }
      updateData.username = r.value;
    }

    if (input.email) {
      const authEmail = await ctx.supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
        email: input.email,
        email_confirm: true,
      });
      if (authEmail.error) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'The sign-in email could not be changed. Profile email was left as it was.',
        });
      }
      updateData.email = input.email;
    }
    if (input.phone !== undefined) {
      const phone = await auditTextField(ctx.supabaseAdmin, ctx.userId, 'phone', input.phone);
      if (phone.blocked) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That phone number cannot be saved.' });
      }
      updateData.phone = phone.value;
    }

    if (input.bio !== undefined) {
      const r = await auditTextField(ctx.supabaseAdmin, ctx.userId, 'bio', input.bio);
      if (r.blocked) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bio contains disallowed content.' });
      }
      updateData.bio = r.value;
    }

    if (input.profileImage !== undefined) {
      const trimmed = input.profileImage.trim();
      const uploadedHere = `/storage/v1/object/public/profile-images/${ctx.userId}/`;
      if (trimmed !== '' && !(trimmed.startsWith('https://') && trimmed.includes(uploadedHere))) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Profile photo must be a picture taken with the camera in the app.',
        });
      }
      updateData.profile_image = trimmed;
    }

    if (input.businessName !== undefined) {
      const role = await ctx.supabaseAdmin.from('profiles').select('role').eq('id', ctx.userId).maybeSingle();
      if (role.data?.role === 'platemaker') {
        const business = await auditTextField(ctx.supabaseAdmin, ctx.userId, 'business_name', input.businessName);
        if (business.blocked) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'That business name cannot be saved.' });
        }
        updateData.business_name = business.value.trim() || null;
      }
    }

    if (input.foodSafetyAcknowledged !== undefined) updateData.food_safety_acknowledged = input.foodSafetyAcknowledged;
    if (input.legalSafetyAgreement !== undefined) updateData.legal_safety_agreement = input.legalSafetyAgreement;

    const { data: profileRaw, error } = await ctx.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', ctx.userId)
      .select(SAVED_PROFILE_COLUMNS)
      .single();
    const profile = profileRaw as any;

    if (error || !profile) {
      throw new Error(error?.message || 'Failed to update profile');
    }

    if (input.legalSafetyAgreement && !accountAllowsSignIn(profile.legal_safety_agreement, createdAt)) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: LEGAL_SAVE_FAILED_MESSAGE });
    }

    return {
      id: profile.id,
      username: profile.username,
      businessName: typeof profile.business_name === 'string' ? profile.business_name : '',
      email: profile.email,
      role: profile.role as 'platemaker' | 'platetaker',
      phone: profile.phone,
      bio: profile.bio,
      profileImage: profile.profile_image,
      createdAt: new Date(profile.created_at),
      isPaused: profile.is_paused,
      twoFactorEnabled: profile.two_factor_enabled,
      foodSafetyAcknowledged: profile.food_safety_acknowledged || false,
    };
  });
