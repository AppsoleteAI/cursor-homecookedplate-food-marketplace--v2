import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateOrderSplit, LOST_DISPUTE_FEE_CENTS, LOST_DISPUTE_FEE_HALF_CENTS, sellerRefundAmount } from './fees';
import { sendExpoPushNotification } from './expo-push-notifications';
import { sendNoticeEmail } from './email';
import {
  PAYOUT_HOLD_DAYS,
  type LostDisputeOutcome,
  type ResponsibilityCounts,
  type ResponsibilityKind,
  eventNotice,
  lostDisputeBuyerNotice,
  lostDisputeCookNotice,
  lostDisputeOutcome,
  lostDisputeWindowStart,
  removalReasons,
  responsibilityWindowStart,
  warningNotice,
} from './payout-policy';

type TransactionRow = {
  id: string;
  seller_id: string;
  seller_payout: number | string;
  currency: string | null;
  payment_intent_id: string;
  order_id: string | null;
  status: string;
  stripe_transfer_id: string | null;
  stripe_charge_id: string | null;
};

async function stripeForm(
  stripeSecretKey: string,
  path: string,
  body: URLSearchParams,
  idempotencyKey?: string,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; json: Record<string, unknown>; text: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    ...extraHeaders,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { ok: response.ok, json, text };
}

export async function countResponsibility(
  supabaseAdmin: SupabaseClient,
  platemakerId: string,
): Promise<ResponsibilityCounts> {
  const { data, error } = await supabaseAdmin
    .from('platemaker_responsibility_events')
    .select('kind')
    .eq('platemaker_id', platemakerId)
    .gte('created_at', responsibilityWindowStart());

  if (error) {
    console.error('[Responsibility] Count failed:', error.message);
    return { refund: 0, chargeback: 0, complaint: 0, governmentRequest: 0 };
  }

  const counts: ResponsibilityCounts = { refund: 0, chargeback: 0, complaint: 0, governmentRequest: 0 };
  for (const row of data ?? []) {
    if (row.kind === 'refund') counts.refund += 1;
    if (row.kind === 'chargeback') counts.chargeback += 1;
    if (row.kind === 'complaint') counts.complaint += 1;
    if (row.kind === 'government_request') counts.governmentRequest += 1;
  }
  return counts;
}

export async function applyRemovalIfNeeded(
  supabaseAdmin: SupabaseClient,
  platemakerId: string,
): Promise<{ removed: boolean; reasons: string[] }> {
  const counts = await countResponsibility(supabaseAdmin, platemakerId);
  const reasons = removalReasons(counts);
  if (reasons.length === 0) return { removed: false, reasons };

  const reason = reasons.join(' ');
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      selling_removed: true,
      selling_removed_reason: reason,
      available_for_orders: false,
    })
    .eq('id', platemakerId);

  if (error) {
    console.error('[Responsibility] Removal update failed:', error.message);
  }
  return { removed: true, reasons };
}

async function notifyPlatemaker(
  supabaseAdmin: SupabaseClient,
  platemakerId: string,
  notice: { title: string; body: string },
): Promise<void> {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: platemakerId,
    title: notice.title,
    body: notice.body,
    type: 'responsibility',
    read: false,
  });
  if (error) {
    console.error('[Responsibility] Notice insert failed:', error.message);
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('expo_push_token')
    .eq('id', platemakerId)
    .single();

  if (profile?.expo_push_token) {
    await sendExpoPushNotification(profile.expo_push_token, {
      title: notice.title,
      body: notice.body,
      data: { type: 'responsibility' },
    });
  }
}

