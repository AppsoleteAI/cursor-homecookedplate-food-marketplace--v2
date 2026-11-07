import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { finalPlateReceipt } from '../../../../lib/fees';
import { missingBuyerColumn, orderBuyerId, orderTotal } from '../../../../lib/order-row';
import { resolvedMembershipTier } from '../../../../lib/trial-access';
import { receiptAmountForRole } from '../../../../lib/state-meal-plan';
import { CHECKOUT_AREA_LABEL, checkoutAreaFromTags } from '../../../../lib/combined-checkout';

const NOT_FINAL = 'The final receipt is ready after both people acknowledge the food was paid for and received.';

type OrderRow = {
  id?: string;
  buyer_id?: string | null;
  platetaker_id?: string | null;
  seller_id?: string | null;
  total_price?: number | null;
  total_price_cents?: number | null;
  status?: string | null;
  paid?: boolean | null;
  meal_id?: string | null;
  quantity?: number | null;
  payment_intent_id?: string | null;
};

type ReceiptFees = ReturnType<typeof finalPlateReceipt>;

type ReceiptLine = {
  mealName: string;
  quantity: number;
  areaLabel: string | null;
  baseAmount: number;
  sellerPayout: number;
};

export const finalReceiptProcedure = protectedProcedure
  .input(z.object({ orderId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    let order = await ctx.supabaseAdmin
      .from('orders')
      .select('id, buyer_id, seller_id, total_price, total_price_cents, status, paid, meal_id, quantity, payment_intent_id')
      .eq('id', input.orderId)
      .maybeSingle();
    if (order.error && missingBuyerColumn(order.error.message)) {
      order = await ctx.supabaseAdmin
        .from('orders')
        .select('id, platetaker_id, seller_id, total_price, total_price_cents, status, paid, meal_id, quantity, payment_intent_id')
        .eq('id', input.orderId)
        .maybeSingle();
    }
    if (order.error || !order.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    const orderRow = order.data as OrderRow;
    const buyerId = orderBuyerId(orderRow);
    const sellerId = String(orderRow.seller_id || '');
    const role = ctx.userId === sellerId ? 'platemaker' : ctx.userId === buyerId ? 'platetaker' : null;
    if (!role) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot view this receipt.' });
    }
    if (orderRow.paid !== true || orderRow.status !== 'completed') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: NOT_FINAL });
    }

    const buyer = await loadBuyer(ctx.supabaseAdmin, buyerId);
    const tier = buyer ? resolvedMembershipTier(buyer) : 'free';
    const buyerRole = buyer?.role || 'platetaker';
    const rows = await completedCardOrders(ctx.supabaseAdmin, orderRow);
    const cardBase = rows.reduce((sum: number, row: OrderRow) => sum + orderTotal(row), 0);
    const priced: { row: OrderRow; fees: ReceiptFees }[] = rows.map((row: OrderRow) => ({
      row,
      fees: finalPlateReceipt({
        totalPrice: orderTotal(row),
        buyerRole,
        buyerMembershipTier: tier,
        cardBase,
      }),
    }));
    const lines: ReceiptLine[] = [];
    for (const item of priced) {
      const meal = item.row.meal_id
        ? await ctx.supabaseAdmin.from('meals').select('name, tags').eq('id', item.row.meal_id).maybeSingle()
        : { data: null as { name?: string | null; tags?: string[] | null } | null };
      const area = checkoutAreaFromTags(meal.data?.tags);
      lines.push({
        mealName: meal.data?.name || 'Plate',
        quantity: Math.max(1, Math.round(Number(item.row.quantity) || 1)),
        areaLabel: area ? CHECKOUT_AREA_LABEL[area] : null,
        baseAmount: item.fees.baseAmount,
        sellerPayout: item.fees.sellerPayout,
      });
    }
    const fees = priced.find((item) => item.row.id === orderRow.id)?.fees
      || finalPlateReceipt({ totalPrice: orderTotal(orderRow), buyerRole, buyerMembershipTier: tier, cardBase });
    const combined = {
      baseAmount: roundMoney(priced.reduce((sum, item) => sum + item.fees.baseAmount, 0)),
      buyerFee: roundMoney(priced.reduce((sum, item) => sum + item.fees.buyerFee, 0)),
      sellerFee: roundMoney(priced.reduce((sum, item) => sum + item.fees.sellerFee, 0)),
      buyerPays: roundMoney(priced.reduce((sum, item) => sum + item.fees.totalCharge, 0)),
      sellerPayout: roundMoney(priced.reduce((sum, item) => sum + item.fees.sellerPayout, 0)),
    };
    const viewer = receiptAmountForRole(role, {
      buyerPays: combined.buyerPays,
      sellerPayout: fees.sellerPayout,
    });
    const opened = lines.find((line) => line.mealName === mealName(lines, orderRow, priced)) || lines[0];
    return {
      orderId: String(orderRow.id || input.orderId),
      mealName: opened?.mealName || 'Plate',
      quantity: opened?.quantity || 1,
      lines,
      role,
      baseAmount: combined.baseAmount,
      buyerFee: combined.buyerFee,
      sellerFee: combined.sellerFee,
      buyerPays: combined.buyerPays,
      sellerPayout: combined.sellerPayout,
      viewerLabel: viewer.label,
      viewerAmount: viewer.amount,
    };
  });

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function mealName(
  lines: { mealName: string }[],
  order: OrderRow,
  priced: { row: OrderRow }[],
): string {
  const match = priced.find((item) => item.row.id === order.id);
  const index = match ? priced.indexOf(match) : 0;
  return lines[index]?.mealName || lines[0]?.mealName || 'Plate';
}

async function completedCardOrders(
  admin: { from: (table: string) => any },
  order: OrderRow,
): Promise<OrderRow[]> {
  const intent = typeof order.payment_intent_id === 'string' ? order.payment_intent_id : '';
  if (!intent) return [order];
  const rows = await admin
    .from('orders')
    .select('id, buyer_id, platetaker_id, seller_id, total_price, total_price_cents, status, paid, meal_id, quantity, payment_intent_id')
    .eq('payment_intent_id', intent)
    .eq('paid', true)
    .eq('status', 'completed');
  const buyerId = orderBuyerId(order);
  const sameCard = ((rows.data || []) as OrderRow[]).filter((row) => orderBuyerId(row) === buyerId);
  return sameCard.length > 0 ? sameCard : [order];
}

async function loadBuyer(admin: { from: (table: string) => any }, buyerId: string) {
  const full = await admin
    .from('profiles')
    .select('role, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, apple_expires_at, apple_revoked_at, google_purchase_token, google_expires_at')
    .eq('id', buyerId)
    .maybeSingle();
  if (!full.error) return full.data;
  const short = await admin
    .from('profiles')
    .select('role, membership_tier, stripe_subscription_id')
    .eq('id', buyerId)
    .maybeSingle();
  return short.data;
}
