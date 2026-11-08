import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { recordOperationalFailure } from '../../../../lib/failure-alert';
import { claimStripeIdentity } from '../../../../lib/account-identifier';
import { createAccountLink, expressAccountFields } from '../../../../lib/connect-account';

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
        body: expressAccountFields({ email: profile.email, businessName }).toString(),
      });

      if (!accountResponse.ok) {
        const error = await accountResponse.text();
        console.error('[Stripe Connect] Account creation failed:', error);
        await recordOperationalFailure('payment_error', 'Stripe Connect account creation failed.', ctx.supabaseAdmin);
        throw new Error('Failed to create Stripe Connect account');
      }

      const created = await accountResponse.json();
      const claim = await claimStripeIdentity(ctx.supabaseAdmin, {
        stripeId: created.id,
        kind: 'connect_account',
        profileId: ctx.userId,
      });
      if (!claim.ok) {
        throw new Error('This Stripe account cannot be used on this HomeCookedPlate account.');
      }
      accountId = claim.stripeId;

      const { error: updateError } = await ctx.supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId, stripe_payouts_enabled: false })
        .eq('id', ctx.userId)
        .select('id')
        .single();

      if (updateError) {
        console.error('[Stripe Connect] Failed to update profile:', updateError);
        throw new Error('Failed to save Stripe account ID');
      }
    }

    if (!accountId) {
      throw new Error('Stripe account ID missing after connect setup');
    }

    const accountLink = await createAccountLink(stripeSecretKey, accountId);
    if (!accountLink.ok) {
      console.error('[Stripe Connect] Account link creation failed:', accountLink.error);
      throw new Error('Failed to create onboarding link');
    }

    console.log('[Stripe Connect] Onboarding link created');

    return {
      accountId,
      onboardingUrl: accountLink.url,
    };
  });