export async function recordResponsibilityEvent(
  supabaseAdmin: SupabaseClient,
  event: {
    platemakerId: string;
    kind: ResponsibilityKind;
    orderId?: string | null;
    stripeDisputeId?: string | null;
    note?: string | null;
    createdBy?: string | null;
  },
): Promise<boolean> {
  if (event.stripeDisputeId) {
    const { data: existing } = await supabaseAdmin
      .from('platemaker_responsibility_events')
      .select('id')
      .eq('stripe_dispute_id', event.stripeDisputeId)
      .maybeSingle();
    if (existing?.id) return true;
  }

  const { error } = await supabaseAdmin.from('platemaker_responsibility_events').insert({
    platemaker_id: event.platemakerId,
    kind: event.kind,
    order_id: event.orderId ?? null,
    stripe_dispute_id: event.stripeDisputeId ?? null,
    note: event.note ?? null,
    created_by: event.createdBy ?? null,
  });
  if (error) {
    console.error('[Responsibility] Event insert failed:', error.message);
    return false;
  }
  const removal = await applyRemovalIfNeeded(supabaseAdmin, event.platemakerId);
  const counts = await countResponsibility(supabaseAdmin, event.platemakerId);
  await notifyPlatemaker(
    supabaseAdmin,
    event.platemakerId,
    eventNotice(event.kind, counts, removal.removed),
  );
  if (!removal.removed) {
    const warning = warningNotice(counts);
    if (warning) await notifyPlatemaker(supabaseAdmin, event.platemakerId, warning);
  }
  return true;
}

export async function releaseDuePayouts(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  sellerId?: string,
): Promise<{ released: number; skipped: number }> {
  let query = supabaseAdmin
    .from('transactions')
    .select('id, seller_id, seller_payout, currency, payment_intent_id, order_id, status, stripe_transfer_id, stripe_charge_id')
    .eq('status', 'held')
    .lte('payout_release_at', new Date().toISOString())
    .limit(50);

  if (sellerId) query = query.eq('seller_id', sellerId);

  const { data, error } = await query;
  if (error) {
    console.error('[Payout] Held payout query failed:', error.message);
    return { released: 0, skipped: 0 };
  }

  let released = 0;
  let skipped = 0;
  for (const row of (data ?? []) as TransactionRow[]) {
    const profileQuery = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, selling_removed, dispute_fee_owed_cents')
      .eq('id', row.seller_id)
      .single();
    const profile = (profileQuery.error?.message?.includes('dispute_fee_owed_cents')
      ? (await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id, selling_removed')
        .eq('id', row.seller_id)
        .single()).data
      : profileQuery.data) as {
        stripe_account_id: string | null;
        selling_removed: boolean | null;
        dispute_fee_owed_cents?: number | null;
      } | null;

    if (!profile?.stripe_account_id || profile.selling_removed) {
      skipped += 1;
      continue;
    }

    const grossCents = Math.round(Number(row.seller_payout) * 100);
    if (!Number.isFinite(grossCents) || grossCents < 1) {
      skipped += 1;
      continue;
    }
    const owed = Math.max(0, Number(profile.dispute_fee_owed_cents) || 0);
    const withhold = Math.min(owed, grossCents);
    const cents = grossCents - withhold;

    let transferId: string | null = null;
    if (cents >= 1) {
      const transfer = await stripeForm(
        stripeSecretKey,
        'transfers',
        new URLSearchParams({
          amount: String(cents),
          currency: row.currency || 'usd',
          destination: profile.stripe_account_id,
          'metadata[transaction_id]': row.id,
          'metadata[order_id]': row.order_id ?? '',
          'metadata[payment_intent_id]': row.payment_intent_id,
          'metadata[hold_days]': String(PAYOUT_HOLD_DAYS),
          'metadata[dispute_fee_withheld_cents]': String(withhold),
        }),
        `settle_${row.id}`,
      );

      if (!transfer.ok || typeof transfer.json.id !== 'string') {
        console.error('[Payout] Transfer failed:', transfer.text);
        skipped += 1;
        continue;
      }
      transferId = transfer.json.id;
    }

    if (withhold > 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ dispute_fee_owed_cents: owed - withhold })
        .eq('id', row.seller_id);
    }

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'settled',
        stripe_transfer_id: transferId,
        payout_settled_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'held');

    if (updateError) {
      console.error('[Payout] Settled update failed:', updateError.message);
      skipped += 1;
      continue;
    }
    released += 1;
  }

  return { released, skipped };
}

