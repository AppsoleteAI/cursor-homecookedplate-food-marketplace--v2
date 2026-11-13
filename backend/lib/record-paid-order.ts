import { appRevenueWithDelivery, buyerCardCharge, buyerServiceFeePercent, calculateFees, orderTotalWithDelivery, sharedChargeRefundCents } from './fees';
import { missingOrderColumn, orderBuyerId, orderCookId, orderTotal, readOrderQuery, writeOrderPatch } from './order-row';
import { portionsAlreadyTaken } from './plate-order-rules';
import { notifyCookOfPayment, notifyParty } from './account-notice';
import { portionsFromTags } from '@/lib/meal-publish';
import { refundChargeCents } from './refund-card';

/** A lost portion closes only after that charge is refunded. */
export function lostPortionOrderCloses(refundSucceeded: boolean): boolean {
  return refundSucceeded === true;
}

export function listedPlateMetadata(metadata: { order_ids?: string; base_cents?: string } | null | undefined): {
  listedOrderIds: string[] | null;
  listedBaseCents: number | null;
} {
  const listedOrderIds = typeof metadata?.order_ids === 'string'
    ? metadata.order_ids.split(',').map((id) => id.trim()).filter(Boolean)
    : null;
  const base = Number(metadata?.base_cents);
  return {
    listedOrderIds,
    listedBaseCents: Number.isInteger(base) ? base : null,
  };
}

/** The Stripe charge matches the cook's plate prices on these orders, including the service fee and delivery. */
export function platePaymentCovers(input: {
  orderIds: string[];
  bases: number[];
  deliveryFee: number;
  amountCents: number;
  buyerRole: string | null | undefined;
  buyerTier: string | null | undefined;
  listedOrderIds?: string[] | null;
  listedBaseCents?: number | null;
}): boolean {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return false;
  const ids = [...input.orderIds].sort();
  if (input.listedOrderIds) {
    const listed = [...input.listedOrderIds].filter(Boolean).sort();
    if (listed.length !== ids.length || listed.some((id, index) => id !== ids[index])) return false;
  }
  const base = input.bases.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const baseCents = Math.round(base * 100);
  if (!(baseCents > 0)) return false;
  if (input.listedBaseCents != null && input.listedBaseCents !== baseCents) return false;
  const percents = new Set<number>([
    buyerServiceFeePercent({
      role: input.buyerRole,
      membershipTier: input.buyerTier,
      baseAmount: base,
    }),
    buyerServiceFeePercent({ role: 'platetaker', membershipTier: 'premium', baseAmount: base }),
    10,
  ]);
  const deliveryFee = Number.isFinite(input.deliveryFee) && input.deliveryFee > 0 ? input.deliveryFee : 0;
  for (const percent of percents) {
    const fees = calculateFees(base, percent, 10);
    const withDelivery = orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, deliveryFee);
    const card = buyerCardCharge(withDelivery.buyerPays);
    if (Math.round(card.cardCharge * 100) === input.amountCents) return true;
  }
  return false;
}

type Admin = {
  from: (table: string) => any;
};

type PaidOrderRow = {
  id: string;
  buyer_id?: string | null;
  platetaker_id?: string | null;
  seller_id?: string | null;
  platemaker_id?: string | null;
  meal_id?: string | null;
  quantity?: number | null;
  total_price?: number | string | null;
  total_price_cents?: number | null;
};

/**
 * Marks every plate order on this payment as paid and records a held payout.
 * The cook still has to accept. The 7-day payout clock stays empty until the order is cleared.
 */
