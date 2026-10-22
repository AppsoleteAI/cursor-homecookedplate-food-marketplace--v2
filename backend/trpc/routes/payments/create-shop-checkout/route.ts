import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { protectedProcedure } from '../../../create-context';
import { buyerServiceFeePercent, calculateDeliveryLevy, calculateFees, orderTotalWithDelivery, sellerRefundAmount } from '../../../../lib/fees';
import { nextShopStatus, shopCloseoutNotice, shopRefundIsFull } from '../../../../lib/shop-order-status';
import { payoutReleaseAt } from '../../../../lib/payout-policy';
import { fulfillmentIsDelivery, savedDeliveryFee } from '../../../../lib/delivery-fee';
import { assertBuyerCanOrder } from '../../../../lib/buyer-order-access';
import { salesVolumeBlock } from '../../../../lib/stripe-marketplace';
import { SHOP_NAMES } from '../../../../lib/shop-catalog';
import { priceShopOrder } from '../../../../lib/shop-quote';
import { browserOrigin, openStripeCheckout } from '../../../../lib/stripe-checkout';
import { notifyCookOfPayment, notifyParty } from '../../../../lib/account-notice';
import {
  packShopLines,
  presentSavedShopOrder,
  unpackShopLines,
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
  webOrigin: z.string().url().optional(),
  returnPath: z.string().max(180).optional(),
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
    await notifyCookOfPayment(admin, unpackShopLines(existing.data.lines).sellerId, record.totalCharge);
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
  const sellerId = unpackShopLines(current.lines).sellerId || (typeof current.seller_id === 'string' ? current.seller_id : null);
  await notifyCookOfPayment(admin, sellerId, record.totalCharge);
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
      quote = await priceShopOrder(ctx.supabaseAdmin, input.shop, input.lines, input.sellerId);
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

    const { data: buyerProfile } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role, membership_tier')
      .eq('id', ctx.userId)
      .maybeSingle();
    const buyerPercent = buyerServiceFeePercent({
      role: buyerProfile?.role,
      membershipTier: buyerProfile?.membership_tier,
      baseAmount: quote.baseAmount,
    });
    const fees = calculateFees(quote.baseAmount, buyerPercent, 10);
    const levy = input.deliver && input.sellerId
      ? calculateDeliveryLevy(await savedDeliveryFee(ctx.supabaseAdmin, input.sellerId))
      : calculateDeliveryLevy(0);
    const totalCharge = money(orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, levy.deliveryFee).buyerPays);
    const record = await insertShopRecord(
      ctx.supabaseAdmin,
      ctx.userId,
      input.shop,
      { items: quote.lines, sellerId: input.sellerId ?? null, status: 'pending' },
      quote.baseAmount,
      totalCharge,
    );

    if (input.webOrigin) {
      const origin = browserOrigin(input.webOrigin);
      const path = input.returnPath && input.returnPath.startsWith('/') && !input.returnPath.startsWith('//') && !input.returnPath.includes('..')
        ? input.returnPath
        : '/checkout';
      const checkout = await openStripeCheckout({
        secretKey: stripeSecretKey,
        amountCents: Math.round(totalCharge * 100),
        productName: 'HomeCookedPlate shop order',
        successUrl: `${origin}${path}?webpay=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${path}?webpay=cancel`,
        metadata: {
          shop: input.shop,
          shop_order_id: record.id,
          buyer_id: ctx.userId,
          delivery_fee: levy.deliveryFee.toFixed(2),
          delivery_platform_fee: levy.platformFee.toFixed(2),
          delivery_buyer_pays: levy.buyerPays.toFixed(2),
          ...(input.sellerId ? { seller_id: input.sellerId } : {}),
        },
      });
      await attachPayment(ctx.supabaseAdmin, record, checkout.paymentIntentId);
      return {
        orderId: record.id,
        clientSecret: '',
        checkoutUrl: checkout.url,
        paymentIntentId: checkout.paymentIntentId,
        baseAmount: quote.baseAmount,
        totalCharge,
      };
    }

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
      checkoutUrl: null,
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
    const buyer = await ctx.supabase
      .from('shop_orders')
      .select('id, shop, lines, base_amount, total_charge, paid, created_at')
      .eq('buyer_id', ctx.userId)
      .eq('shop', input.shop)
      .eq('paid', true)
      .order('created_at', { ascending: false });

    if (buyer.error) {
      if (missingTable(buyer.error)) return [];
      console.error('[ShopOrders] List error:', buyer.error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not load shop orders' });
    }

    const sellerSelect = () => ctx.supabaseAdmin
      .from('shop_orders')
      .select('id, shop, lines, base_amount, total_charge, paid, created_at')
      .eq('shop', input.shop)
      .eq('paid', true)
      .order('created_at', { ascending: false });
    const seller = await sellerSelect().filter('lines->>sellerId', 'eq', ctx.userId);
    const sellerOnFulfillment = await sellerSelect().filter('lines->fulfillment->>sellerId', 'eq', ctx.userId);

    const rows = [...(buyer.data ?? [])];
    const seen = new Set(rows.map((row) => row.id));
    for (const result of [seller, sellerOnFulfillment]) {
      if (result.error) {
        console.error('[ShopOrders] Seller list error:', result.error);
        continue;
      }
      for (const row of result.data ?? []) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          rows.push(row);
        }
      }
    }

    const auditSelect = () => ctx.supabaseAdmin
      .from('audit_logs')
      .select('id, user_id, created_at, new_data')
      .eq('action', 'SHOP_ORDER')
      .order('created_at', { ascending: false })
      .limit(100);
    const buyerAudits = await auditSelect().eq('user_id', ctx.userId);
    const sellerAudits = await auditSelect().filter('new_data->>seller_id', 'eq', ctx.userId);
    const audits = {
      error: buyerAudits.error && sellerAudits.error ? buyerAudits.error : null,
      data: [...(buyerAudits.data ?? []), ...(sellerAudits.data ?? [])],
    };
    if (!audits.error) {
      for (const row of audits.data ?? []) {
        if (seen.has(row.id)) continue;
        const data = asRecord(row.new_data);
        if (data.paid !== true || data.shop !== input.shop) continue;
        seen.add(row.id);
        rows.push({
          id: row.id as string,
          shop: input.shop,
          lines: data.lines,
          base_amount: Number(data.base_amount),
          total_charge: Number(data.total_charge),
          paid: true,
          created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
        });
      }
    }

    return rows.flatMap((row) => {
      const saved = presentSavedShopOrder(row);
      return saved ? [saved] : [];
    });
  });

