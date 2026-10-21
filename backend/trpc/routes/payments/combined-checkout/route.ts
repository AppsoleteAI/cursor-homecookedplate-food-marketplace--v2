import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { protectedProcedure } from '../../../create-context';
import { quoteShopOrder, type ShopName } from '../../../../lib/shop-catalog';
import { checkoutAreaShop, shopFulfillmentSchema, type ShopFulfillment } from '../../../../lib/shop-fulfillment';
import { fulfillmentIsDelivery, savedDeliveryFee } from '../../../../lib/delivery-fee';
import { appRevenueWithDelivery, orderTotalWithDelivery, sharedChargeRefundCents } from '../../../../lib/fees';
import { assertShopHandoff } from '@/lib/combined-handoff';
import {
  CHECKOUT_AREAS,
  CHECKOUT_AREA_LABEL,
  checkoutKey,
  quoteCheckout,
  quoteCombined,
  quoteCard,
  quotedLineAmount,
  type CheckoutArea,
  type QuotedCheckout,
  type QuotedLine,
} from '../../../../lib/combined-checkout';
import { payoutReleaseAt } from '../../../../lib/payout-policy';
import { assertBuyerCanOrder } from '../../../../lib/buyer-order-access';
import { buyerMetroCanOrder } from '../../../../lib/metro-menu';
import { refundCookSale } from '../../../../lib/stripe-marketplace';
import { notifyCookOfPayment, notifyParty } from '../../../../lib/account-notice';
import { prepareHomePlate, thisOrderExceedsPortions } from '../../../../lib/plate-order-rules';
import { refundChargeCents } from '../../../../lib/refund-card';
import {
  auditShopMatchesCombinedRefund,
  cancelledAuditShop,
  cancelledShopLines,
  shopOrderMatchesCombinedRefund,
} from '../../../../lib/shop-order-status';
import { browserOrigin, openStripeCheckout } from '../../../../lib/stripe-checkout';

const lineSchema = z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(999),
  pickupTime: z.string().min(1).max(40).optional(),
  pickupTimeZone: z.string().min(1).max(80).optional(),
  specialInstructions: z.string().max(500).optional(),
  cookingTemperature: z.string().max(120).optional(),
  allergies: z.array(z.string().max(60)).max(20).optional(),
});

