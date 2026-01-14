import { protectedProcedure } from "../../../create-context";

/**
 * Request to upgrade from platetaker to platemaker role.
 * 
 * SECURITY NOTE: For production with admin approval workflow:
 * 1. Add a 'role_upgrade_status' field to profiles table: 
 *    ALTER TABLE profiles ADD COLUMN role_upgrade_status text CHECK (role_upgrade_status IN ('none', 'pending', 'approved', 'rejected'));
 * 2. Instead of directly updating role, set role_upgrade_status = 'pending'
 * 3. Create an admin endpoint to approve/reject requests
 * 4. Only update role when status = 'approved'
 * 
 * For MVP: Direct upgrade is implemented for faster development.
 */
export const requestPlatemakerRoleProcedure = protectedProcedure
  .mutation(async ({ ctx }) => {
    // Get current user profile
    const { data: currentProfile, error: fetchError } = await ctx.supabase
      .from('profiles')
      .select('role, id')
      .eq('id', ctx.userId)
      .single();

    if (fetchError || !currentProfile) {
      throw new Error('Failed to fetch user profile');
    }

    // Check if user is already a platemaker
    if (currentProfile.role === 'platemaker') {
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('*')
        .eq('id', ctx.userId)
        .single();

      if (!profile) {
        throw new Error('Failed to fetch profile');
      }

      return {
        success: true,
        message: 'You are already a PlateMaker',
        role: 'platemaker' as const,
        requiresApproval: false,
        user: {
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
        },
      };
    }

    // Update role in profiles table
    // PRODUCTION: Set role_upgrade_status = 'pending' instead of directly updating role
    const { data: updatedProfile, error: updateError } = await ctx.supabase
      .from('profiles')
      .update({ 
        role: 'platemaker',
        updated_at: new Date().toISOString(),
        // PRODUCTION: Add this instead:
        // role_upgrade_status: 'pending',
      })
      .eq('id', ctx.userId)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      throw new Error(updateError?.message || 'Failed to update role. Please contact support.');
    }

    return {
      success: true,
      message: 'Role upgraded successfully. You can now create meals!',
      role: updatedProfile.role as 'platemaker' | 'platetaker',
      requiresApproval: false, // Set to true when approval workflow is implemented
      user: {
        id: updatedProfile.id,
        username: updatedProfile.username,
        email: updatedProfile.email,
        role: updatedProfile.role as 'platemaker' | 'platetaker',
        phone: updatedProfile.phone,
        bio: updatedProfile.bio,
        profileImage: updatedProfile.profile_image,
        createdAt: new Date(updatedProfile.created_at),
        isPaused: updatedProfile.is_paused,
        twoFactorEnabled: updatedProfile.two_factor_enabled,
      },
    };
  });