async function refundShopCard(
  secretKey: string,
  paymentIntentId: string,
  amountCents: number,
): Promise<void> {
  const response = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(amountCents),
    }).toString(),
  });
  if (!response.ok) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'The card refund did not go through. This order is still open.',
    });
  }
}

export const updateShopOrderProcedure = protectedProcedure
  .input(z.object({
    orderId: z.string().uuid(),
    action: z.enum(['accept', 'refund', 'complete']),
  }))
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from('shop_orders')
      .select('id, buyer_id, shop, lines, base_amount, total_charge, paid, payment_intent_id')
      .eq('id', input.orderId)
      .maybeSingle();
    if (error || !data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop order not found' });
    }
    const packed = unpackShopLines(data.lines);
    if (packed.sellerId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the cook on this order can update it.' });
    }
    if (data.paid !== true) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order is not paid.' });
    }
    const next = nextShopStatus(packed.status, input.action);
    if (!next) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `This order is ${packed.status}. That step is not available.` });
    }

    if (input.action === 'refund') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey || !data.payment_intent_id) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The card refund could not be started. This order is still open.',
        });
      }
      const cents = shopRefundIsFull(packed.status)
        ? Math.round(Number(data.total_charge) * 100)
        : Math.round(sellerRefundAmount(Number(data.base_amount)) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order has no amount to refund.' });
      }
      await refundShopCard(stripeSecretKey, data.payment_intent_id, cents);
    }

    const lines = {
      items: packed.items,
      fulfillment: packed.fulfillment,
      sellerId: packed.sellerId,
      status: next,
    };
    const { error: updateError } = await ctx.supabaseAdmin
      .from('shop_orders')
      .update({ lines, paid: next !== 'cancelled' })
      .eq('id', data.id);
    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: input.action === 'refund'
          ? 'The refund was sent to the card, but this order is still open.'
          : 'Could not update this shop order.',
      });
    }

    if (data.buyer_id) {
      try {
        await notifyParty(ctx.supabaseAdmin, data.buyer_id, 'orderUpdates', shopCloseoutNotice(input.action));
      } catch (noticeError) {
        console.error('[ShopOrder] Notice was not sent:', noticeError);
      }
    }

    if (next === 'completed' && data.payment_intent_id) {
      await ctx.supabaseAdmin
        .from('transactions')
        .update({ payout_release_at: payoutReleaseAt() })
        .eq('payment_intent_id', data.payment_intent_id)
        .eq('seller_id', ctx.userId)
        .is('order_id', null)
        .eq('status', 'held')
        .is('payout_release_at', null);
    }

    return { id: data.id as string, status: next };
  });

export const abandonShopOrderProcedure = protectedProcedure
  .input(z.object({
    orderId: z.string().uuid().optional(),
    paymentIntentId: z.string().min(3).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    if (!input.orderId && !input.paymentIntentId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This checkout has no order to close.' });
    }
    const lookup = ctx.supabaseAdmin.from('shop_orders').select('id, buyer_id, lines, paid');
    const { data, error } = input.orderId
      ? await lookup.eq('id', input.orderId).maybeSingle()
      : await lookup.eq('payment_intent_id', input.paymentIntentId ?? '').maybeSingle();
    if (error || !data) return { cancelled: 0 };
    if (data.buyer_id !== ctx.userId || data.paid === true) return { cancelled: 0 };
    const packed = unpackShopLines(data.lines);
    const { error: updateError } = await ctx.supabaseAdmin
      .from('shop_orders')
      .update({
        lines: { items: packed.items, fulfillment: packed.fulfillment, sellerId: packed.sellerId, status: 'cancelled' },
        paid: false,
      })
      .eq('id', data.id);
    if (updateError) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not close the unpaid shop order.' });
    }
    return { cancelled: 1 };
  });
