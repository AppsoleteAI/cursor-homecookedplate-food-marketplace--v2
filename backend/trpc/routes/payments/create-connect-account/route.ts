import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';

const inputSchema = z.object({
  email: z.string().email(),
  businessName: z.string().optional(),
  country: z.string().default('US'),
});

export const createConnectAccountProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('email, role, stripe_account_id, business_name')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Profile not found' });
    }

    if (profile.role !== 'platemaker') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only platemakers can connect payouts',
      });
    }

    let accountId = profile.stripe_account_id as string | null;

    if (!accountId) {
      const isLive = stripeSecretKey.startsWith('sk_live_');
      console.log(`[Stripe Connect] Creating ${isLive ? 'LIVE' : 'TEST'} connected account`);

      const businessName = profile.business_name || input.businessName;
      const accountResponse = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'express',
          country: input.country,
          email: profile.email,
          'capabilities[card_payments][requested]': 'true',
          'capabilities[transfers][requested]': 'true',
          ...(businessName ? { 'business_profile[name]': businessName } : {}),
        }).toString(),
      });

      if (!accountResponse.ok) {
        const error = await accountResponse.text();
        console.error('[Stripe Connect] Account creation failed:', error);
        throw new Error('Failed to create Stripe Connect account');
      }

      const created = await accountResponse.json();
      accountId = created.id;

      const { error: updateError } = await ctx.supabase
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', ctx.userId)
        .select()
        .single();

      if (updateError) {
        console.error('[Stripe Connect] Failed to update profile:', updateError);
        throw new Error('Failed to save Stripe account ID');
      }
    }

    if (!accountId) {
      throw new Error('Stripe account ID missing after connect setup');
    }

    const account = { id: accountId };

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
