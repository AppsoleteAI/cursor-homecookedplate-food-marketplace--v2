import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateOrderSplit, LOST_DISPUTE_FEE_CENTS, LOST_DISPUTE_FEE_HALF_CENTS, saleRefundCents, withholdFromPayout } from './fees';
import { sendExpoPushNotification } from './expo-push-notifications';
import { sendNoticeEmail } from './email';
import { confirmCookPayouts } from './connect-account';
import { unpackShopLines } from './shop-fulfillment';
import {
  BAN_FINAL_PAYOUT_DAYS,
  PAYOUT_HOLD_DAYS,
  type LostDisputeOutcome,
  type ResponsibilityCounts,
  type ResponsibilityKind,
  eventNotice,
  lostDisputeBuyerNotice,
  lostDisputeCookNotice,
  lostDisputeOutcome,
  lostDisputeWindowStart,
  finalPayoutAt,
  payoutReleaseAt,
  payoutRetryAt,
  removalReasons,
  RESPONSIBILITY_WINDOW_DAYS,
  responsibilityWindowStart,
  salesCapForCook,
  salesVolumeBlockMessage,
  SALES_WEEK_DAYS,
  stallAnchorRelease,
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
  created_at?: string | null;
  payout_release_at?: string | null;
  payout_attempt?: number | null;
  payout_next_attempt_at?: string | null;
  dispute_fee_withheld_cents?: number | null;
  dispute_fee_applied?: boolean | null;
  stripe_transfer_cents?: number | null;
};

const TRANSACTION_COLUMNS = 'id, seller_id, seller_payout, currency, payment_intent_id, order_id, status, stripe_transfer_id, stripe_charge_id, created_at, payout_release_at, payout_attempt, payout_next_attempt_at, dispute_fee_withheld_cents, dispute_fee_applied, stripe_transfer_cents';

export function transferredCents(row: {
  seller_payout: number | string;
  stripe_transfer_cents?: number | null;
  dispute_fee_withheld_cents?: number | null;
}): number {
  if (typeof row.stripe_transfer_cents === 'number' && Number.isFinite(row.stripe_transfer_cents)) {
    return Math.max(0, Math.round(row.stripe_transfer_cents));
  }
  const gross = Math.round(Number(row.seller_payout) * 100);
  const withheld = Math.max(0, Math.round(Number(row.dispute_fee_withheld_cents) || 0));
  if (!Number.isFinite(gross) || gross < 0) return 0;
  return Math.max(0, gross - withheld);
}

function transferFailureKind(text: string): 'balance' | 'account' {
  if (/balance_insufficient|insufficient|pending|source_transaction|available/i.test(text)) return 'balance';
  return 'account';
}

function rowIsDue(row: TransactionRow, nowIso: string, forced = false): boolean {
  if (row.status !== 'held') return false;
  if (row.payout_next_attempt_at && row.payout_next_attempt_at > nowIso) return false;
  if (forced) return true;
  if (!row.payout_release_at || row.payout_release_at > nowIso) return false;
  return true;
}

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

export async function salesVolumeBlock(
  supabaseAdmin: SupabaseClient,
  sellerId: string,
  nextSale: number,
): Promise<string | null> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('created_at')
    .eq('id', sellerId)
    .maybeSingle();
  if (profileError || !profile?.created_at) {
    return 'This cook’s sales limit could not be checked.';
  }

  const counts = await countResponsibility(supabaseAdmin, sellerId);
  const cap = salesCapForCook({
    accountStartedAt: new Date(profile.created_at),
    chargebacks: counts.chargeback,
    complaints: counts.complaint,
  });

  const since = new Date(Date.now() - RESPONSIBILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const weekStart = Date.now() - SALES_WEEK_DAYS * 24 * 60 * 60 * 1000;
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('base_price, status, created_at')
    .eq('seller_id', sellerId)
    .gte('created_at', since)
    .limit(2000);
  if (error) {
    console.error('[SalesCap] Volume query failed:', error.message);
    return 'This cook’s sales limit could not be checked.';
  }
  if ((data ?? []).length >= 2000) {
    return `This cook is at the $${cap.monthly.toLocaleString('en-US')} sales limit for 30 days.`;
  }

  let weeklySales = 0;
  let monthlySales = 0;
  for (const row of data ?? []) {
    if (row.status === 'refunded') continue;
    const amount = Number(row.base_price);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    monthlySales += amount;
    const created = new Date(row.created_at).getTime();
    if (Number.isFinite(created) && created >= weekStart) weeklySales += amount;
  }

  return salesVolumeBlockMessage(cap, weeklySales, monthlySales, nextSale);
}

