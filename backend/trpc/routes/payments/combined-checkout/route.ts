import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { protectedProcedure } from '../../../create-context';
import { quoteShopOrder, type ShopName } from '../../../../lib/shop-catalog';
import {
  CHECKOUT_AREAS,
  checkoutKey,
  quoteCheckout,
  quoteCombined,
  type CheckoutArea,
  type QuotedCheckout,
  type QuotedLine,
} from '../../../../lib/combined-checkout';
import { payoutReleaseAt } from '../../../../lib/payout-policy';
import { assertBuyerCanOrder } from '../../../../lib/buyer-order-access';
import { refundCookSale } from '../../../../lib/stripe-marketplace';

const lineSchema = z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(999),
});

const checkoutSchema = z.object({
  area: z.enum(CHECKOUT_AREAS),
  sellerId: z.string().uuid().optional(),
  lines: z.array(lineSchema).min(1).max(20),
});

const combinedInput = z.object({
  checkouts: z.array(checkoutSchema).min(1).max(12),
});

type SellerProfile = {
  id: string;
  role: string;
  stripe_account_id: string | null;
  selling_removed: boolean | null;
  available_for_orders: boolean | null;
  username: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function shopForArea(area: CheckoutArea): ShopName | null {
  if (area === 'home') return null;
  if (area === 'food_cart') return 'food_truck';
  if (area === 'ghost_kitchen') return 'sit_down';
  return area;
}

async function areaStoreIsOpen(
  admin: SupabaseClient,
  sellerId: string,
  area: CheckoutArea,
): Promise<boolean> {
  const { data, error } = await admin
    .from('audit_logs')
    .select('new_data, created_at')
    .eq('user_id', sellerId)
    .eq('action', 'AREA_STORE')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) {
    console.error('[AreaStore] Read failed:', error.message);
    return false;
  }
  const match = (data ?? []).find((row) => asRecord(row.new_data).area === area);
  return asRecord(match?.new_data).open === true;
}

async function loadSeller(admin: SupabaseClient, sellerId: string): Promise<SellerProfile | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, role, stripe_account_id, selling_removed, available_for_orders, username')
    .eq('id', sellerId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SellerProfile;
}

async function assertSellerCanTakeOrders(
  admin: SupabaseClient,
  sellerId: string,
  area: CheckoutArea,
): Promise<SellerProfile> {
  const seller = await loadSeller(admin, sellerId);
  if (!seller || seller.role !== 'platemaker') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This seller is not signed up to take app orders.' });
  }
  if (seller.selling_removed) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This seller is not allowed to take payments.' });
  }
  if (!seller.stripe_account_id) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This seller has not finished Stripe setup, so this checkout cannot be charged.',
    });
  }
  if (area === 'home') {
    if (seller.available_for_orders === false) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This cook has closed their plate store.' });
    }
    return seller;
  }
  const open = await areaStoreIsOpen(admin, sellerId, area);
  if (!open) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This store is not open for app orders.' });
  }
  return seller;
}

async function priceHomeLines(
  admin: SupabaseClient,
  sellerId: string,
  lines: { productId: string; quantity: number }[],
): Promise<QuotedLine[]> {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const { data, error } = await admin
    .from('meals')
    .select('id, user_id, name, price')
    .in('id', ids);
  if (error || !data) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'One of these plates could not be priced.' });
  }
  const meals = new Map(data.map((meal) => [meal.id as string, meal]));
  return lines.map((line) => {
    const meal = meals.get(line.productId);
    if (!meal || meal.user_id !== sellerId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A plate in this checkout is not from that cook.' });
    }
    const unitPrice = Number(meal.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A plate in this checkout has no price.' });
    }
    return { name: String(meal.name), quantity: line.quantity, unitPrice };
  });
}

