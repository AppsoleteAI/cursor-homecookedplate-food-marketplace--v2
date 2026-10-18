import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import {
  PAYOUT_HOLD_DAYS,
  PLATEMAKER_RESPONSIBILITY_STATEMENT,
  REMOVAL_THRESHOLDS,
  RESPONSIBILITY_WINDOW_DAYS,
  SUPPORT_EMAIL,
  salesCapForCook,
  warningReasons,
} from '../../../../lib/payout-policy';
import { SALES_VOLUME } from '../../../../lib/fees';
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
    .select('selling_removed, selling_removed_reason, stripe_account_id, created_at')
    .eq('id', ctx.userId)
    .single();

  const counts = await countResponsibility(ctx.supabaseAdmin, ctx.userId);

  const { data: payouts } = await ctx.supabaseAdmin
    .from('transactions')
    .select('id, order_id, seller_payout, status, payout_release_at, payout_settled_at, created_at')
    .eq('seller_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: disputes } = await ctx.supabaseAdmin
    .from('platetaker_lost_disputes')
    .select('id, platetaker_id, fee_half_refunded, created_at')
    .eq('platemaker_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(30);

  const platetakerIds = [...new Set((disputes ?? []).map((row) => row.platetaker_id).filter(Boolean))];
  const { data: people } = platetakerIds.length
    ? await ctx.supabaseAdmin.from('profiles').select('id, username').in('id', platetakerIds)
    : { data: [] };
  const { data: blocks } = await ctx.supabaseAdmin
    .from('cook_buyer_blocks')
    .select('platetaker_id')
    .eq('platemaker_id', ctx.userId);
  const blockedIds = new Set((blocks ?? []).map((row) => row.platetaker_id));
  const names = new Map((people ?? []).map((row) => [row.id, row.username]));

  const { data: messages } = await ctx.supabaseAdmin
    .from('platemaker_admin_messages')
    .select('id, sender_role, body, created_at')
    .eq('platemaker_id', ctx.userId)
    .order('created_at', { ascending: true })
    .limit(50);

  const salesCap = salesCapForCook({
    accountStartedAt: new Date(standing?.created_at ?? Date.now()),
    chargebacks: counts.chargeback,
    complaints: counts.complaint,
  });
  const salesCapLine = `Paid sales stay within $${salesCap.weekly.toLocaleString('en-US')} in 7 days and $${salesCap.monthly.toLocaleString('en-US')} in 30 days. A chargeback or complaint returns the limit to $${SALES_VOLUME.WEEKLY_BASE.toLocaleString('en-US')} and $${SALES_VOLUME.MONTHLY_BASE.toLocaleString('en-US')} for 30 days. The ceiling is $${SALES_VOLUME.WEEKLY_MAX.toLocaleString('en-US')} and $${SALES_VOLUME.MONTHLY_MAX.toLocaleString('en-US')}.`;

  return {
    holdDays: PAYOUT_HOLD_DAYS,
    windowDays: RESPONSIBILITY_WINDOW_DAYS,
    thresholds: REMOVAL_THRESHOLDS,
    salesCap,
    statement: `${PLATEMAKER_RESPONSIBILITY_STATEMENT} ${salesCapLine}`,
    sellingRemoved: standing?.selling_removed === true,
    sellingRemovedReason: standing?.selling_removed_reason ?? null,
    stripeConnected: Boolean(standing?.stripe_account_id),
    supportEmail: SUPPORT_EMAIL,
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
    lostDisputes: (disputes ?? []).map((row) => ({
      id: row.id,
      platetakerId: row.platetaker_id,
      platetakerName: names.get(row.platetaker_id) || 'PlateTaker',
      halfRefunded: row.fee_half_refunded === true,
      blocked: blockedIds.has(row.platetaker_id),
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