export async function applyRemovalIfNeeded(
  supabaseAdmin: SupabaseClient,
  platemakerId: string,
): Promise<{ removed: boolean; reasons: string[] }> {
  const counts = await countResponsibility(supabaseAdmin, platemakerId);
  const reasons = removalReasons(counts);
  if (reasons.length === 0) return { removed: false, reasons };

  const reason = reasons.join(' ');
  const existing = await supabaseAdmin
    .from('profiles')
    .select('selling_removed, final_payout_at')
    .eq('id', platemakerId)
    .maybeSingle();
  const kept = existing.data?.selling_removed === true && typeof existing.data?.final_payout_at === 'string'
    ? existing.data.final_payout_at
    : finalPayoutAt();
  const patch: { selling_removed: boolean; selling_removed_reason: string; available_for_orders: boolean; final_payout_at?: string } = {
    selling_removed: true,
    selling_removed_reason: reason,
    available_for_orders: false,
    final_payout_at: kept,
  };
  let { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', platemakerId);
  if (error && /final_payout_at/i.test(error.message || '')) {
    delete patch.final_payout_at;
    const retry = await supabaseAdmin.from('profiles').update(patch).eq('id', platemakerId);
    error = retry.error;
  }

  if (error) {
    console.error('[Responsibility] Removal update failed:', error.message);
  } else if (patch.final_payout_at) {
    await delayHeldUntilFinal(supabaseAdmin, platemakerId, patch.final_payout_at);
  }
  return { removed: true, reasons };
}

async function delayHeldUntilFinal(
  supabaseAdmin: SupabaseClient,
  sellerId: string,
  finalAt: string,
): Promise<void> {
  if (finalAt <= new Date().toISOString()) return;
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, payout_release_at')
    .eq('seller_id', sellerId)
    .eq('status', 'held')
    .limit(200);
  if (error || !data) return;
  for (const row of data) {
    if (row.payout_release_at && row.payout_release_at >= finalAt) continue;
    await supabaseAdmin
      .from('transactions')
      .update({ payout_release_at: finalAt })
      .eq('id', row.id)
      .eq('status', 'held');
  }
}

async function holdBanPayouts(supabaseAdmin: SupabaseClient, sellerId?: string): Promise<void> {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, final_payout_at')
    .eq('selling_removed', true)
    .limit(50);
  if (sellerId) query = query.eq('id', sellerId);
  const { data, error } = await query;
  if (error) {
    if (!/final_payout_at/i.test(error.message || '')) {
      console.error('[Payout] Ban payout query failed:', error.message);
    }
    return;
  }
  for (const profile of data ?? []) {
    let finalAt = typeof profile.final_payout_at === 'string' ? profile.final_payout_at : '';
    if (!finalAt) {
      finalAt = finalPayoutAt();
      const saved = await supabaseAdmin
        .from('profiles')
        .update({ final_payout_at: finalAt })
        .eq('id', profile.id)
        .eq('selling_removed', true);
      if (saved.error) continue;
    }
    await delayHeldUntilFinal(supabaseAdmin, profile.id, finalAt);
  }
}

async function loadFinalSettlementRows(
  supabaseAdmin: SupabaseClient,
  sellerId: string | undefined,
  nowIso: string,
): Promise<TransactionRow[]> {
  let profiles = supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('selling_removed', true)
    .lte('final_payout_at', nowIso)
    .limit(50);
  if (sellerId) profiles = profiles.eq('id', sellerId);
  const { data, error } = await profiles;
  if (error || !data?.length) return [];
  const ids = data.map((row: { id?: string }) => row.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const held = await supabaseAdmin
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('status', 'held')
    .in('seller_id', ids)
    .limit(200);
  if (held.error) return [];
  return (held.data ?? []) as TransactionRow[];
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

async function deferPayout(
  supabaseAdmin: SupabaseClient,
  rowId: string,
  kind: 'balance' | 'account',
  message: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('transactions')
    .update({
      payout_next_attempt_at: payoutRetryAt(kind),
      payout_last_error: message.slice(0, 500),
    })
    .eq('id', rowId)
    .eq('status', 'held');
  if (error) console.error('[Payout] Retry time was not saved:', error.message);
}

async function scheduleStalledHolds(supabaseAdmin: SupabaseClient, sellerId?: string): Promise<void> {
  let query = supabaseAdmin
    .from('transactions')
    .select('id, seller_id, payment_intent_id, order_id, status, created_at, payout_release_at')
    .eq('status', 'held')
    .is('payout_release_at', null)
    .limit(100);
  if (sellerId) query = query.eq('seller_id', sellerId);
  const { data, error } = await query;
  if (error) {
    console.error('[Payout] Unscheduled hold query failed:', error.message);
    return;
  }

  const now = new Date();
  for (const row of (data ?? []) as TransactionRow[]) {
    let release: string | null = null;
    if (row.order_id) {
      const confirms = await supabaseAdmin
        .from('audit_logs')
        .select('created_at, new_data')
        .eq('action', 'PICKUP_CONFIRM')
        .eq('record_id', row.order_id);
      if (confirms.error) continue;
      let sellerAt: Date | null = null;
      let buyerAt: Date | null = null;
      for (const confirm of confirms.data ?? []) {
        const role = confirm.new_data && typeof confirm.new_data === 'object' ? (confirm.new_data as { role?: string }).role : '';
        const at = new Date(confirm.created_at);
        if (role === 'seller' && !sellerAt) sellerAt = at;
        if (role === 'buyer' && !buyerAt) buyerAt = at;
      }
      if (sellerAt && buyerAt) release = payoutReleaseAt(now);
      else release = stallAnchorRelease({ now, anchorAt: sellerAt });
    } else if (row.payment_intent_id) {
      const shop = await supabaseAdmin
        .from('shop_orders')
        .select('lines, paid')
        .eq('payment_intent_id', row.payment_intent_id)
        .limit(1);
      if (shop.error) {
        release = stallAnchorRelease({ now, anchorAt: row.created_at ? new Date(row.created_at) : null });
      } else {
        const packed = shop.data?.[0] ? unpackShopLines(shop.data[0].lines) : null;
        if (packed?.status === 'cancelled') {
          await supabaseAdmin.from('transactions').update({ status: 'refunded' }).eq('id', row.id).eq('status', 'held');
          continue;
        }
        if (packed?.status === 'completed') release = payoutReleaseAt(now);
        else release = stallAnchorRelease({ now, anchorAt: row.created_at ? new Date(row.created_at) : null });
      }
    }
    if (!release) continue;
    await supabaseAdmin
      .from('transactions')
      .update({ payout_release_at: release })
      .eq('id', row.id)
      .eq('status', 'held')
      .is('payout_release_at', null);
  }
}

async function applyRecordedDisputeFees(supabaseAdmin: SupabaseClient, sellerId?: string): Promise<void> {
  let query = supabaseAdmin
    .from('transactions')
    .select('id, seller_id, dispute_fee_withheld_cents, dispute_fee_applied, status')
    .eq('status', 'settled')
    .eq('dispute_fee_applied', false)
    .limit(50);
  if (sellerId) query = query.eq('seller_id', sellerId);
  const { data, error } = await query;
  if (error) return;
  for (const row of data ?? []) {
    const withhold = Math.max(0, Number(row.dispute_fee_withheld_cents) || 0);
    if (withhold < 1) {
      await supabaseAdmin.from('transactions').update({ dispute_fee_applied: true }).eq('id', row.id);
      continue;
    }
    const profile = await supabaseAdmin
      .from('profiles')
      .select('dispute_fee_owed_cents')
      .eq('id', row.seller_id)
      .maybeSingle();
    const owed = Math.max(0, Number(profile.data?.dispute_fee_owed_cents) || 0);
    const next = Math.max(0, owed - withhold);
    const saved = await supabaseAdmin
      .from('profiles')
      .update({ dispute_fee_owed_cents: next })
      .eq('id', row.seller_id)
      .eq('dispute_fee_owed_cents', owed)
      .select('id');
    const wrote = Array.isArray(saved.data) ? saved.data.length > 0 : Boolean(saved.data);
    if (!saved.error && wrote) {
      await supabaseAdmin.from('transactions').update({ dispute_fee_applied: true }).eq('id', row.id);
    }
  }
}

export async function releaseDuePayouts(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  sellerId?: string,
): Promise<{ released: number; skipped: number }> {
  try {
    await scheduleStalledHolds(supabaseAdmin, sellerId);
    await applyRecordedDisputeFees(supabaseAdmin, sellerId);
    await holdBanPayouts(supabaseAdmin, sellerId);
  } catch (error) {
    console.error('[Payout] Hold schedule failed:', error);
  }

  const nowIso = new Date().toISOString();
  let query = supabaseAdmin
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('status', 'held')
    .lte('payout_release_at', nowIso)
    .or(`payout_next_attempt_at.is.null,payout_next_attempt_at.lte."${nowIso}"`)
    .order('payout_release_at', { ascending: true })
    .limit(200);
  if (sellerId) query = query.eq('seller_id', sellerId);

  const { data, error } = await query;
  let due: TransactionRow[] = [];
  if (error) {
    const fallback = await supabaseAdmin
      .from('transactions')
      .select('id, seller_id, seller_payout, currency, payment_intent_id, order_id, status, stripe_transfer_id, stripe_charge_id')
      .eq('status', 'held')
      .lte('payout_release_at', nowIso)
      .limit(200);
    if (fallback.error) {
      console.error('[Payout] Held payout query failed:', fallback.error.message);
      return { released: 0, skipped: 0 };
    }
    due = (fallback.data ?? []) as TransactionRow[];
  } else {
    due = (data ?? []) as TransactionRow[];
  }

  let finals: TransactionRow[] = [];
  try {
    finals = await loadFinalSettlementRows(supabaseAdmin, sellerId, nowIso);
  } catch (finalError) {
    console.error('[Payout] Final settlement query failed:', finalError);
  }
  const forced = new Set(finals.map((row) => row.id));
  const seen = new Set<string>();
  const merged: TransactionRow[] = [];
  for (const row of [...due, ...finals]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return releaseRows(supabaseAdmin, stripeSecretKey, merged, nowIso, forced);
}

async function releaseRows(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  rows: TransactionRow[],
  nowIso: string,
  forced: Set<string> = new Set(),
): Promise<{ released: number; skipped: number }> {
  let released = 0;
  let skipped = 0;
  let attempts = 0;
  for (const row of rows.filter((item) => rowIsDue(item, nowIso, forced.has(item.id)))) {
    if (attempts >= 50) break;
    const gate = await confirmCookPayouts(supabaseAdmin, row.seller_id, stripeSecretKey, 'transfer');
    if (!gate.ok) {
      if (gate.retryAt) {
        const waiting = await supabaseAdmin
          .from('transactions')
          .update({
            payout_next_attempt_at: gate.retryAt,
            payout_last_error: gate.message.slice(0, 500),
          })
          .eq('id', row.id)
          .eq('status', 'held');
        if (waiting.error) console.error('[Payout] Final payout wait was not saved:', waiting.error.message);
      } else {
        await deferPayout(supabaseAdmin, row.id, 'account', gate.message);
      }
      skipped += 1;
      continue;
    }

    const profileQuery = await supabaseAdmin
      .from('profiles')
      .select('dispute_fee_owed_cents')
      .eq('id', row.seller_id)
      .maybeSingle();
    const owed = Math.max(0, Number(profileQuery.data?.dispute_fee_owed_cents) || 0);
    const grossCents = Math.round(Number(row.seller_payout) * 100);
    if (!Number.isFinite(grossCents) || grossCents < 1) {
      await deferPayout(supabaseAdmin, row.id, 'account', 'Payout amount is not a positive cent total.');
      skipped += 1;
      continue;
    }

    let withhold = row.dispute_fee_withheld_cents;
    let cents = row.stripe_transfer_cents;
    if (typeof withhold !== 'number' || typeof cents !== 'number') {
      const split = withholdFromPayout(grossCents, owed);
      withhold = split.withholdCents;
      cents = split.transferCents;
      await supabaseAdmin
        .from('transactions')
        .update({ dispute_fee_withheld_cents: withhold, stripe_transfer_cents: cents })
        .eq('id', row.id)
        .eq('status', 'held');
    }

    const chargeId = typeof row.stripe_charge_id === 'string' ? row.stripe_charge_id : '';
    if (cents >= 1 && !chargeId) {
      await deferPayout(supabaseAdmin, row.id, 'account', 'This payout has no charge to transfer from.');
      skipped += 1;
      continue;
    }

    let transferId = row.stripe_transfer_id;
    if (cents >= 1 && !transferId) {
      attempts += 1;
      const attempt = Math.max(0, Number(row.payout_attempt) || 0);
      const body = new URLSearchParams({
        amount: String(cents),
        currency: row.currency || 'usd',
        destination: gate.stripeAccountId,
        source_transaction: chargeId,
        transfer_group: row.payment_intent_id,
        'metadata[transaction_id]': row.id,
        'metadata[order_id]': row.order_id ?? '',
        'metadata[payment_intent_id]': row.payment_intent_id,
        'metadata[hold_days]': String(gate.finalSettlement ? BAN_FINAL_PAYOUT_DAYS : PAYOUT_HOLD_DAYS),
        'metadata[dispute_fee_withheld_cents]': String(withhold),
        'metadata[final_settlement]': gate.finalSettlement ? 'true' : 'false',
      });
      const transfer = await stripeForm(
        stripeSecretKey,
        'transfers',
        body,
        `settle_${row.id}_${cents}_${attempt}`,
      );
      if (!transfer.ok || typeof transfer.json.id !== 'string') {
        const kind = transferFailureKind(transfer.text);
        await deferPayout(supabaseAdmin, row.id, kind, 'Stripe did not create the transfer.');
        skipped += 1;
        continue;
      }
      transferId = transfer.json.id;
    }

    const { data: settled, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'settled',
        stripe_transfer_id: transferId,
        stripe_transfer_cents: cents,
        dispute_fee_withheld_cents: withhold,
        payout_settled_at: new Date().toISOString(),
        payout_last_error: null,
      })
      .eq('id', row.id)
      .eq('status', 'held')
      .select('id');

    if (updateError || !(Array.isArray(settled) ? settled.length > 0 : settled)) {
      console.error('[Payout] Settled update failed:', updateError?.message || 'no held row');
      skipped += 1;
      continue;
    }

    if (withhold > 0 && row.dispute_fee_applied !== true) {
      const nextOwed = Math.max(0, owed - withhold);
      const feeWrite = await supabaseAdmin
        .from('profiles')
        .update({ dispute_fee_owed_cents: nextOwed })
        .eq('id', row.seller_id)
        .eq('dispute_fee_owed_cents', owed)
        .select('id');
      const wrote = Array.isArray(feeWrite.data) ? feeWrite.data.length > 0 : Boolean(feeWrite.data);
      if (!feeWrite.error && wrote) {
        await supabaseAdmin.from('transactions').update({ dispute_fee_applied: true }).eq('id', row.id);
      }
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
  const refundCents = saleRefundCents(input.baseAmount);
  const refundAmount = refundCents / 100;

  const transactionQuery = supabaseAdmin
    .from('transactions')
    .select('id, status, stripe_transfer_id, seller_payout, order_id, stripe_transfer_cents, dispute_fee_withheld_cents');
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
    const payoutCents = transferredCents(transaction);
    if (payoutCents >= 1) {
      await reverseTransfer(
        stripeSecretKey,
        transaction.stripe_transfer_id,
        payoutCents,
        `reverse_${transaction.id}`,
      );
    }
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
      .select(TRANSACTION_COLUMNS)
      .eq('payment_intent_id', paymentIntentId);
    rows = (data ?? []) as TransactionRow[];
  } else if (chargeId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select(TRANSACTION_COLUMNS)
      .eq('stripe_charge_id', chargeId);
    rows = (data ?? []) as TransactionRow[];
  }

  for (const row of rows) {
    if (row.status === 'settled' && row.stripe_transfer_id) {
      const cents = transferredCents(row);
      if (cents >= 1) {
        try {
          await reverseTransfer(stripeSecretKey, row.stripe_transfer_id, cents, `dispute_${dispute.id}_${row.id}`);
        } catch (error) {
          console.error('[Dispute] Reversal failed:', error);
        }
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

async function addDisputeFeeOwed(
  supabaseAdmin: SupabaseClient,
  sellerId: string,
  cents: number,
): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('dispute_fee_owed_cents')
    .eq('id', sellerId)
    .maybeSingle();
  const owed = Math.max(0, Number(profile?.dispute_fee_owed_cents) || 0) + cents;
  await supabaseAdmin.from('profiles').update({ dispute_fee_owed_cents: owed }).eq('id', sellerId);
}

async function debitCookDisputeFee(
  supabaseAdmin: SupabaseClient,
  stripeSecretKey: string,
  sellerId: string,
  disputeId: string,
  sale: TransactionRow,
): Promise<'stripe' | 'owed'> {
  const available = transferredCents(sale);
  if (sale.status === 'settled' && sale.stripe_transfer_id && available >= LOST_DISPUTE_FEE_CENTS) {
    try {
      await reverseTransfer(
        stripeSecretKey,
        sale.stripe_transfer_id,
        LOST_DISPUTE_FEE_CENTS,
        `dispute_fee_${disputeId}`,
      );
      await supabaseAdmin
        .from('transactions')
        .update({ stripe_transfer_cents: available - LOST_DISPUTE_FEE_CENTS })
        .eq('id', sale.id);
      return 'stripe';
    } catch (error) {
      console.error('[Dispute] Cook fee reversal failed:', error);
    }
  }

  await addDisputeFeeOwed(supabaseAdmin, sellerId, LOST_DISPUTE_FEE_CENTS);
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
      const fromOwed = Math.min(owed, LOST_DISPUTE_FEE_HALF_CENTS);
      const remainder = LOST_DISPUTE_FEE_HALF_CENTS - fromOwed;
      if (remainder >= 1) {
        if (!stripeSecretKey || !profile?.stripe_account_id) continue;
        const credit = await stripeForm(
          stripeSecretKey,
          'transfers',
          new URLSearchParams({
            amount: String(remainder),
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
      }
      owed -= fromOwed;
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

  let row: (TransactionRow & { buyer_id?: string | null }) | null = null;
  const saleColumns = `${TRANSACTION_COLUMNS}, buyer_id`;
  if (paymentIntentId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select(saleColumns)
      .eq('payment_intent_id', paymentIntentId)
      .limit(1);
    row = data?.[0] ?? null;
  } else if (chargeId) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select(saleColumns)
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

  const collected = await debitCookDisputeFee(supabaseAdmin, stripeSecretKey, row.seller_id, dispute.id, row);
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

type ConnectEvent = {
  type?: string;
  account?: string;
  data?: { object?: Record<string, unknown> };
};

function eventObject(event: ConnectEvent): Record<string, unknown> {
  return event.data?.object && typeof event.data.object === 'object' ? event.data.object : {};
}

function metadataTransactionId(object: Record<string, unknown>): string {
  const metadata = object.metadata && typeof object.metadata === 'object'
    ? object.metadata as Record<string, unknown>
    : {};
  return typeof metadata.transaction_id === 'string' ? metadata.transaction_id : '';
}

export async function handleConnectWebhook(
  supabaseAdmin: SupabaseClient,
  event: ConnectEvent,
): Promise<'ok' | 'error'> {
  const object = eventObject(event);
  try {
    if (event.type === 'account.updated') {
      const accountId = typeof object.id === 'string' ? object.id : event.account;
      if (!accountId) return 'ok';
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_payouts_enabled: object.payouts_enabled === true })
        .eq('stripe_account_id', accountId);
      return error ? 'error' : 'ok';
    }

    if (event.type === 'payout.paid' || event.type === 'payout.failed') {
      const accountId = typeof event.account === 'string' ? event.account : '';
      if (!accountId) return 'ok';
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_bank_payout_status: event.type === 'payout.paid' ? 'paid' : 'failed',
          stripe_bank_payout_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', accountId);
      return error ? 'error' : 'ok';
    }

    if (event.type === 'transfer.created' || event.type === 'transfer.failed') {
      const transferId = typeof object.id === 'string' ? object.id : '';
      const transactionId = metadataTransactionId(object);
      const lookup = supabaseAdmin
        .from('transactions')
        .select('id, status, dispute_fee_withheld_cents, dispute_fee_applied, seller_id, payout_attempt, stripe_transfer_id');
      const filtered = transactionId
        ? lookup.eq('id', transactionId)
        : lookup.eq('stripe_transfer_id', transferId);
      const { data, error } = await filtered.limit(1);
      if (error) return 'error';
      const row = data?.[0] as TransactionRow | undefined;
      if (!row) return 'ok';
      if (event.type === 'transfer.created') {
        if (row.status === 'held' && !row.stripe_transfer_id && transferId) {
          const saved = await supabaseAdmin
            .from('transactions')
            .update({ stripe_transfer_id: transferId })
            .eq('id', row.id)
            .eq('status', 'held');
          return saved.error ? 'error' : 'ok';
        }
        return 'ok';
      }
      if (row.dispute_fee_applied === true) {
        const withheld = Math.max(0, Number(row.dispute_fee_withheld_cents) || 0);
        if (withheld > 0) await addDisputeFeeOwed(supabaseAdmin, row.seller_id, withheld);
        await supabaseAdmin.from('transactions').update({ dispute_fee_applied: false }).eq('id', row.id);
      }
      const saved = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'held',
          stripe_transfer_id: null,
          payout_attempt: Math.max(0, Number(row.payout_attempt) || 0) + 1,
          payout_next_attempt_at: payoutRetryAt('account'),
          payout_last_error: 'Stripe reported the transfer failed.',
          payout_settled_at: null,
        })
        .eq('id', row.id);
      return saved.error ? 'error' : 'ok';
    }
  } catch (error) {
    console.error('[Stripe Connect] Webhook failed:', error);
    return 'error';
  }
  return 'ok';
}
