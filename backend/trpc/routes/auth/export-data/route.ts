import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { missingBuyerColumn, orderBuyerId, orderTotal } from '../../../../lib/order-row';
import { unpackShopLines } from '../../../../lib/shop-fulfillment';

export const exportMyDataProcedure = protectedProcedure.mutation(async ({ ctx }) => {
  const load = async (buyerColumn: 'buyer_id' | 'platetaker_id') => ctx.supabaseAdmin
    .from('orders')
    .select('*')
    .or(`${buyerColumn}.eq.${ctx.userId},seller_id.eq.${ctx.userId}`)
    .order('created_at', { ascending: false })
    .limit(200);

  let orders = await load('buyer_id');
  if (orders.error && missingBuyerColumn(orders.error.message)) {
    orders = await load('platetaker_id');
  }
  if (orders.error) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your orders could not be included.' });
  }

  const orderIds = (orders.data ?? []).map((order) => order.id as string);
  const messages = orderIds.length === 0
    ? { data: [] as { order_id: string; sender_role: string; text: string; created_at: string }[], error: null }
    : await ctx.supabaseAdmin
      .from('order_messages')
      .select('order_id, sender_role, text, created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })
      .limit(400);
  if (messages.error) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your messages could not be included.' });
  }

  const payments = await ctx.supabaseAdmin
    .from('transactions')
    .select('order_id, status, base_price, buyer_payment, seller_payout, created_at')
    .or(`buyer_id.eq.${ctx.userId},seller_id.eq.${ctx.userId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (payments.error) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your payments could not be included.' });
  }

  const shopSelect = 'id, buyer_id, shop, lines, base_amount, total_charge, paid, created_at';
  const asBuyer = await ctx.supabaseAdmin
    .from('shop_orders')
    .select(shopSelect)
    .eq('buyer_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(200);
  const asSeller = await ctx.supabaseAdmin
    .from('shop_orders')
    .select(shopSelect)
    .or(`lines->>sellerId.eq.${ctx.userId},lines->fulfillment->>sellerId.eq.${ctx.userId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  const shopError = asBuyer.error || asSeller.error;
  const shopMissing = shopError && /shop_orders/i.test(shopError.message || '');
  if (shopError && !shopMissing) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your shop orders could not be included.' });
  }
  const shopRows = new Map<string, {
    id: string;
    buyer_id?: string;
    shop?: string;
    lines?: unknown;
    base_amount?: number | string;
    total_charge?: number | string;
    paid?: boolean;
    created_at?: string;
  }>();
  if (!shopMissing) {
    for (const row of [...(asBuyer.data ?? []), ...(asSeller.data ?? [])]) {
      shopRows.set(row.id as string, row);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    shopOrders: [...shopRows.values()].map((row) => {
      const lines = unpackShopLines(row.lines);
      const fulfillment = lines.fulfillment && typeof lines.fulfillment === 'object'
        ? lines.fulfillment as { sellerId?: unknown }
        : null;
      const sellerId = lines.sellerId
        || (typeof fulfillment?.sellerId === 'string' ? fulfillment.sellerId : null);
      return {
        id: row.id,
        shop: row.shop,
        buyerId: row.buyer_id,
        sellerId,
        status: lines.status,
        paid: row.paid,
        baseAmount: Number(row.base_amount),
        totalCharge: Number(row.total_charge),
        createdAt: row.created_at,
      };
    }),
    orders: (orders.data ?? []).map((order) => ({
      id: order.id,
      mealId: order.meal_id,
      sellerId: order.seller_id,
      buyerId: orderBuyerId(order),
      status: order.status,
      paid: order.paid,
      totalPrice: orderTotal(order),
      pickupTime: order.pickup_time,
      deliveryAddress: order.delivery_address,
      createdAt: order.created_at,
    })),
    messages: messages.error ? [] : (messages.data ?? []),
    payments: payments.error ? [] : (payments.data ?? []),
  };
});
