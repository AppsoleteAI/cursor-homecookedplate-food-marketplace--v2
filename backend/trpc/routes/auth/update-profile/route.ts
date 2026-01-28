import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

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
      })
  )
  .mutation(async ({ input, ctx }) => {
    const updateData: Record<string, string | boolean> = {};
    
    if (input.username) updateData.username = input.username;
    if (input.email) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.profileImage !== undefined) updateData.profile_image = input.profileImage;
    if (input.foodSafetyAcknowledged !== undefined) updateData.food_safety_acknowledged = input.foodSafetyAcknowledged;

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