async function reverseTransfer(
  stripeSecretKey: string,
  transferId: string,
  cents: number,
  idempotencyKey: string,
): Promise<void> {
  const reversal = await stripeForm(
    stripeSecretKey,
    `transfers/${transferId}/reversals`,
    new URLSearchParams({ amount: String(cents) }),
    idempotencyKey,
  );
  if (!reversal.ok) {
    console.error('[Payout] Transfer reversal failed:', reversal.text);
    throw new Error('Failed to pull the payout back from the cook Stripe account');
  }
}

export async function refundCookSale(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  input: {
    orderId: string;
    sellerId: string;
    paymentIntentId: string;
    baseAmount: number;
    transactionId?: string;
  },
): Promise<{ refundId: string; refundAmount: number; platformFeeKept: number }> {
  const split = calculateOrderSplit(input.baseAmount);
  const refundAmount = sellerRefundAmount(input.baseAmount);
  const refundCents = Math.round(refundAmount * 100);

  const transactionQuery = supabaseAdmin
    .from('transactions')
    .select('id, status, stripe_transfer_id, seller_payout, order_id');
  const { data: transaction } = input.transactionId
    ? await transactionQuery.eq('id', input.transactionId).maybeSingle()
    : await transactionQuery.eq('order_id', input.orderId).maybeSingle();

  if (transaction?.status === 'refunded') {
    throw new Error('This sale was already refunded');
  }

  const refund = await stripeForm(
    stripeSecretKey,
    'refunds',
    new URLSearchParams({
      payment_intent: input.paymentIntentId,
      amount: String(refundCents),
    }),
    input.transactionId ? `refund_tx_${input.transactionId}` : `refund_order_${input.orderId}`,
  );

  if (!refund.ok || typeof refund.json.id !== 'string') {
    console.error('[Refund] Stripe refund failed:', refund.text);
    throw new Error('Failed to process refund. Please contact support.');
  }

  if (transaction?.status === 'settled' && transaction.stripe_transfer_id) {
    const payoutCents = Math.round(Number(transaction.seller_payout) * 100);
    await reverseTransfer(
      stripeSecretKey,
      transaction.stripe_transfer_id,
      payoutCents,
      `reverse_${transaction.id}`,
    );
  }

  if (transaction?.id) {
    await supabaseAdmin
      .from('transactions')
      .update({ status: 'refunded' })
      .eq('id', transaction.id);
  }

  await recordResponsibilityEvent(supabaseAdmin, {
    platemakerId: input.sellerId,
    kind: 'refund',
    orderId: transaction?.order_id || input.orderId || null,
    note: 'Cook refunded the buyer their payout share. Platform fees stay with HomeCookedPlate.',
    createdBy: input.sellerId,
  });

  return {
    refundId: refund.json.id,
    refundAmount,
    platformFeeKept: split.appRevenue,
  };
}

type DisputeObject = {
  id?: string;
  charge?: string;
  payment_intent?: string;
  reason?: string;
  status?: string;
};

