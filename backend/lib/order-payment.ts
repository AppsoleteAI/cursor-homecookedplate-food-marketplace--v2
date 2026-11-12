export type StripeIntent = {
  status?: string;
  amount?: number;
  metadata?: { order_ids?: string; base_cents?: string; delivery_fee?: string };
};

/** `paid` true, `paid` false, or the column is not on this row. */
export function orderPaidState(order: { paid?: boolean | null }): 'paid' | 'unpaid' | 'absent' {
  if (order.paid === true) return 'paid';
  if (order.paid === false) return 'unpaid';
  return 'absent';
}

export function paymentIntentId(order: { payment_intent_id?: string | null }): string | null {
  const id = order.payment_intent_id;
  return typeof id === 'string' && id.length >= 3 ? id : null;
}

export function stripeSucceeded(intent: { status?: string } | null | undefined): boolean {
  return intent?.status === 'succeeded';
}

export async function readStripeIntent(secret: string, id: string): Promise<StripeIntent | null> {
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${id}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return null;
  return response.json() as Promise<StripeIntent>;
}

/** A cancel writes paid false only when that column is on the row. */
export function orderCancelPatch(order: { paid?: boolean | null }): { status: 'cancelled'; paid?: false } {
  if (orderPaidState(order) === 'absent') return { status: 'cancelled' };
  return { status: 'cancelled', paid: false };
}

/** Paid when the column says so, or, when it is absent, when Stripe succeeded or a held or settled transaction exists. */
export async function orderPaymentConfirmed(
  order: { id?: string; paid?: boolean | null; payment_intent_id?: string | null },
  admin: { from: (table: string) => any },
  stripeSecret: string | undefined,
): Promise<boolean> {
  const state = orderPaidState(order);
  if (state === 'paid') return true;
  if (state === 'unpaid') return false;
  const intentId = paymentIntentId(order);
  if (intentId && stripeSecret) {
    const intent = await readStripeIntent(stripeSecret, intentId);
    if (stripeSucceeded(intent)) return true;
  }
  if (!order.id) return false;
  return orderHasHeldTransaction(admin, order.id);
}

async function heldOrderIds(
  admin: { from: (table: string) => any },
  orderIds: string[],
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const { data, error } = await admin
    .from('transactions')
    .select('order_id')
    .in('order_id', orderIds)
    .in('status', ['held', 'settled']);
  if (error || !Array.isArray(data)) return new Set();
  return new Set(
    data
      .map((row: { order_id?: string }) => row.order_id)
      .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0),
  );
}

/** Ids that pass the paid check. A false paid column stays out. A missing column uses Stripe or a held transaction. */
export async function confirmedPaidIds(
  orders: { id?: string; paid?: boolean | null; payment_intent_id?: string | null }[],
  admin: { from: (table: string) => any },
  stripeSecret: string | undefined,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const absent: { id: string; payment_intent_id?: string | null }[] = [];
  for (const order of orders) {
    if (!order.id) continue;
    const id = order.id;
    const state = orderPaidState(order);
    if (state === 'paid') ids.add(id);
    else if (state === 'absent') absent.push({ id, payment_intent_id: order.payment_intent_id });
  }
  if (absent.length === 0) return ids;
  const held = await heldOrderIds(admin, absent.map((order) => order.id));
  const stillOpen: { id: string; payment_intent_id?: string | null }[] = [];
  for (const order of absent) {
    if (held.has(order.id)) ids.add(order.id);
    else stillOpen.push(order);
  }
  if (!stripeSecret) return ids;
  await Promise.all(stillOpen.map(async (order) => {
    const intentId = paymentIntentId(order);
    if (!intentId) return;
    const intent = await readStripeIntent(stripeSecret, intentId);
    if (stripeSucceeded(intent)) ids.add(order.id);
  }));
  return ids;
}

/** The status trigger treats a held or settled transaction as payment when `paid` is absent. */
export async function orderHasHeldTransaction(
  admin: { from: (table: string) => any },
  orderId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('transactions')
    .select('id')
    .eq('order_id', orderId)
    .in('status', ['held', 'settled'])
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}