export async function recordPlatePayment(
  admin: Admin,
  input: {
    paymentIntentId: string;
    chargeId?: string | null;
    transferId?: string | null;
    applicationFeeId?: string | null;
    currency?: string | null;
    deliveryFee?: number;
    amountCents?: number | null;
    listedOrderIds?: string[] | null;
    listedBaseCents?: number | null;
    stripeSecretKey?: string | null;
  },
): Promise<number> {
  const { data: existing, error } = await readOrderQuery((columns) => admin
    .from('orders')
    .select(columns)
    .eq('payment_intent_id', input.paymentIntentId));

  if (error) {
    throw new Error(error.message || 'Could not mark the order paid');
  }
  if (!existing || existing.length === 0) return 0;

  const buyerIdForFee = orderBuyerId(existing[0] || {});
  const { data: feeProfile } = buyerIdForFee
    ? await admin.from('profiles').select('role, membership_tier').eq('id', buyerIdForFee).maybeSingle()
    : { data: null };
  const covers = platePaymentCovers({
    orderIds: existing.map((order: { id: string }) => order.id),
    bases: existing.map((order: PaidOrderRow) => orderTotal(order)),
    deliveryFee: Number(input.deliveryFee ?? 0),
    amountCents: input.amountCents ?? 0,
    buyerRole: feeProfile?.role,
    buyerTier: feeProfile?.membership_tier,
    listedOrderIds: input.listedOrderIds,
    listedBaseCents: input.listedBaseCents,
  });
  if (!covers) {
    console.error('[PaidOrder] Stripe amount does not match these plate prices:', input.paymentIntentId);
    return 0;
  }

  const pending = [...existing].sort((a: { created_at?: string; id: string }, b: { created_at?: string; id: string }) => {
    const byTime = String(a.created_at || '').localeCompare(String(b.created_at || ''));
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  }) as (PaidOrderRow & { status?: string; paid?: boolean; created_at?: string })[];
  const mealIds = [...new Set(pending.map((order) => order.meal_id).filter((id): id is string => Boolean(id)))];
  const meals = mealIds.length === 0
    ? { data: [] as { id: string; tags?: string[] }[] }
    : await admin.from('meals').select('id, tags').in('id', mealIds);
  const tags = new Map((meals.data || []).map((meal: { id: string; tags?: string[] }) => [meal.id, meal.tags]));
  const accepted: typeof pending = [];
  const rejected: typeof pending = [];

  for (const order of pending) {
    if (order.status === 'cancelled') continue;
    if (order.paid === true && order.status !== 'cancelled') {
      accepted.push(order);
      continue;
    }
    const tagValue = order.meal_id ? tags.get(order.meal_id) : undefined;
    const cap = portionsFromTags(Array.isArray(tagValue) ? tagValue.filter((tag): tag is string => typeof tag === 'string') : undefined);
    const taken = order.meal_id ? await portionsAlreadyTaken(admin, order.meal_id) : null;
    const quantity = Math.max(0, Math.round(Number(order.quantity) || 0));
    if (taken == null || taken + quantity > cap) {
      rejected.push(order);
      continue;
    }
    const marked = await writeOrderPatch(
      (patch) => admin.from('orders').update(patch).eq('id', order.id),
      { paid: true, updated_at: new Date().toISOString() },
    );
    if (marked.error && !missingOrderColumn(marked.error.message, 'paid')) {
      rejected.push(order);
      continue;
    }
    accepted.push({ ...order, paid: true });
  }

  if (rejected.length > 0 && input.stripeSecretKey) {
    try {
      const intent = await fetch(`https://api.stripe.com/v1/payment_intents/${input.paymentIntentId}`, {
        headers: { Authorization: `Bearer ${input.stripeSecretKey}` },
      });
      const paymentIntent = intent.ok ? await intent.json() as { amount?: number } : { amount: 0 };
      const bases = pending.map((order) => orderTotal(order));
      for (const order of rejected) {
        try {
          const cents = sharedChargeRefundCents(orderTotal(order), bases, paymentIntent.amount ?? 0);
          if (cents <= 0) continue;
          await refundChargeCents(input.stripeSecretKey, input.paymentIntentId, cents);
          if (!lostPortionOrderCloses(true)) continue;
          let closed = await admin.from('orders').update({ status: 'cancelled', paid: false }).eq('id', order.id);
          if (closed.error && missingOrderColumn(closed.error.message, 'paid')) {
            closed = await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
          }
          if (closed.error) {
            console.error('[PaidOrder] The refund went through and the order is still open:', closed.error?.message);
            continue;
          }
          await notifyParty(admin, orderBuyerId(order), 'paymentAlerts', {
            title: 'Portions',
            body: 'Those portions were already taken. This charge was refunded.',
          });
        } catch (refundError) {
          console.error('[PaidOrder] A portion refund was not finished. The order stays open:', refundError);
        }
      }
    } catch (refundError) {
      console.error('[PaidOrder] A portion refund was not finished. The order stays open:', refundError);
    }
  }

  if (accepted.length === 0) return 0;
  const updatedOrders = accepted;
  const rows = updatedOrders;
  const chargedBase = rows.reduce((sum, order) => {
    const base = orderTotal(order);
    return Number.isFinite(base) && base > 0 ? sum + base : sum;
  }, 0);
  const buyerId = orderBuyerId(rows[0] || {});
  const { data: buyerProfile } = buyerId
    ? await admin.from('profiles').select('role, membership_tier').eq('id', buyerId).maybeSingle()
    : { data: null };
  const buyerPercent = buyerServiceFeePercent({
    role: buyerProfile?.role,
    membershipTier: buyerProfile?.membership_tier,
    baseAmount: chargedBase,
  });

  let deliveryApplied = false;
  for (const order of rows) {
    const { data: existingTx } = await admin
      .from('transactions')
      .select('id')
      .eq('order_id', order.id)
      .limit(1);
    if (existingTx && existingTx.length > 0) continue;

    const basePrice = orderTotal(order);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const fees = calculateFees(basePrice, buyerPercent, 10);
    const rawDelivery = !deliveryApplied ? Number(input.deliveryFee ?? 0) : 0;
    const deliveryFee = Number.isFinite(rawDelivery) && rawDelivery > 0 ? rawDelivery : 0;
    const withDelivery = orderTotalWithDelivery(fees.totalCharge, fees.sellerPayout, deliveryFee);
    if (withDelivery.levy.buyerPays > 0) deliveryApplied = true;

    const { error: transactionError } = await admin.from('transactions').insert({
      payment_intent_id: input.paymentIntentId,
      order_id: order.id,
      buyer_id: orderBuyerId(order),
      seller_id: orderCookId(order),
      meal_id: order.meal_id,
      base_price: Number(basePrice.toFixed(2)),
      buyer_payment: withDelivery.buyerPays,
      seller_payout: withDelivery.sellerReceives,
      app_revenue: appRevenueWithDelivery(fees.appTotalRevenue, deliveryFee),
      buyer_fee: Number(fees.buyerFee.toFixed(2)),
      seller_fee: Number(fees.sellerFee.toFixed(2)),
      total_fee: appRevenueWithDelivery(fees.appTotalRevenue, deliveryFee),
      stripe_charge_id: input.chargeId ?? null,
      stripe_transfer_id: input.transferId ?? null,
      stripe_application_fee_id: input.applicationFeeId ?? null,
      currency: input.currency || 'usd',
      quantity: order.quantity,
      status: 'held',
      payout_release_at: null,
    });
    if (transactionError) {
      console.error('[PaidOrder] Payout hold was not recorded:', transactionError.message);
    }
    await notifyCookOfPayment(admin, orderCookId(order), withDelivery.buyerPays);
  }

  return updatedOrders.length;
}