export async function handleChargeDispute(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  dispute: DisputeObject,
): Promise<void> {
  if (!dispute.id) return;

  const paymentIntentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : null;

  let rows: TransactionRow[] = [];
  if (paymentIntentId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select('id, seller_id, seller_payout, currency, payment_intent_id, order_id, status, stripe_transfer_id, stripe_charge_id')
      .eq('payment_intent_id', paymentIntentId);
    rows = (data ?? []) as TransactionRow[];
  } else if (chargeId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select('id, seller_id, seller_payout, currency, payment_intent_id, order_id, status, stripe_transfer_id, stripe_charge_id')
      .eq('stripe_charge_id', chargeId);
    rows = (data ?? []) as TransactionRow[];
  }

  for (const row of rows) {
    if (row.status === 'settled' && row.stripe_transfer_id) {
      const cents = Math.round(Number(row.seller_payout) * 100);
      try {
        await reverseTransfer(stripeSecretKey, row.stripe_transfer_id, cents, `dispute_${dispute.id}_${row.id}`);
      } catch (error) {
        console.error('[Dispute] Reversal failed:', error);
      }
    }

    if (row.status === 'held' || row.status === 'settled') {
      await supabaseAdmin.from('transactions').update({ status: 'disputed' }).eq('id', row.id);
    }

    await recordResponsibilityEvent(supabaseAdmin, {
      platemakerId: row.seller_id,
      kind: 'chargeback',
      orderId: row.order_id,
      stripeDisputeId: dispute.id,
      note: dispute.reason ? `Card dispute: ${dispute.reason}` : 'Card dispute opened',
    });
  }
}

async function notifyUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  notice: { title: string; body: string },
): Promise<void> {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    title: notice.title,
    body: notice.body,
    type: 'responsibility',
    read: false,
  });
  if (error) console.error('[Dispute] Notice insert failed:', error.message);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('expo_push_token, email')
    .eq('id', userId)
    .single();

  if (profile?.expo_push_token) {
    await sendExpoPushNotification(profile.expo_push_token, {
      title: notice.title,
      body: notice.body,
      data: { type: 'lost_dispute' },
    });
  }
  if (profile?.email) {
    await sendNoticeEmail(profile.email, notice.title, notice.body);
  }
}

