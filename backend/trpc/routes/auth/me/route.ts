import { readAdminRole } from "../../../../lib/admin-role";
import { earlyBirdCoversThisMetro, readEarlyBirdClaim } from "../../../../lib/early-bird-claim";
import { platemakerMayEnter, platemakerTrialCountdownDays, trialCloseoutKeepsKitchen, unpaidPlatemakerTrialEnded } from "../../../../lib/trial-access";
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

    const trialExpired = unpaidPlatemakerTrialEnded(profile);
    let membershipTier = (profile.membership_tier as 'free' | 'premium') || 'free';
    if (trialExpired && profile.membership_tier === 'premium') {
      const { error: expireError } = await ctx.supabaseAdmin
        .from('profiles')
        .update({ membership_tier: 'free' })
        .eq('id', profile.id)
        .eq('role', 'platemaker');
      if (expireError) {
        console.error('[auth.me] Could not end PlateMaker trial:', expireError.message);
      }
      membershipTier = 'free';
    }

    const claimMetro = await readEarlyBirdClaim(ctx.supabaseAdmin, profile.id);
    const openOrders = await ctx.supabaseAdmin
      .from('orders')
      .select('id')
      .eq('seller_id', profile.id)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .limit(1);
    const hasOpenOrder = Boolean(openOrders.error) || (openOrders.data || []).length > 0;
    const trialApplies = earlyBirdCoversThisMetro(claimMetro, profile.metro_area, hasOpenOrder);
    const closeoutOrders = await ctx.supabaseAdmin
      .from('orders')
      .select('id')
      .eq('seller_id', profile.id)
      .eq('paid', true)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .limit(1);
    const keepKitchen = trialCloseoutKeepsKitchen(
      trialExpired,
      !closeoutOrders.error && (closeoutOrders.data || []).length > 0,
    );

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      role: profile.role as 'platemaker' | 'platetaker',
      isAdmin: profile.is_admin || false,
      adminRole: readAdminRole(profile),
      phone: profile.phone,
      bio: profile.bio,
      profileImage: profile.profile_image,
      createdAt: new Date(profile.created_at),
      isPaused: profile.is_paused,
      twoFactorEnabled: profile.two_factor_enabled,
      membershipTier,
      needsMembership: profile.role === 'platemaker'
        && !keepKitchen
        && !platemakerMayEnter({ ...profile, membership_tier: membershipTier }, new Date(), trialApplies),
      closeoutKeepsKitchen: keepKitchen,
      trialExpired,
      trialCountdownDays: platemakerTrialCountdownDays(profile),
      stripeCustomerId: profile.stripe_customer_id || undefined,
      stripeSubscriptionId: profile.stripe_subscription_id || undefined,
      metroArea: profile.metro_area || null,
      earlyBirdClaimMetro: claimMetro,
      trialEndsAt: profile.trial_ends_at ? new Date(profile.trial_ends_at) : null,
      foodSafetyAcknowledged: profile.food_safety_acknowledged || false,
      legalSafetyAgreement: profile.legal_safety_agreement ?? null,
      orderingRemoved: profile.ordering_removed === true,
    };
  });