async function priceCheckout(
  admin: SupabaseClient,
  checkout: z.infer<typeof checkoutSchema>,
  sellerName: string,
): Promise<QuotedCheckout> {
  if (!checkout.sellerId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This checkout has no seller.' });
  }
  const merged = new Map<string, number>();
  for (const line of checkout.lines) {
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
  }
  const lines = [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  const shop = shopForArea(checkout.area);
  let priced: QuotedLine[];
  if (!shop) {
    priced = await priceHomeLines(admin, checkout.sellerId, lines);
  } else {
    try {
      priced = quoteShopOrder(shop, lines).lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      }));
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'This checkout cannot be priced.',
      });
    }
  }
  return quoteCheckout({
    area: checkout.area,
    sellerId: checkout.sellerId,
    sellerName,
    lines: priced,
  });
}

async function buildReceipt(
  admin: SupabaseClient,
  checkouts: z.infer<typeof checkoutSchema>[],
): Promise<QuotedCheckout[]> {
  const grouped = new Map<string, z.infer<typeof checkoutSchema>>();
  for (const checkout of checkouts) {
    const key = checkoutKey(checkout.area, checkout.sellerId ?? checkout.area);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, checkout);
      continue;
    }
    existing.lines = [...existing.lines, ...checkout.lines];
  }

  const quoted: QuotedCheckout[] = [];
  for (const checkout of grouped.values()) {
    if (!checkout.sellerId) {
      if (checkout.area === 'home') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A plate in this checkout has no cook.' });
      }
      const shop = shopForArea(checkout.area);
      if (!shop) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This checkout cannot be priced.' });
      }
      const merged = new Map<string, number>();
      for (const line of checkout.lines) {
        merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
      }
      const lines = [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
      let priced: QuotedLine[];
      try {
        priced = quoteShopOrder(shop, lines).lines.map((line) => ({
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }));
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'This checkout cannot be priced.',
        });
      }
      quoted.push(quoteCheckout({
        area: checkout.area,
        sellerId: checkout.area,
        sellerName: CHECKOUT_AREA_LABEL[checkout.area],
        lines: priced,
      }));
      continue;
    }
    const seller = await assertSellerCanTakeOrders(admin, checkout.sellerId, checkout.area);
    quoted.push(await priceCheckout(admin, checkout, seller.username || 'Seller'));
  }
  return quoted;
}

