import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

const inputSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().default('usd'),
  orderIds: z.array(z.string()).optional(),
  sellerId: z.string(),
  platformFeePercent: z.number().min(0).max(100).default(10),
});

export const createPaymentIntentProcedure = publicProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const isLive = stripeSecretKey.startsWith('sk_live_');
    console.log(`[Stripe] Using ${isLive ? 'LIVE' : 'TEST'} mode`);

    const { data: sellerProfile, error } = await ctx.supabase
      .from('profiles')
      .select('stripe_account_id, role')
      .eq('id', input.sellerId)
      .single();

    if (error || !sellerProfile) {
      throw new Error('Seller profile not found');
    }

    if (sellerProfile.role !== 'platemaker') {
      throw new Error('Invalid seller account');
    }

    if (!sellerProfile.stripe_account_id) {
      throw new Error('Seller has not completed Stripe onboarding');
    }

    const amountInCents = Math.round(input.amount * 100);
    const applicationFee = Math.round(amountInCents * (input.platformFeePercent / 100));

    const params = new URLSearchParams({
      amount: amountInCents.toString(),
      currency: input.currency,
      'automatic_payment_methods[enabled]': 'true',
      'transfer_data[destination]': sellerProfile.stripe_account_id,
      application_fee_amount: applicationFee.toString(),
      ...(input.orderIds ? { 'metadata[order_ids]': input.orderIds.join(',') } : {}),
    });

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Stripe] Payment intent creation failed:', error);
      throw new Error('Failed to create payment intent');
    }

    const paymentIntent = await response.json();

    console.log(`[Stripe] Payment intent created: ${paymentIntent.id}, Platform fee: $${applicationFee / 100}`);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      platformFee: applicationFee / 100,
    };
  });
