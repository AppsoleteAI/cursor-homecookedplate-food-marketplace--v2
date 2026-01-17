import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { calculateFees } from '../../../lib/fees';

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

    // Calculate fees using dual fee structure:
    // - Buyer pays: base + 10% fee
    // - Platform gets: 10% buyer fee + 10% seller fee = 20% total
    // - Seller gets: base - 10% fee (handled by Stripe Connect)
    const fees = calculateFees(input.amount, input.platformFeePercent, input.platformFeePercent);
    
    const totalChargeInCents = Math.round(fees.totalCharge * 100);
    const appTotalRevenueInCents = Math.round(fees.appTotalRevenue * 100);

    const params = new URLSearchParams({
      amount: totalChargeInCents.toString(), // Buyer pays base + buyer fee
      currency: input.currency,
      'automatic_payment_methods[enabled]': 'true',
      'transfer_data[destination]': sellerProfile.stripe_account_id,
      application_fee_amount: appTotalRevenueInCents.toString(), // Platform keeps buyer fee + seller fee
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

    console.log(`[Stripe] Payment intent created: ${paymentIntent.id}`);
    console.log(`[Stripe] Fee breakdown: Base=$${fees.baseAmount.toFixed(2)}, Buyer fee=$${fees.buyerFee.toFixed(2)}, Seller fee=$${fees.sellerFee.toFixed(2)}`);
    console.log(`[Stripe] Buyer pays: $${fees.totalCharge.toFixed(2)}, Platform revenue: $${fees.appTotalRevenue.toFixed(2)}, Seller payout: $${fees.sellerPayout.toFixed(2)}`);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      platformFee: fees.appTotalRevenue,
      buyerFee: fees.buyerFee,
      sellerFee: fees.sellerFee,
      totalCharge: fees.totalCharge,
      sellerPayout: fees.sellerPayout,
    };
  });