async function insertShopRecord(
  admin: SupabaseClient,
  buyerId: string,
  checkout: QuotedCheckout,
  paymentIntentId: string,
): Promise<string | null> {
  const shop = shopForArea(checkout.area);
  if (!shop) return null;
  const lines = {
    items: checkout.lines.map((line) => ({
      productId: line.name,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    fulfillment: { area: checkout.area, sellerId: checkout.sellerId },
  };
  const primary = await admin
    .from('shop_orders')
    .insert({
      buyer_id: buyerId,
      shop,
      lines,
      base_amount: checkout.baseAmount,
      total_charge: checkout.buyerPays,
      paid: true,
      payment_intent_id: paymentIntentId,
    })
    .select('id')
    .single();
  if (!primary.error && primary.data) return primary.data.id as string;

  const audit = await admin
    .from('audit_logs')
    .insert({
      user_id: buyerId,
      action: 'SHOP_ORDER',
      table_name: 'shop_orders',
      new_data: {
        shop,
        lines,
        base_amount: checkout.baseAmount,
        total_charge: checkout.buyerPays,
        paid: true,
        payment_intent_id: paymentIntentId,
        seller_id: checkout.sellerId,
        area: checkout.area,
      },
    })
    .select('id')
    .single();
  if (audit.error || !audit.data) {
    console.error('[CombinedCheckout] Shop order insert failed:', primary.error, audit.error);
    return null;
  }
  return audit.data.id as string;
}

async function insertHomeOrder(
  admin: SupabaseClient,
  buyerId: string,
  checkout: QuotedCheckout,
  paymentIntentId: string,
  mealId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('orders')
    .insert({
      meal_id: mealId,
      buyer_id: buyerId,
      seller_id: checkout.sellerId,
      quantity: checkout.lines.reduce((sum, line) => sum + line.quantity, 0),
      total_price: checkout.baseAmount,
      paid: true,
      status: 'accepted',
      payment_intent_id: paymentIntentId,
      special_instructions: checkout.lines.map((line) => `${line.quantity} ${line.name}`).join(', '),
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[CombinedCheckout] Home order insert failed:', error);
    return null;
  }
  return data.id as string;
}

async function holdPayout(
  admin: SupabaseClient,
  buyerId: string,
  checkout: QuotedCheckout,
  paymentIntentId: string,
  orderId: string | null,
) {
  const { error } = await admin.from('transactions').insert({
    payment_intent_id: paymentIntentId,
    order_id: orderId,
    buyer_id: buyerId,
    seller_id: checkout.sellerId,
    base_price: checkout.baseAmount,
    buyer_payment: checkout.buyerPays,
    seller_payout: checkout.sellerPayout,
    app_revenue: checkout.platformKeeps,
    buyer_fee: checkout.buyerFee,
    seller_fee: checkout.sellerFee,
    total_fee: checkout.platformKeeps,
    currency: 'usd',
    quantity: checkout.lines.reduce((sum, line) => sum + line.quantity, 0),
    status: 'held',
    payout_release_at: payoutReleaseAt(),
    metadata: {
      area: checkout.area,
      sellerName: checkout.sellerName,
      lines: checkout.lines,
    },
  });
  if (error) {
    console.error('[CombinedCheckout] Payout hold failed:', error.message);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The card was charged, but the payout record failed. Retry confirm to finish it.' });
  }
}

export const setAreaStoreProcedure = protectedProcedure
  .input(z.object({
    area: z.enum(CHECKOUT_AREAS),
    open: z.boolean(),
  }))
  .mutation(async ({ input, ctx }) => {
    if (input.area === 'home') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Plate availability uses the cook store switch.' });
    }
    const seller = await loadSeller(ctx.supabaseAdmin, ctx.userId);
    if (!seller || seller.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Sign up as a platemaker before opening a store.' });
    }
    if (input.open && seller.selling_removed) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Selling is removed until an admin restores it.' });
    }
    if (input.open && !seller.stripe_account_id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Finish Stripe setup before opening this store.' });
    }
    const { error } = await ctx.supabaseAdmin.from('audit_logs').insert({
      user_id: ctx.userId,
      action: 'AREA_STORE',
      table_name: 'profiles',
      new_data: { area: input.area, open: input.open },
    });
    if (error) {
      console.error('[AreaStore] Write failed:', error.message);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The store switch could not be saved.' });
    }
    return { area: input.area, open: input.open };
  });

export const createCombinedCheckoutProcedure = protectedProcedure
  .input(combinedInput)
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error('Stripe secret key not configured');

    await assertBuyerCanOrder(ctx.supabaseAdmin, ctx.userId);
    const sellerIds = [...new Set(input.checkouts.flatMap((checkout) => checkout.sellerId ? [checkout.sellerId] : []))];
    for (const sellerId of sellerIds) {
      await assertBuyerCanOrder(ctx.supabaseAdmin, ctx.userId, sellerId);
    }

    const quoted = await buildReceipt(ctx.supabaseAdmin, input.checkouts);
    const receipt = quoteCombined(quoted);
    if (receipt.combinedBuyerPays <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This checkout has nothing to charge.' });
    }

    const params = new URLSearchParams({
      amount: String(Math.round(receipt.combinedBuyerPays * 100)),
      currency: 'usd',
      'automatic_payment_methods[enabled]': 'true',
      'metadata[buyer_id]': ctx.userId,
      'metadata[checkout_count]': String(quoted.length),
      'metadata[checkout_ids]': quoted.map((checkout) => checkout.id).join(',').slice(0, 480),
      transfer_group: `combined_${ctx.userId.slice(0, 8)}_${Date.now()}`,
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
      console.error('[CombinedCheckout] Payment intent creation failed');
      throw new Error('Failed to create payment intent');
    }
    const paymentIntent = await response.json() as { id: string; client_secret: string };
    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      receipt,
    };
  });

