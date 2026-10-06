import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sanitizeTextField } from "../../../../lib/text-security";

/**
 * Update Profile Procedure
 * 
 * SECURITY: The 'is_admin' field is protected by RLS policy "update_own_profile"
 * which automatically rejects any update where is_admin differs from the stored value.
 * Users cannot escalate their own privileges.
 * 
 * Corresponds to SQL Section 3 in security_enhancements.sql
 */
export const updateProfileProcedure = protectedProcedure
  .input(
      z.object({
        username: z.string().min(3).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
        profileImage: z.string().optional(),
        foodSafetyAcknowledged: z.boolean().optional(),
        legalSafetyAgreement: z.object({
          sections: z.object({
            jurisdictional_law: z.literal(true),
            delivery_safety: z.literal(true),
            liability_waiver: z.literal(true),
            legal_safety_financial: z.literal(true),
            allergy_food_safety: z.literal(true),
            fee_structure: z.literal(true),
            account_termination: z.literal(true),
          }),
          acknowledgedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          acknowledgedAt: z.string().min(10),
        }).optional(),
      })
  )
  .mutation(async ({ input, ctx }) => {
    const updateData: Record<string, string | boolean | object> = {};

    if (input.username) {
      const r = sanitizeTextField(input.username);
      if (r.blocked) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Username contains disallowed content.' });
      }
      updateData.username = r.value;
    }

    if (input.email) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;

    if (input.bio !== undefined) {
      const r = sanitizeTextField(input.bio);
      if (r.blocked) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bio contains disallowed content.' });
      }
      updateData.bio = r.value;
    }

    if (input.profileImage !== undefined) {
      // Only accept HTTPS URLs or empty string — reject local file:// URIs and data: URLs
      // which would be device-local and inaccessible to other users.
      const trimmed = input.profileImage.trim();
      if (trimmed !== '' && !trimmed.startsWith('https://')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Profile image must be an uploaded HTTPS URL. Use media.uploadProfile to upload the image first.',
        });
      }
      updateData.profile_image = trimmed;
    }

    if (input.foodSafetyAcknowledged !== undefined) updateData.food_safety_acknowledged = input.foodSafetyAcknowledged;
    if (input.legalSafetyAgreement) updateData.legal_safety_agreement = input.legalSafetyAgreement;

    const { data: profile, error } = await ctx.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', ctx.userId)
      .select()
      .single();

    if (error || !profile) {
      throw new Error(error?.message || 'Failed to update profile');
    }

    return {
      id: profile.id,
      username: profile.username,
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
