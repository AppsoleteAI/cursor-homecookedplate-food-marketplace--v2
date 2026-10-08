import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import {
  PAYOUT_HOLD_DAYS,
  PLATEMAKER_RESPONSIBILITY_STATEMENT,
  REMOVAL_THRESHOLDS,
  RESPONSIBILITY_WINDOW_DAYS,
  warningReasons,
} from '../../../../lib/payout-policy';
import { countResponsibility, releaseDuePayouts } from '../../../../lib/stripe-marketplace';

export const getPayoutStandingProcedure = protectedProcedure.query(async ({ ctx }) => {
  const { data: profile, error } = await ctx.supabase
    .from('profiles')
    .select('role')
    .eq('id', ctx.userId)
    .single();

  if (error || profile?.role !== 'platemaker') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only platemakers can view payout standing' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (stripeSecretKey) {
    await releaseDuePayouts(ctx.supabaseAdmin, stripeSecretKey, ctx.userId);
  }

  const { data: standing } = await ctx.supabaseAdmin
    .from('profiles')
    .select('selling_removed, selling_removed_reason, stripe_account_id')
    .eq('id', ctx.userId)
    .single();

  const counts = await countResponsibility(ctx.supabaseAdmin, ctx.userId);

  const { data: payouts } = await ctx.supabaseAdmin
    .from('transactions')
    .select('id, order_id, seller_payout, status, payout_release_at, payout_settled_at, created_at')
    .eq('seller_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: messages } = await ctx.supabaseAdmin
    .from('platemaker_admin_messages')
    .select('id, sender_role, body, created_at')
    .eq('platemaker_id', ctx.userId)
    .order('created_at', { ascending: true })
    .limit(50);

  return {
    holdDays: PAYOUT_HOLD_DAYS,
    windowDays: RESPONSIBILITY_WINDOW_DAYS,
    thresholds: REMOVAL_THRESHOLDS,
    statement: PLATEMAKER_RESPONSIBILITY_STATEMENT,
    sellingRemoved: standing?.selling_removed === true,
    sellingRemovedReason: standing?.selling_removed_reason ?? null,
    stripeConnected: Boolean(standing?.stripe_account_id),
    counts,
    warnings: warningReasons(counts),
    payouts: (payouts ?? []).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      sellerPayout: Number(row.seller_payout),
      status: row.status,
      releaseAt: row.payout_release_at,
      settledAt: row.payout_settled_at,
      createdAt: row.created_at,
    })),
    messages: (messages ?? []).map((row) => ({
      id: row.id,
      senderRole: row.sender_role,
      body: row.body,
      createdAt: row.created_at,
    })),
  };
});
