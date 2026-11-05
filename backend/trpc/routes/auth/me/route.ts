import { readAdminRole } from "../../../../lib/admin-role";
import { earlyBirdCoversThisMetro, readEarlyBirdClaim } from "../../../../lib/early-bird-claim";
import { refreshAppleMembership, refreshGoogleMembership, refreshStripeMembership, writeResolvedTier } from "../../../../lib/store-membership";
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

    let current = profile;
    current = await refreshStripeMembership(ctx.supabaseAdmin, current, ctx.stripeSecretKey);
    current = await refreshAppleMembership(ctx.supabaseAdmin, current, ctx.appleApi);
    current = await refreshGoogleMembership(ctx.supabaseAdmin, current, ctx.googlePlayServiceAccountJson);
    const membershipTier = await writeResolvedTier(ctx.supabaseAdmin, current);
    const trialExpired = unpaidPlatemakerTrialEnded({ ...current, membership_tier: membershipTier });

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
      businessName: typeof profile.business_name === 'string' ? profile.business_name : '',
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
        && !platemakerMayEnter({ ...current, membership_tier: membershipTier }, new Date(), trialApplies),
      closeoutKeepsKitchen: keepKitchen,
      trialExpired,
      trialCountdownDays: platemakerTrialCountdownDays({ ...current, membership_tier: membershipTier }),
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
