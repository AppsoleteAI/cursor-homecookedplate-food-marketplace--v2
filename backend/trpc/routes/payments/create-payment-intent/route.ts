import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { calculateFees } from '../../../../lib/fees';
import { PAYOUT_HOLD_DAYS } from '../../../../lib/payout-policy';

const inputSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().default('usd'),
  orderIds: z.array(z.string()).optional(),
  sellerId: z.string(),
  platformFeePercent: z.number().min(0).max(100).default(10),
});

export const createPaymentIntentProcedure = protectedProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    if (!input.orderIds || input.orderIds.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Payment requires the orders being checked out',
      });
    }

    const { data: orders, error: ordersError } = await ctx.supabaseAdmin
      .from('orders')
      .select('id, buyer_id, seller_id, total_price, paid')
      .in('id', input.orderIds);

    if (ordersError || !orders || orders.length !== input.orderIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One or more orders could not be found',
      });
    }

    for (const order of orders) {
      if (order.buyer_id !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only pay for your own orders',
        });
      }
      if (order.seller_id !== input.sellerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All orders in one payment must be from the same cook',
        });
      }
      if (order.paid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This order is already paid',
        });
      }
    }

    const serverBaseAmount = Math.round(
      orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0) * 100
    ) / 100;

    if (!Number.isFinite(serverBaseAmount) || serverBaseAmount <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Order total is invalid',
      });
    }

    const isLive = stripeSecretKey.startsWith('sk_live_');
    console.log(`[Stripe] Using ${isLive ? 'LIVE' : 'TEST'} mode`);

    const { data: sellerProfile, error } = await ctx.supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, role, selling_removed')
      .eq('id', input.sellerId)
      .single();

    if (error || !sellerProfile) {
      throw new Error('Seller profile not found');
    }

    if (sellerProfile.role !== 'platemaker') {
      throw new Error('Invalid seller account');
    }

    if (sellerProfile.selling_removed) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This cook is not allowed to take payments',
      });
    }

    if (!sellerProfile.stripe_account_id) {
      throw new Error('Seller has not completed Stripe onboarding');
    }

    // Calculate fees using dual fee structure:
    // - Buyer pays: base + 10% fee
    // - Platform gets: 10% buyer fee + 10% seller fee = 20% total
    // - Seller gets: base - 10% fee (handled by Stripe Connect)
    // Client amount and fee percent are ignored. total_price is the base plate price.
    const fees = calculateFees(serverBaseAmount, 10, 10);
    
    const totalChargeInCents = Math.round(fees.totalCharge * 100);

    // Charge stays on the platform for PAYOUT_HOLD_DAYS. A later Transfer
    // pays the cook's connected account their seller share directly.
    const params = new URLSearchParams({
      amount: totalChargeInCents.toString(),
      currency: input.currency,
      'automatic_payment_methods[enabled]': 'true',
      'metadata[order_ids]': input.orderIds.join(','),
      'metadata[seller_id]': input.sellerId,
      'metadata[seller_account_id]': sellerProfile.stripe_account_id,
      'metadata[payout_hold_days]': String(PAYOUT_HOLD_DAYS),
      transfer_group: input.orderIds.join(','),
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