const checkoutSchema = z.object({
  area: z.enum(CHECKOUT_AREAS),
  sellerId: z.string().uuid().optional(),
  lines: z.array(lineSchema).min(1).max(20),
  handoff: shopFulfillmentSchema.optional(),
  deliveryAddress: z.string().max(240).optional(),
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
  is_paused: boolean | null;
  username: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function shopForArea(area: CheckoutArea): ShopName | null {
  return checkoutAreaShop(area);
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
    .select('id, role, stripe_account_id, selling_removed, available_for_orders, is_paused, username')
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
  if (seller.is_paused === true) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This cook has paused their account.' });
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
    if (seller.available_for_orders !== true) {
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
  buyerId: string,
  sellerId: string,
  lines: z.infer<typeof lineSchema>[],
  deliveryAddress: string | undefined,
  reservePortions: boolean,
): Promise<QuotedLine[]> {
  const merged = new Map<string, z.infer<typeof lineSchema>>();
  for (const line of lines) {
    const existing = merged.get(line.productId);
    if (!existing) {
      merged.set(line.productId, { ...line });
      continue;
    }
    existing.quantity += line.quantity;
    if (!existing.pickupTime && line.pickupTime) existing.pickupTime = line.pickupTime;
    if (!existing.pickupTimeZone && line.pickupTimeZone) existing.pickupTimeZone = line.pickupTimeZone;
  }
  const priced: QuotedLine[] = [];
  for (const line of merged.values()) {
    const prepared = await prepareHomePlate(admin, {
      buyerId,
      sellerId,
      mealId: line.productId,
      quantity: line.quantity,
      pickupTime: line.pickupTime,
      pickupTimeZone: line.pickupTimeZone,
      specialInstructions: line.specialInstructions,
      deliveryAddress,
      reservePortions,
    });
    priced.push({
      name: prepared.mealName,
      quantity: prepared.quantity,
      unitPrice: prepared.chargedBase / prepared.quantity,
      lineTotal: prepared.chargedBase,
      productId: line.productId,
    });
  }
  return priced;
}

async function priceCheckout(
  admin: SupabaseClient,
  checkout: z.infer<typeof checkoutSchema>,
  sellerName: string,
  buyer: { buyerId: string; buyerRole?: string | null; buyerMembershipTier?: string | null },
  reservePortions: boolean,
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
    priced = await priceHomeLines(admin, buyer.buyerId, checkout.sellerId, checkout.lines, checkout.deliveryAddress, reservePortions);
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
    buyerRole: buyer.buyerRole,
    buyerMembershipTier: buyer.buyerMembershipTier,
  });
}

async function loadBuyerFeeProfile(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from('profiles').select('role, membership_tier').eq('id', userId).maybeSingle();
  return {
    buyerId: userId,
    buyerRole: data?.role as string | null | undefined,
    buyerMembershipTier: data?.membership_tier as string | null | undefined,
  };
}

async function buildReceipt(
  admin: SupabaseClient,
  checkouts: z.infer<typeof checkoutSchema>[],
  buyer: { buyerId: string; buyerRole?: string | null; buyerMembershipTier?: string | null },
  reservePortions: boolean,
): Promise<QuotedCheckout[]> {
  const grouped = new Map<string, z.infer<typeof checkoutSchema>>();
  for (const checkout of checkouts) {
    const key = checkoutKey(checkout.area, checkout.sellerId ?? checkout.area);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...checkout, lines: [...checkout.lines] });
      continue;
    }
    existing.lines = [...existing.lines, ...checkout.lines];
    if (!existing.deliveryAddress && checkout.deliveryAddress) existing.deliveryAddress = checkout.deliveryAddress;
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
        buyerRole: buyer.buyerRole,
        buyerMembershipTier: buyer.buyerMembershipTier,
      }));
      continue;
    }
    const seller = await assertSellerCanTakeOrders(admin, checkout.sellerId, checkout.area);
    quoted.push(await priceCheckout(admin, checkout, seller.username || 'Seller', buyer, reservePortions));
  }
  const priced = quoteCard(quoted.map((checkout) => ({
    area: checkout.area,
    sellerId: checkout.sellerId,
    sellerName: checkout.sellerName,
    lines: checkout.lines,
    buyerRole: buyer.buyerRole,
    buyerMembershipTier: buyer.buyerMembershipTier,
  }))).checkouts;
  const delivered: QuotedCheckout[] = [];
  for (const checkout of priced) {
    const source = [...grouped.values()].find((item) => checkoutKey(item.area, item.sellerId ?? item.area) === checkout.id);
    if (!source) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a pickup, drop-off, or table before this order is paid.' });
    }
    const handed = await applyShopDelivery(admin, checkout, readHandoff(source.area, source.handoff));
    delivered.push(source.area === 'home' && source.deliveryAddress
      ? await applyHomeDelivery(admin, handed, source.deliveryAddress)
      : handed);
  }
  return delivered;
}

const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readHandoff(area: CheckoutArea, handoff: ShopFulfillment | undefined): ShopFulfillment | null {
  try {
    return assertShopHandoff(area, handoff);
  } catch (error) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error instanceof Error ? error.message : 'Choose a pickup, drop-off, or table before this order is paid.',
    });
  }
}

async function applyShopDelivery(
  admin: SupabaseClient,
  checkout: QuotedCheckout,
  handoff: ShopFulfillment | null,
): Promise<QuotedCheckout> {
  if (!handoff || !fulfillmentIsDelivery(handoff) || !SELLER_ID.test(checkout.sellerId)) return checkout;
  const fee = await savedDeliveryFee(admin, checkout.sellerId);
  const priced = orderTotalWithDelivery(checkout.buyerPays, checkout.sellerPayout, fee);
  return {
    ...checkout,
    buyerPays: priced.buyerPays,
    sellerPayout: priced.sellerReceives,
    platformKeeps: appRevenueWithDelivery(checkout.platformKeeps, fee),
  };
}

