import { protectedProcedure } from "../../../create-context";

export const meProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const { data: profile, error } = await ctx.supabase
      .from('profiles')
      .select('*')
      .eq('id', ctx.userId)
      .single();

    if (error || !profile) {
      throw new Error('Profile not found');
    }

    return {
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
      membershipTier: (profile.membership_tier as 'free' | 'premium') || 'free',
      stripeCustomerId: profile.stripe_customer_id || undefined,
      stripeSubscriptionId: profile.stripe_subscription_id || undefined,
      metro_area: profile.metro_area || null,
      trial_ends_at: profile.trial_ends_at ? new Date(profile.trial_ends_at) : null,
    };
  });
