import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { orderBuyerId, orderTotal } from "../../../../lib/order-row";
import { orderStatusAllowed, pickupConfirmedByBoth } from "../../../../lib/order-status";
import { payoutReleaseAt } from "../../../../lib/payout-policy";
import { notifyParty } from "../../../../lib/account-notice";
import { refundChargeCents, refundOpenCharge } from "../../../../lib/refund-card";
import { saleRefundCents } from "../../../../lib/fees";
import { unpackShopLines } from "../../../../lib/shop-fulfillment";

export const updateOrderStatusProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string(),
      status: z.enum(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data: order, error: checkError } = await ctx.supabase
      .from('orders')
      .select('*')
      .eq('id', input.orderId)
      .single();

    if (checkError || !order) {
      throw new Error('Order not found');
    }

    const buyerId = orderBuyerId(order);
    const role = order.seller_id === ctx.userId ? 'seller' : buyerId === ctx.userId ? 'buyer' : null;
    if (!role) {
      throw new Error('Not authorized to update this order');
    }
    if (!orderStatusAllowed(role, order.status, input.status)) {
      throw new Error(`This order is ${order.status}. That step is not available.`);
    }

    if (role === 'buyer' && input.status === 'cancelled' && order.paid === true) {
      const paymentIntentId = typeof order.payment_intent_id === 'string' ? order.payment_intent_id : '';
      if (!paymentIntentId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This paid order has no card charge to refund. It is still open.' });
      }
      const shared = await ctx.supabaseAdmin
        .from('orders')
        .select('id, status, total_price, total_price_cents')
        .eq('payment_intent_id', paymentIntentId)
        .neq('id', order.id);
      if (shared.error) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This order could not be cancelled. It is still open.' });
      }
      const otherPlateBases = (shared.data || [])
        .filter((row: { status?: string }) => row.status !== 'cancelled')
        .map((row: { total_price?: unknown; total_price_cents?: unknown }) => orderTotal(row))
        .filter((base: number) => base > 0);
      const shops = await ctx.supabaseAdmin
        .from('shop_orders')
        .select('base_amount, lines, paid')
        .eq('payment_intent_id', paymentIntentId);
      const shopMissing = shops.error && /shop_orders/i.test(shops.error.message || '');
      if (shops.error && !shopMissing) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This order could not be cancelled. It is still open.' });
      }
      const shopBases = shopMissing ? [] : (shops.data || []).flatMap((row: { base_amount?: unknown; lines?: unknown; paid?: boolean }) => {
        if (row.paid !== true) return [];
        try {
          if (unpackShopLines(row.lines).status === 'cancelled') return [];
        } catch {
          return [];
        }
        const base = Number(row.base_amount);
        return Number.isFinite(base) && base > 0 ? [base] : [];
      });
      const stripeKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The card refund could not be started. This order is still open.' });
      }
      const sharedCharge = otherPlateBases.length > 0 || shopBases.length > 0;
      try {
        await refundChargeCents(stripeKey, paymentIntentId, saleRefundCents(orderTotal(order)));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!sharedCharge && /not ready to refund this order alone/i.test(message)) {
          try {
            await refundOpenCharge(stripeKey, paymentIntentId);
          } catch {
            throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The card refund did not go through. This order is still open.' });
          }
        } else {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The card refund did not go through. This order is still open.' });
        }
      }
      const closed = await ctx.supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', paid: false })
        .eq('id', input.orderId)
        .select()
        .single();
      if (closed.error || !closed.data) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The card was refunded, but this order is still open.' });
      }
      await ctx.supabaseAdmin
        .from('transactions')
        .update({ status: 'refunded' })
        .eq('order_id', input.orderId)
        .eq('status', 'held');
      await notifyParty(ctx.supabaseAdmin, order.seller_id, 'orderUpdates', {
        title: 'Order update',
        body: 'This order was cancelled.',
      });
      return { id: closed.data.id, status: closed.data.status, waiting: false };
    }

    if (input.status === 'completed') {
      const prior = await ctx.supabaseAdmin
        .from('audit_logs')
        .select('new_data')
        .eq('action', 'PICKUP_CONFIRM')
        .eq('record_id', input.orderId);
      if (prior.error) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Pickup could not be confirmed. This order is still ready.' });
      }
      const roles = (prior.data || [])
        .map((row: { new_data?: { role?: string } }) => row.new_data?.role)
        .filter((value: string | undefined): value is 'buyer' | 'seller' => value === 'buyer' || value === 'seller');
      if (!roles.includes(role)) {
        const saved = await ctx.supabaseAdmin.from('audit_logs').insert({
          user_id: ctx.userId,
          action: 'PICKUP_CONFIRM',
          table_name: 'orders',
          record_id: input.orderId,
          new_data: { role },
        });
        if (saved.error) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Pickup could not be confirmed. This order is still ready.' });
        }
        roles.push(role);
      }
      if (!pickupConfirmedByBoth(roles)) {
        const otherId = role === 'seller' ? buyerId : order.seller_id;
        try {
          await notifyParty(ctx.supabaseAdmin, otherId, 'orderUpdates', {
            title: 'Confirm pickup',
            body: 'The other person confirmed pickup. Confirm it too so this order can close.',
          });
        } catch (noticeError) {
          console.error('[UpdateOrderStatus] Pickup notice was not sent:', noticeError);
        }
        return { id: order.id, status: order.status, waiting: true };
      }
    }

    const { data, error } = await ctx.supabase
      .from('orders')
      .update({ status: input.status })
      .eq('id', input.orderId)
      .select()
      .single();

    if (error || !data) {
      console.error('[UpdateOrderStatus] Error:', error);
      throw new Error(error?.message || 'Failed to update order status');
    }

    const otherId = role === 'seller' ? buyerId : order.seller_id;
    if (input.status === 'ready' || input.status === 'completed' || input.status === 'cancelled') {
      const body = input.status === 'ready'
        ? 'This order is ready for pickup.'
        : input.status === 'completed'
          ? 'This order was marked picked up.'
          : 'This order was cancelled.';
      await notifyParty(ctx.supabaseAdmin, otherId, 'orderUpdates', {
        title: 'Order update',
        body,
      });
    }

    if (input.status === 'completed') {
      const { error: payoutError } = await ctx.supabaseAdmin
        .from('transactions')
        .update({ payout_release_at: payoutReleaseAt() })
        .eq('order_id', input.orderId)
        .eq('status', 'held')
        .is('payout_release_at', null);
      if (payoutError) {
        console.error('[UpdateOrderStatus] Payout clock was not started:', payoutError.message);
      }
    }

    return {
      id: data.id,
      status: data.status,
      waiting: false,
    };
  });