function handoffForQuoted(
  checkouts: z.infer<typeof checkoutSchema>[],
  quoted: QuotedCheckout,
): ShopFulfillment {
  const source = checkouts.find((item) => checkoutKey(item.area, item.sellerId ?? item.area) === quoted.id);
  const handoff = source ? readHandoff(source.area, source.handoff) : null;
  if (!handoff) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a pickup, drop-off, or table before this order is paid.' });
  }
  return handoff;
}

async function insertShopRecord(
  admin: SupabaseClient,
  buyerId: string,
  checkout: QuotedCheckout,
  paymentIntentId: string,
  handoff: ShopFulfillment,
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
    fulfillment: handoff,
    sellerId: checkout.sellerId,
    status: 'pending',
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

async function applyHomeDelivery(
  admin: SupabaseClient,
  checkout: QuotedCheckout,
  address: string,
): Promise<QuotedCheckout> {
  const trimmed = address.trim();
  if (trimmed.length < 8) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter the delivery address.' });
  }
  if (!SELLER_ID.test(checkout.sellerId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This cook has not set a delivery fee, so delivery cannot be selected.' });
  }
  const fee = await savedDeliveryFee(admin, checkout.sellerId);
  if (!(fee > 0)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This cook has not set a delivery fee, so delivery cannot be selected.',
    });
  }
  const priced = orderTotalWithDelivery(checkout.buyerPays, checkout.sellerPayout, fee);
  return {
    ...checkout,
    buyerPays: priced.buyerPays,
    sellerPayout: priced.sellerReceives,
    platformKeeps: appRevenueWithDelivery(checkout.platformKeeps, fee),
  };
}

async function insertHomeOrders(
  admin: SupabaseClient,
  stripeSecretKey: string,
  buyerId: string,
  checkout: QuotedCheckout,
  paymentIntentId: string,
  sourceLines: z.infer<typeof lineSchema>[],
  deliveryAddress: string | undefined,
  chargeBases: number[],
  paymentAmountCents: number,
): Promise<string[]> {
  const ids: string[] = [];
  let lostPortion = false;
  for (const line of checkout.lines) {
    if (!line.productId) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The card was charged, but the plate order was not saved. Retry confirm to finish it.' });
    }
    const source = sourceLines.find((item) => item.productId === line.productId);
    const prepared = await prepareHomePlate(admin, {
      buyerId,
      sellerId: checkout.sellerId,
      mealId: line.productId,
      quantity: line.quantity,
      pickupTime: source?.pickupTime,
      pickupTimeZone: source?.pickupTimeZone,
      specialInstructions: source?.specialInstructions,
      deliveryAddress,
      reservePortions: false,
    });
    const chargedBase = Math.round(quotedLineAmount(line) * 100) / 100;
    const insertOrder = (withZone: boolean) => admin.from('orders').insert({
      meal_id: line.productId,
      buyer_id: buyerId,
      seller_id: checkout.sellerId,
      quantity: prepared.quantity,
      total_price: chargedBase,
      paid: true,
      status: 'pending',
      payment_intent_id: paymentIntentId,
      special_instructions: prepared.instructions || null,
      cooking_temperature: source?.cookingTemperature || null,
      allergies: source?.allergies || [],
      delivery_address: prepared.deliveryAddress,
      pickup_time: prepared.pickupTime,
      ...(withZone && prepared.pickupTimeZone ? { pickup_timezone: prepared.pickupTimeZone } : {}),
    }).select('id').single();
    let inserted = await insertOrder(true);
    if (inserted.error && prepared.pickupTimeZone && /pickup_timezone/.test(inserted.error.message || '')) {
      inserted = await insertOrder(false);
    }
    if (inserted.error || !inserted.data) {
      console.error('[CombinedCheckout] Home order insert failed:', inserted.error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The card was charged, but the plate order was not saved. Retry confirm to finish it.' });
    }
    const orderId = inserted.data.id as string;
    ids.push(orderId);
    const over = await thisOrderExceedsPortions(admin, line.productId, orderId, prepared.portionCap);
    if (over == null || over) {
      lostPortion = true;
      break;
    }
  }
  if (!lostPortion) return ids;

  let refunded = false;
  try {
    const cents = sharedChargeRefundCents(checkout.baseAmount, chargeBases, paymentAmountCents);
    if (cents > 0) {
      await refundChargeCents(stripeSecretKey, paymentIntentId, cents);
      refunded = true;
    }
  } catch (error) {
    console.error('[CombinedCheckout] A portion refund was not finished. The order stays open:', error);
  }
  if (!refunded) return ids;
  const closed = await admin.from('orders').update({ status: 'cancelled', paid: false }).in('id', ids);
  if (closed.error) {
    console.error('[CombinedCheckout] The refund went through and the plate order is still open:', closed.error.message);
    return ids;
  }
  try {
    await notifyParty(admin, buyerId, 'paymentAlerts', {
      title: 'Portions',
      body: 'Those portions were already taken. This charge was refunded.',
    });
  } catch (error) {
    console.error('[CombinedCheckout] Portion notice was not sent:', error);
  }
  return [];
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
    payout_release_at: orderId ? null : payoutReleaseAt(),
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

export const getAreaStoresProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from('audit_logs')
      .select('new_data, created_at')
      .eq('user_id', ctx.userId)
      .eq('action', 'AREA_STORE')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error || !data) return [] as { area: string; open: boolean }[];
    const seen = new Set<string>();
    const stores: { area: string; open: boolean }[] = [];
    for (const row of data) {
      const payload = row.new_data && typeof row.new_data === 'object' ? row.new_data as { area?: unknown; open?: unknown } : {};
      if (typeof payload.area !== 'string' || typeof payload.open !== 'boolean' || seen.has(payload.area)) continue;
      seen.add(payload.area);
      stores.push({ area: payload.area, open: payload.open });
    }
    return stores;
  });

