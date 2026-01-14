import { publicProcedure } from '../../../create-context';

export const getConnectAccountStatusProcedure = publicProcedure
  .query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new Error('User not authenticated');
    }

    const { data: profile, error } = await ctx.supabase
      .from('profiles')
      .select('stripe_account_id, role')
      .eq('id', ctx.userId)
      .single();

    if (error || !profile) {
      throw new Error('Profile not found');
    }

    if (profile.role !== 'platemaker') {
      return {
        needsOnboarding: false,
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    if (!profile.stripe_account_id) {
      return {
        needsOnboarding: true,
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const accountResponse = await fetch(
      `https://api.stripe.com/v1/accounts/${profile.stripe_account_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!accountResponse.ok) {
      const error = await accountResponse.text();
      console.error('[Stripe Connect] Failed to retrieve account:', error);
      throw new Error('Failed to retrieve account status');
    }

    const account = await accountResponse.json();

    return {
      needsOnboarding: !account.details_submitted,
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  });
