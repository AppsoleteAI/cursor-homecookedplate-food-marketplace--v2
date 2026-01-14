import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

const inputSchema = z.object({
  email: z.string().email(),
  businessName: z.string().optional(),
  country: z.string().default('US'),
});

export const createConnectAccountProcedure = publicProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const isLive = stripeSecretKey.startsWith('sk_live_');
    console.log(`[Stripe Connect] Creating ${isLive ? 'LIVE' : 'TEST'} connected account for ${input.email}`);

    const accountResponse = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        type: 'express',
        country: input.country,
        email: input.email,
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        ...(input.businessName ? { 'business_profile[name]': input.businessName } : {}),
      }).toString(),
    });

    if (!accountResponse.ok) {
      const error = await accountResponse.text();
      console.error('[Stripe Connect] Account creation failed:', error);
      throw new Error('Failed to create Stripe Connect account');
    }

    const account = await accountResponse.json();

    if (!ctx.userId) {
      throw new Error('User not authenticated');
    }

    const { error: updateError } = await ctx.supabase
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', ctx.userId)
      .select()
      .single();

    if (updateError) {
      console.error('[Stripe Connect] Failed to update profile:', updateError);
      throw new Error('Failed to save Stripe account ID');
    }

    const accountLinkResponse = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: account.id,
        refresh_url: 'platemate://stripe-onboarding-refresh',
        return_url: 'platemate://stripe-onboarding-complete',
        type: 'account_onboarding',
      }).toString(),
    });

    if (!accountLinkResponse.ok) {
      const error = await accountLinkResponse.text();
      console.error('[Stripe Connect] Account link creation failed:', error);
      throw new Error('Failed to create onboarding link');
    }

    const accountLink = await accountLinkResponse.json();

    console.log(`[Stripe Connect] Account created: ${account.id}`);

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  });