export const confirmCombinedCheckoutProcedure = protectedProcedure
  .input(combinedInput.extend({ paymentIntentId: z.string().min(3) }))
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error('Stripe secret key not configured');

    const existing = await ctx.supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('payment_intent_id', input.paymentIntentId)
      .limit(1);
    if (!existing.error && existing.data && existing.data.length > 0) {
      const quoted = await buildReceipt(ctx.supabaseAdmin, input.checkouts);
      return { paymentIntentId: input.paymentIntentId, receipt: quoteCombined(quoted), alreadyRecorded: true };
    }

    const quoted = await buildReceipt(ctx.supabaseAdmin, input.checkouts);
    const receipt = quoteCombined(quoted);
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${input.paymentIntentId}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    if (!response.ok) throw new Error('Failed to retrieve payment intent');
    const paymentIntent = await response.json() as {
      status: string;
      amount: number;
      metadata?: { buyer_id?: string };
    };
    const expectedCents = Math.round(receipt.combinedBuyerPays * 100);
    if (paymentIntent.status !== 'succeeded' || paymentIntent.amount !== expectedCents) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment is not complete.' });
    }
    if (paymentIntent.metadata?.buyer_id !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment belongs to another account.' });
    }

    for (const checkout of quoted) {
      const mealId = input.checkouts.find((item) => item.area === 'home' && item.sellerId === checkout.sellerId)?.lines[0]?.productId;
      const orderId = checkout.area === 'home'
        ? await insertHomeOrder(ctx.supabaseAdmin, ctx.userId, checkout, input.paymentIntentId, mealId || '')
        : await insertShopRecord(ctx.supabaseAdmin, ctx.userId, checkout, input.paymentIntentId);
      if (checkout.area === 'home' && !orderId) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The card was charged, but the plate order was not saved. Retry confirm to finish it.' });
      }
      if (input.checkouts.some((item) => item.sellerId === checkout.sellerId)) {
        await holdPayout(ctx.supabaseAdmin, ctx.userId, checkout, input.paymentIntentId, checkout.area === 'home' ? orderId : null);
      }
    }

    return { paymentIntentId: input.paymentIntentId, receipt, alreadyRecorded: false };
  });

export const refundCombinedCheckoutProcedure = protectedProcedure
  .input(z.object({
    paymentIntentId: z.string().min(3),
    area: z.enum(CHECKOUT_AREAS),
    sellerId: z.string().uuid(),
  }))
  .mutation(async ({ input, ctx }) => {
    if (ctx.userId !== input.sellerId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only that seller can refund their checkout.' });
    }
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error('Stripe secret key not configured');

    const { data, error } = await ctx.supabaseAdmin
      .from('transactions')
      .select('id, seller_id, seller_payout, base_price, status, order_id, metadata, payment_intent_id')
      .eq('payment_intent_id', input.paymentIntentId)
      .eq('seller_id', input.sellerId);
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not load this checkout.' });

    const rows = (data ?? []).filter((row) => asRecord(row.metadata).area === input.area);
    if (rows.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That checkout is not on this charge.' });
    }

    let refundAmount = 0;
    let platformFeeKept = 0;
    let refundId = '';
    for (const row of rows) {
      if (row.status === 'refunded') continue;
      const baseAmount = Number(row.base_price);
      const result = await refundCookSale(ctx.supabaseAdmin, stripeSecretKey, {
        orderId: row.order_id || '',
        sellerId: input.sellerId,
        paymentIntentId: input.paymentIntentId,
        baseAmount,
        transactionId: row.id as string,
      });
      refundAmount += result.refundAmount;
      platformFeeKept += result.platformFeeKept;
      refundId = result.refundId;
      if (row.order_id) {
        await ctx.supabaseAdmin
          .from('orders')
          .update({ status: 'cancelled', paid: false })
          .eq('id', row.order_id)
          .eq('seller_id', input.sellerId);
      }
    }

    return {
      refundId,
      refundAmount: Math.round(refundAmount * 100) / 100,
      platformFeeKept: Math.round(platformFeeKept * 100) / 100,
      message: 'That checkout was refunded for the seller share. The other checkouts on this charge stay paid, and HomeCookedPlate keeps the fees on the refunded checkout.',
    };
  });
