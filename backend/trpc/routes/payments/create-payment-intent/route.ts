import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { buyerCardCharge, buyerServiceFeePercent, calculateDeliveryLevy, calculateFees, orderTotalWithDelivery } from '../../../../lib/fees';
import { savedDeliveryFee } from '../../../../lib/delivery-fee';
import { PAYOUT_HOLD_DAYS } from '../../../../lib/payout-policy';
import { salesVolumeBlock } from '../../../../lib/stripe-marketplace';
import { browserOrigin, openStripeCheckout } from '../../../../lib/stripe-checkout';
import { orderBuyerId, orderTotal } from '../../../../lib/order-row';

const inputSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().default('usd'),
  orderIds: z.array(z.string()).optional(),
  sellerId: z.string(),
  platformFeePercent: z.number().min(0).max(100).default(10),
  deliver: z.boolean().optional(),
  webOrigin: z.string().url().optional(),
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

    const ordersResult = await ctx.supabaseAdmin
      .from('orders')
      .select('*')
      .in('id', input.orderIds);
    const orders = ordersResult.data;
    const ordersError = ordersResult.error;

    if (ordersError || !orders || orders.length !== input.orderIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One or more orders could not be found',
      });
    }

    for (const order of orders) {
      if (orderBuyerId(order) !== ctx.userId) {
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
      orders.reduce((sum, order) => sum + orderTotal(order), 0) * 100
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

    const volumeBlock = await salesVolumeBlock(ctx.supabaseAdmin, input.sellerId, serverBaseAmount);
    if (volumeBlock) {
      throw new TRPCError({ code: 'FORBIDDEN', message: volumeBlock });
    }

    if (!sellerProfile.stripe_account_id) {
      throw new Error('Seller has not completed Stripe onboarding');
    }

    const { data: buyerProfile } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role, membership_tier')
      .eq('id', ctx.userId)
      .maybeSingle();
    const buyerPercent = buyerServiceFeePercent({
      role: buyerProfile?.role,
      membershipTier: buyerProfile?.membership_tier,
      baseAmount: serverBaseAmount,
    });
    const fees = calculateFees(serverBaseAmount, buyerPercent, 10);
    const savedFee = input.deliver ? await savedDeliveryFee(ctx.supabaseAdmin, input.sellerId) : 0;
    if (input.deliver && !(savedFee > 0)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This cook has not set a delivery fee, so delivery cannot be selected.',
      });
    }
    const levy = calculateDeliveryLevy(savedFee);
    const withDelivery = orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, levy.deliveryFee);
    const card = buyerCardCharge(withDelivery.buyerPays);
    const totalChargeInCents = Math.round(card.cardCharge * 100);

    // Charge stays on the platform for PAYOUT_HOLD_DAYS. A later Transfer
    // pays the cook's connected account their seller share directly.
    if (input.webOrigin) {
      const origin = browserOrigin(input.webOrigin);
      const checkout = await openStripeCheckout({
        secretKey: stripeSecretKey,
        amountCents: totalChargeInCents,
        productName: 'HomeCookedPlate order',
        successUrl: `${origin}/checkout?webpay=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/checkout?webpay=cancel`,
        metadata: {
          order_ids: input.orderIds.join(','),
          buyer_id: ctx.userId,
          seller_id: input.sellerId,
          payout_hold_days: String(PAYOUT_HOLD_DAYS),
          delivery_fee: levy.deliveryFee.toFixed(2),
          delivery_platform_fee: levy.platformFee.toFixed(2),
          delivery_buyer_pays: levy.buyerPays.toFixed(2),
        },
      });
      return {
        clientSecret: '',
        checkoutUrl: checkout.url,
        paymentIntentId: checkout.paymentIntentId,
        platformFee: fees.appTotalRevenue,
        buyerFee: fees.buyerFee,
        sellerFee: fees.sellerFee,
        marketplaceTotal: fees.totalCharge,
        stripeFee: card.stripeFee,
        taxAmount: card.taxAmount,
        totalCharge: card.cardCharge,
        sellerPayout: withDelivery.sellerReceives,
        deliveryFee: levy.deliveryFee,
        deliveryPlatformFee: levy.platformFee,
        deliveryBuyerPays: levy.buyerPays,
      };
    }

    const params = new URLSearchParams({
      amount: totalChargeInCents.toString(),
      currency: input.currency,
      'automatic_payment_methods[enabled]': 'true',
      'metadata[order_ids]': input.orderIds.join(','),
      'metadata[seller_id]': input.sellerId,
      'metadata[seller_account_id]': sellerProfile.stripe_account_id,
      'metadata[payout_hold_days]': String(PAYOUT_HOLD_DAYS),
      'metadata[delivery_fee]': levy.deliveryFee.toFixed(2),
      'metadata[delivery_platform_fee]': levy.platformFee.toFixed(2),
      'metadata[delivery_buyer_pays]': levy.buyerPays.toFixed(2),
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
    console.log(`[Stripe] Buyer pays: $${card.cardCharge.toFixed(2)} (marketplace $${fees.totalCharge.toFixed(2)} + card fee $${card.stripeFee.toFixed(2)}), Platform revenue: $${fees.appTotalRevenue.toFixed(2)}, Seller payout: $${fees.sellerPayout.toFixed(2)}`);

    return {
      clientSecret: paymentIntent.client_secret,
      checkoutUrl: null,
      paymentIntentId: paymentIntent.id,
      platformFee: fees.appTotalRevenue,
      buyerFee: fees.buyerFee,
      sellerFee: fees.sellerFee,
      marketplaceTotal: fees.totalCharge,
      stripeFee: card.stripeFee,
      taxAmount: card.taxAmount,
      totalCharge: card.cardCharge,
      sellerPayout: withDelivery.sellerReceives,
      deliveryFee: levy.deliveryFee,
      deliveryPlatformFee: levy.platformFee,
      deliveryBuyerPays: levy.buyerPays,
    };
  });
