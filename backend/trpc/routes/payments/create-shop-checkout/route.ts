import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { protectedProcedure } from '../../../create-context';
import { calculateDeliveryLevy, calculateFees, orderTotalWithDelivery } from '../../../../lib/fees';
import { fulfillmentIsDelivery, savedDeliveryFee } from '../../../../lib/delivery-fee';
import { assertBuyerCanOrder } from '../../../../lib/buyer-order-access';
import { salesVolumeBlock } from '../../../../lib/stripe-marketplace';
import { quoteShopOrder, SHOP_NAMES } from '../../../../lib/shop-catalog';
import {
  packShopLines,
  presentSavedShopOrder,
  shopFulfillmentSchema,
  type ShopFulfillment,
} from '../../../../lib/shop-fulfillment';

const lineSchema = z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(999),
});

const checkoutInput = z.object({
  shop: z.enum(SHOP_NAMES),
  lines: z.array(lineSchema).min(1).max(20),
  sellerId: z.string().uuid().optional(),
  deliver: z.boolean().optional(),
});

type ShopRecord = {
  id: string;
  shop: string;
  buyerId: string;
  totalCharge: number;
  paid: boolean;
  paymentIntentId: string | null;
  store: 'shop_orders' | 'audit_logs';
};

function money(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || /schema cache/i.test(error.message ?? '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

async function insertShopRecord(
  admin: SupabaseClient,
  buyerId: string,
  shop: string,
  lines: unknown,
  baseAmount: number,
  totalCharge: number,
): Promise<ShopRecord> {
  const payload = {
    shop,
    lines,
    base_amount: baseAmount,
    total_charge: totalCharge,
    paid: false,
    payment_intent_id: null,
  };
  const primary = await admin
    .from('shop_orders')
    .insert({
      buyer_id: buyerId,
      shop,
      lines,
      base_amount: baseAmount,
      total_charge: totalCharge,
      paid: false,
    })
    .select('id')
    .single();

  if (!primary.error && primary.data) {
    return {
      id: primary.data.id as string,
      shop,
      buyerId,
      totalCharge,
      paid: false,
      paymentIntentId: null,
      store: 'shop_orders',
    };
  }
  if (!missingTable(primary.error)) {
    console.error('[ShopCheckout] Insert error:', primary.error);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not open a shop order' });
  }

  const audit = await admin
    .from('audit_logs')
    .insert({
      user_id: buyerId,
      action: 'SHOP_ORDER',
      table_name: 'shop_orders',
      new_data: payload,
    })
    .select('id')
    .single();
  if (audit.error || !audit.data) {
    console.error('[ShopCheckout] Audit insert error:', audit.error);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not open a shop order' });
  }
  return {
    id: audit.data.id as string,
    shop,
    buyerId,
    totalCharge,
    paid: false,
    paymentIntentId: null,
    store: 'audit_logs',
  };
}

async function attachPayment(
  admin: SupabaseClient,
  record: ShopRecord,
  paymentIntentId: string,
) {
  if (record.store === 'shop_orders') {
    const { error } = await admin
      .from('shop_orders')
      .update({ payment_intent_id: paymentIntentId })
      .eq('id', record.id)
      .eq('buyer_id', record.buyerId);
    if (error) throw new Error('Failed to link the shop order to payment');
    return;
  }

  const existing = await admin
    .from('audit_logs')
    .select('new_data')
    .eq('id', record.id)
    .eq('user_id', record.buyerId)
    .single();
  if (existing.error || !existing.data) throw new Error('Failed to link the shop order to payment');
  const { error } = await admin
    .from('audit_logs')
    .update({ new_data: { ...asRecord(existing.data.new_data), payment_intent_id: paymentIntentId } })
    .eq('id', record.id)
    .eq('user_id', record.buyerId);
  if (error) throw new Error('Failed to link the shop order to payment');
}

async function loadByPayment(
  admin: SupabaseClient,
  paymentIntentId: string,
  buyerId: string,
): Promise<ShopRecord | null> {
  const primary = await admin
    .from('shop_orders')
    .select('id, shop, buyer_id, total_charge, paid, payment_intent_id')
    .eq('payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (!primary.error && primary.data) {
    if (primary.data.buyer_id !== buyerId) return null;
    return {
      id: primary.data.id as string,
      shop: primary.data.shop as string,
      buyerId,
      totalCharge: Number(primary.data.total_charge),
      paid: Boolean(primary.data.paid),
      paymentIntentId,
      store: 'shop_orders',
    };
  }
  if (primary.error && !missingTable(primary.error)) return null;

  const audit = await admin
    .from('audit_logs')
    .select('id, user_id, new_data')
    .eq('action', 'SHOP_ORDER')
    .eq('user_id', buyerId)
    .filter('new_data->>payment_intent_id', 'eq', paymentIntentId)
    .maybeSingle();
  if (audit.error || !audit.data) return null;
  const data = asRecord(audit.data.new_data);
  return {
    id: audit.data.id as string,
    shop: typeof data.shop === 'string' ? data.shop : '',
    buyerId,
    totalCharge: Number(data.total_charge),
    paid: data.paid === true,
    paymentIntentId,
    store: 'audit_logs',
  };
}

async function markPaid(
  admin: { from: (table: string) => any },
  record: ShopRecord,
  fulfillment: ShopFulfillment,
) {
  if (fulfillment.shop !== record.shop) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This handoff does not match the shop that was charged' });
  }
  if (record.store === 'shop_orders') {
    const existing = await admin
      .from('shop_orders')
      .select('lines')
      .eq('id', record.id)
      .eq('buyer_id', record.buyerId)
      .single();
    if (existing.error || !existing.data) throw new Error('Failed to record the shop payment');
    const { error } = await admin
      .from('shop_orders')
      .update({ paid: true, lines: packShopLines(existing.data.lines, fulfillment) })
      .eq('id', record.id)
      .eq('buyer_id', record.buyerId);
    if (error) throw new Error('Failed to record the shop payment');
    return;
  }
  const existing = await admin
    .from('audit_logs')
    .select('new_data')
    .eq('id', record.id)
    .eq('user_id', record.buyerId)
    .single();
  if (existing.error || !existing.data) throw new Error('Failed to record the shop payment');
  const current = asRecord(existing.data.new_data);
  const { error } = await admin
    .from('audit_logs')
    .update({
      new_data: {
        ...current,
        paid: true,
        lines: packShopLines(current.lines, fulfillment),
      },
    })
    .eq('id', record.id)
    .eq('user_id', record.buyerId);
  if (error) throw new Error('Failed to record the shop payment');
}

export const createShopCheckoutProcedure = protectedProcedure
  .input(checkoutInput)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    await assertBuyerCanOrder(ctx.supabaseAdmin, ctx.userId, input.sellerId);

    let quote;
    try {
      quote = quoteShopOrder(input.shop, input.lines);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'This order cannot be charged',
      });
    }

    if (input.sellerId) {
      const volumeBlock = await salesVolumeBlock(ctx.supabaseAdmin, input.sellerId, quote.baseAmount);
      if (volumeBlock) throw new TRPCError({ code: 'FORBIDDEN', message: volumeBlock });
    }

    const fees = calculateFees(quote.baseAmount, 10, 10);
    const levy = input.deliver && input.sellerId
      ? calculateDeliveryLevy(await savedDeliveryFee(ctx.supabaseAdmin, input.sellerId))
      : calculateDeliveryLevy(0);
    const totalCharge = money(orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, levy.deliveryFee).buyerPays);
    const record = await insertShopRecord(
      ctx.supabaseAdmin,
      ctx.userId,
      input.shop,
      quote.lines,
      quote.baseAmount,
      totalCharge,
    );

    const params = new URLSearchParams({
      amount: Math.round(totalCharge * 100).toString(),
      currency: 'usd',
      'automatic_payment_methods[enabled]': 'true',
      'metadata[shop]': input.shop,
      'metadata[shop_order_id]': record.id,
      'metadata[buyer_id]': ctx.userId,
      'metadata[delivery_fee]': levy.deliveryFee.toFixed(2),
      'metadata[delivery_platform_fee]': levy.platformFee.toFixed(2),
      'metadata[delivery_buyer_pays]': levy.buyerPays.toFixed(2),
      ...(input.sellerId ? { 'metadata[seller_id]': input.sellerId } : {}),
    });

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('[ShopCheckout] Payment intent creation failed');
      throw new Error('Failed to create payment intent');
    }

    const paymentIntent = await response.json() as { id: string; client_secret: string };
    await attachPayment(ctx.supabaseAdmin, record, paymentIntent.id);

    return {
      orderId: record.id,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      baseAmount: quote.baseAmount,
      totalCharge,
    };
  });