async function platformAccountId(stripeSecretKey: string): Promise<string | null> {
  const response = await fetch('https://api.stripe.com/v1/account', {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const json = await response.json() as { id?: string };
  return response.ok && typeof json.id === 'string' ? json.id : null;
}

async function debitCookDisputeFee(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  sellerId: string,
  disputeId: string,
): Promise<'stripe' | 'owed'> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, dispute_fee_owed_cents')
    .eq('id', sellerId)
    .single();

  const connected = profile?.stripe_account_id;
  const platformId = connected ? await platformAccountId(stripeSecretKey) : null;
  if (connected && platformId) {
    const debit = await stripeForm(
      stripeSecretKey,
      'transfers',
      new URLSearchParams({
        amount: String(LOST_DISPUTE_FEE_CENTS),
        currency: 'usd',
        destination: platformId,
        description: 'Lost dispute fee',
        'metadata[stripe_dispute_id]': disputeId,
      }),
      `dispute_fee_${disputeId}`,
      { 'Stripe-Account': connected },
    );
    if (debit.ok) return 'stripe';
    console.error('[Dispute] Cook fee debit failed:', debit.text);
  }

  const owed = Math.max(0, Number(profile?.dispute_fee_owed_cents) || 0) + LOST_DISPUTE_FEE_CENTS;
  await supabaseAdmin.from('profiles').update({ dispute_fee_owed_cents: owed }).eq('id', sellerId);
  return 'owed';
}

export async function refundHalfDisputeFee(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string | undefined,
  platemakerId: string,
  platetakerId: string,
): Promise<number> {
  const { data: disputes } = await supabaseAdmin
    .from('platetaker_lost_disputes')
    .select('id, fee_collected')
    .eq('platemaker_id', platemakerId)
    .eq('platetaker_id', platetakerId)
    .eq('fee_half_refunded', false);

  if (!disputes?.length) return 0;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, dispute_fee_owed_cents')
    .eq('id', platemakerId)
    .single();

  let owed = Math.max(0, Number(profile?.dispute_fee_owed_cents) || 0);
  let returned = 0;

  for (const dispute of disputes) {
    if (dispute.fee_collected === 'owed') {
      owed = Math.max(0, owed - LOST_DISPUTE_FEE_HALF_CENTS);
      returned += 1;
      await supabaseAdmin.from('platetaker_lost_disputes').update({ fee_half_refunded: true }).eq('id', dispute.id);
      continue;
    }
    if (!stripeSecretKey || !profile?.stripe_account_id) continue;
    const credit = await stripeForm(
      stripeSecretKey,
      'transfers',
      new URLSearchParams({
        amount: String(LOST_DISPUTE_FEE_HALF_CENTS),
        currency: 'usd',
        destination: profile.stripe_account_id,
        description: 'Half of a lost dispute fee, after blocking the PlateTaker',
        'metadata[lost_dispute_id]': dispute.id,
      }),
      `dispute_fee_half_${dispute.id}`,
    );
    if (!credit.ok) {
      console.error('[Dispute] Half fee refund failed:', credit.text);
      continue;
    }
    returned += 1;
    await supabaseAdmin.from('platetaker_lost_disputes').update({ fee_half_refunded: true }).eq('id', dispute.id);
  }

  await supabaseAdmin.from('profiles').update({ dispute_fee_owed_cents: owed }).eq('id', platemakerId);
  return returned;
}

export async function handleLostDispute(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  dispute: DisputeObject,
): Promise<void> {
  if (!dispute.id || dispute.status !== 'lost') return;

  const paymentIntentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : null;

  let row: { seller_id: string; order_id: string | null; buyer_id: string | null } | null = null;
  if (paymentIntentId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select('seller_id, order_id, buyer_id')
      .eq('payment_intent_id', paymentIntentId)
      .limit(1);
    row = data?.[0] ?? null;
  } else if (chargeId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select('seller_id, order_id, buyer_id')
      .eq('stripe_charge_id', chargeId)
      .limit(1);
    row = data?.[0] ?? null;
  }
  if (!row?.seller_id) return;

  let buyerId = row.buyer_id;
  if (!buyerId && row.order_id) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('buyer_id')
      .eq('id', row.order_id)
      .maybeSingle();
    buyerId = order?.buyer_id ?? null;
  }
  if (!buyerId) return;

  const { data: existing } = await supabaseAdmin
    .from('platetaker_lost_disputes')
    .select('id')
    .eq('stripe_dispute_id', dispute.id)
    .maybeSingle();
  if (existing?.id) return;

  const collected = await debitCookDisputeFee(supabaseAdmin, stripeSecretKey, row.seller_id, dispute.id);
  const { error: insertError } = await supabaseAdmin.from('platetaker_lost_disputes').insert({
    platetaker_id: buyerId,
    platemaker_id: row.seller_id,
    order_id: row.order_id,
    stripe_dispute_id: dispute.id,
    fee_cents: LOST_DISPUTE_FEE_CENTS,
    fee_collected: collected,
  });
  if (insertError) {
    if (insertError.code === '23505') return;
    console.error('[Dispute] Lost dispute insert failed:', insertError.message);
    return;
  }

  const { data: history } = await supabaseAdmin
    .from('platetaker_lost_disputes')
    .select('created_at')
    .eq('platetaker_id', buyerId)
    .gte('created_at', lostDisputeWindowStart());
  const outcome: LostDisputeOutcome = lostDisputeOutcome((history ?? []).map((item) => item.created_at));

  if (outcome.banned) {
    await supabaseAdmin.from('profiles').update({
      ordering_removed: true,
      ordering_removed_reason: outcome.accelerated && outcome.count < 4
        ? '2 lost disputes within 60 days. Banned on the 3rd lost dispute in a rolling 12 months.'
        : '4 lost disputes in a rolling 12 months.',
    }).eq('id', buyerId);
  }

  const { data: buyer } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', buyerId)
    .maybeSingle();
  const buyerName = buyer?.username || 'A PlateTaker';

  await notifyUser(supabaseAdmin, row.seller_id, lostDisputeCookNotice(buyerName));
  await notifyUser(supabaseAdmin, buyerId, lostDisputeBuyerNotice(outcome));
}