export const createCombinedCheckoutProcedure = protectedProcedure
  .input(combinedInput.extend({
    webOrigin: z.string().url().optional(),
    returnPath: z.string().max(180).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error('Stripe secret key not configured');

    await assertBuyerCanOrder(ctx.supabaseAdmin, ctx.userId);
    const sellerIds = [...new Set(input.checkouts.flatMap((checkout) => checkout.sellerId ? [checkout.sellerId] : []))];
    for (const sellerId of sellerIds) {
      await assertBuyerCanOrder(ctx.supabaseAdmin, ctx.userId, sellerId);
    }
    const homeSellerIds = [...new Set(input.checkouts.flatMap((checkout) => (
      checkout.area === 'home' && checkout.sellerId ? [checkout.sellerId] : []
    )))];
    if (homeSellerIds.length > 0) {
      const buyerMetro = await ctx.supabaseAdmin.from('profiles').select('metro_area').eq('id', ctx.userId).maybeSingle();
      const cooks = await ctx.supabaseAdmin.from('profiles').select('id, metro_area').in('id', homeSellerIds);
      if (buyerMetro.error || cooks.error || (cooks.data || []).length !== homeSellerIds.length) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your saved metro could not be checked. The order was not placed.' });
      }
      const buyerArea = typeof buyerMetro.data?.metro_area === 'string' ? buyerMetro.data.metro_area : '';
      const outside = (cooks.data || []).some((cook) => !buyerMetroCanOrder(cook.metro_area, buyerArea));
      if (outside) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: buyerArea.trim()
            ? 'This plate is outside your saved metro.'
            : 'Save your metro before ordering a plate.',
        });
      }
    }

    const buyer = await loadBuyerFeeProfile(ctx.supabaseAdmin, ctx.userId);
    const quoted = await buildReceipt(ctx.supabaseAdmin, input.checkouts, buyer, true);
    const receipt = quoteCombined(quoted);
    if (receipt.combinedBuyerPays <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This checkout has nothing to charge.' });
    }

    if (input.webOrigin) {
      const origin = browserOrigin(input.webOrigin);
      const path = input.returnPath && input.returnPath.startsWith('/') && !input.returnPath.startsWith('//') && !input.returnPath.includes('..')
        ? input.returnPath
        : '/combined-checkout';
      const checkout = await openStripeCheckout({
        secretKey: stripeSecretKey,
        amountCents: Math.round(receipt.combinedBuyerPays * 100),
        productName: 'HomeCookedPlate combined order',
        successUrl: `${origin}${path}?webpay=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${path}?webpay=cancel`,
        metadata: {
          buyer_id: ctx.userId,
          checkout_count: String(quoted.length),
          checkout_ids: quoted.map((checkout) => checkout.id).join(',').slice(0, 480),
        },
      });
      return {
        paymentIntentId: checkout.paymentIntentId,
        clientSecret: '',
        checkoutUrl: checkout.url,
        receipt,
      };
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
      checkoutUrl: null,
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
      const buyer = await loadBuyerFeeProfile(ctx.supabaseAdmin, ctx.userId);
      const quoted = await buildReceipt(ctx.supabaseAdmin, input.checkouts, buyer, false);
      return { paymentIntentId: input.paymentIntentId, receipt: quoteCombined(quoted), alreadyRecorded: true, refundedSellerIds: [] as string[] };
    }

    const buyer = await loadBuyerFeeProfile(ctx.supabaseAdmin, ctx.userId);
    const quoted = await buildReceipt(ctx.supabaseAdmin, input.checkouts, buyer, false);
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

    const chargeBases = quoted.map((item) => item.baseAmount);
    const refundedSellerIds: string[] = [];
    for (const checkout of quoted) {
      if (checkout.area === 'home') {
        const sources = input.checkouts.filter((item) => item.area === 'home' && item.sellerId === checkout.sellerId);
        const orderIds = await insertHomeOrders(
          ctx.supabaseAdmin,
          stripeSecretKey,
          ctx.userId,
          checkout,
          input.paymentIntentId,
          sources.flatMap((item) => item.lines),
          sources.find((item) => item.deliveryAddress)?.deliveryAddress,
          chargeBases,
          paymentIntent.amount,
        );
        if (orderIds.length === 0) {
          refundedSellerIds.push(checkout.sellerId);
          continue;
        }
        const foodBuyer = checkout.baseAmount + checkout.buyerFee;
        const foodSeller = checkout.baseAmount - checkout.sellerFee;
        const foodPlatform = checkout.buyerFee + checkout.sellerFee;
        const deliveryBuyer = Math.round((checkout.buyerPays - foodBuyer) * 100) / 100;
        const deliverySeller = Math.round((checkout.sellerPayout - foodSeller) * 100) / 100;
        const deliveryPlatform = Math.round((checkout.platformKeeps - foodPlatform) * 100) / 100;
        for (let index = 0; index < orderIds.length; index += 1) {
          const line = checkout.lines[index];
          const lineBase = line ? Math.round(quotedLineAmount(line) * 100) / 100 : checkout.baseAmount;
          const share = checkout.baseAmount > 0 ? lineBase / checkout.baseAmount : 0;
          const first = index === 0;
          const plateCheckout = {
            ...checkout,
            baseAmount: lineBase,
            buyerFee: Math.round(checkout.buyerFee * share * 100) / 100,
            sellerFee: Math.round(checkout.sellerFee * share * 100) / 100,
            buyerPays: Math.round((foodBuyer * share + (first ? deliveryBuyer : 0)) * 100) / 100,
            sellerPayout: Math.round((foodSeller * share + (first ? deliverySeller : 0)) * 100) / 100,
            platformKeeps: Math.round((foodPlatform * share + (first ? deliveryPlatform : 0)) * 100) / 100,
          };
          await holdPayout(ctx.supabaseAdmin, ctx.userId, plateCheckout, input.paymentIntentId, orderIds[index]);
          await notifyCookOfPayment(ctx.supabaseAdmin, checkout.sellerId, plateCheckout.buyerPays);
        }
        continue;
      }
      const orderId = await insertShopRecord(
        ctx.supabaseAdmin,
        ctx.userId,
        checkout,
        input.paymentIntentId,
        handoffForQuoted(input.checkouts, checkout),
      );
      if (input.checkouts.some((item) => item.sellerId === checkout.sellerId)) {
        await holdPayout(ctx.supabaseAdmin, ctx.userId, checkout, input.paymentIntentId, null);
      }
      if (orderId) await notifyCookOfPayment(ctx.supabaseAdmin, checkout.sellerId, checkout.buyerPays);
    }

    return { paymentIntentId: input.paymentIntentId, receipt, alreadyRecorded: false, refundedSellerIds };
  });