export const confirmShopPaymentProcedure = protectedProcedure
  .input(z.object({
    paymentIntentId: z.string().min(3),
    fulfillment: shopFulfillmentSchema,
  }))
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const record = await loadByPayment(ctx.supabaseAdmin, input.paymentIntentId, ctx.userId);
    if (!record) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop order not found' });
    }
    if (record.paid) {
      return { orderId: record.id, paid: true };
    }

    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${input.paymentIntentId}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    if (!response.ok) {
      throw new Error('Failed to retrieve payment intent');
    }
    const paymentIntent = await response.json() as {
      status: string;
      amount: number;
      metadata?: { shop_order_id?: string; buyer_id?: string; seller_id?: string; delivery_buyer_pays?: string };
    };
    const deliver = fulfillmentIsDelivery(input.fulfillment);
    const sellerId = paymentIntent.metadata?.seller_id;
    const expectedDelivery = deliver && sellerId
      ? calculateDeliveryLevy(await savedDeliveryFee(ctx.supabaseAdmin, sellerId)).buyerPays
      : 0;
    const chargedDelivery = Number(paymentIntent.metadata?.delivery_buyer_pays ?? 0);
    if (Math.round(expectedDelivery * 100) !== Math.round(chargedDelivery * 100)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The delivery fee changed. Start checkout again.' });
    }

    const expectedCents = Math.round(record.totalCharge * 100);
    if (paymentIntent.status !== 'succeeded' || paymentIntent.amount !== expectedCents) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment is not complete' });
    }
    if (paymentIntent.metadata?.shop_order_id !== record.id || paymentIntent.metadata?.buyer_id !== ctx.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment does not match this order' });
    }

    await markPaid(ctx.supabaseAdmin, record, input.fulfillment);
    return { orderId: record.id, paid: true };
  });

export const listShopOrdersProcedure = protectedProcedure
  .input(z.object({ shop: z.enum(SHOP_NAMES) }))
  .query(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('shop_orders')
      .select('id, shop, lines, base_amount, total_charge, paid, created_at')
      .eq('buyer_id', ctx.userId)
      .eq('shop', input.shop)
      .eq('paid', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (missingTable(error)) return [];
      console.error('[ShopOrders] List error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not load shop orders' });
    }

    return (data ?? []).flatMap((row) => {
      const saved = presentSavedShopOrder(row);
      return saved ? [saved] : [];
    });
  });