async function cancelCombinedShopOrder(
  admin: SupabaseClient,
  paymentIntentId: string,
  area: CheckoutArea,
  sellerId: string,
) {
  const areaShop = shopForArea(area);
  let failed = false;
  const shops = await admin
    .from('shop_orders')
    .select('id, shop, lines')
    .eq('payment_intent_id', paymentIntentId);
  if (!shops.error) {
    for (const row of shops.data ?? []) {
      if (!shopOrderMatchesCombinedRefund({
        lines: row.lines,
        rowShop: typeof row.shop === 'string' ? row.shop : null,
        area,
        areaShop,
        sellerId,
      })) continue;
      const closed = await admin.from('shop_orders').update({
        lines: cancelledShopLines(row.lines),
        paid: false,
      }).eq('id', row.id);
      if (closed.error) failed = true;
    }
  } else if (!/shop_orders/i.test(shops.error.message || '')) {
    failed = true;
  }

  const audits = await admin
    .from('audit_logs')
    .select('id, new_data')
    .eq('action', 'SHOP_ORDER')
    .filter('new_data->>payment_intent_id', 'eq', paymentIntentId);
  if (!audits.error) {
    for (const row of audits.data ?? []) {
      if (!auditShopMatchesCombinedRefund(row.new_data, area, sellerId)) continue;
      const closed = await admin.from('audit_logs').update({
        new_data: cancelledAuditShop(row.new_data),
      }).eq('id', row.id);
      if (closed.error) failed = true;
    }
  }

  if (failed) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'The refund was sent, but this shop order is still open.',
    });
  }
}

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
      .select('id, seller_id, buyer_id, seller_payout, base_price, status, order_id, metadata, payment_intent_id')
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
    let buyerId = '';
    let refunded = false;
    for (const row of rows) {
      if (row.status === 'refunded') {
        refunded = true;
        if (!buyerId && typeof row.buyer_id === 'string') buyerId = row.buyer_id;
        continue;
      }
      if (!buyerId && typeof row.buyer_id === 'string') buyerId = row.buyer_id;
      const baseAmount = Number(row.base_price);
      const result = await refundCookSale(ctx.supabaseAdmin, stripeSecretKey, {
        orderId: row.order_id || '',
        sellerId: input.sellerId,
        paymentIntentId: input.paymentIntentId,
        baseAmount,
        transactionId: row.id as string,
      });
      refunded = true;
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

    if (refunded && input.area === 'home') {
      await ctx.supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', paid: false })
        .eq('payment_intent_id', input.paymentIntentId)
        .eq('seller_id', input.sellerId);
    }
    if (refunded && input.area !== 'home') {
      await cancelCombinedShopOrder(ctx.supabaseAdmin, input.paymentIntentId, input.area, input.sellerId);
    }

    if (refundId && buyerId) {
      try {
        await notifyParty(ctx.supabaseAdmin, buyerId, 'orderUpdates', {
          title: 'Order update',
          body: 'This order was refunded.',
        });
      } catch (noticeError) {
        console.error('[CombinedRefund] Notice was not sent:', noticeError);
      }
    }

    return {
      refundId,
      refundAmount: Math.round(refundAmount * 100) / 100,
      platformFeeKept: Math.round(platformFeeKept * 100) / 100,
      message: 'That checkout was refunded for the seller share. The other checkouts on this charge stay paid, and HomeCookedPlate keeps the fees on the refunded checkout.',
    };
  });
