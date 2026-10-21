/** Refund one order's cents on a charge that other open orders still use. */
export async function refundChargeCents(secretKey: string, paymentIntentId: string, cents: number): Promise<void> {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error('This order has no amount to refund.');
  }
  const paymentIntentResponse = await fetch(
    `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  if (!paymentIntentResponse.ok) {
    throw new Error('The card refund could not be checked.');
  }
  const paymentIntent = await paymentIntentResponse.json() as { status?: string; amount?: number };
  if (paymentIntent.status !== 'succeeded') {
    throw new Error('The card is not ready to refund this order alone.');
  }
  const amount = Math.min(cents, paymentIntent.amount ?? cents);
  const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(amount),
    }).toString(),
  });
  if (refundResponse.ok) return;
  const body = await refundResponse.text();
  if (/already been refunded|charge_already_refunded/i.test(body)) return;
  throw new Error('The card refund did not go through.');
}

/** Full card refund or cancel for an open charge. A second call after Stripe already refunded it is success. */
export async function refundOpenCharge(secretKey: string, paymentIntentId: string): Promise<void> {
  const paymentIntentResponse = await fetch(
    `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  if (!paymentIntentResponse.ok) {
    throw new Error('The card refund could not be checked. This account was not deleted.');
  }
  const paymentIntent = await paymentIntentResponse.json() as { status?: string; amount?: number };
  if (paymentIntent.status === 'canceled') return;
  if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'requires_payment_method') {
    const cancelResponse = await fetch(
      `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/cancel`,
      { method: 'POST', headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!cancelResponse.ok) {
      throw new Error('The card could not be cancelled. This account was not deleted.');
    }
    return;
  }
  if (paymentIntent.status !== 'succeeded') {
    throw new Error('The card is not ready to refund. This account was not deleted.');
  }
  const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(paymentIntent.amount),
    }).toString(),
  });
  if (refundResponse.ok) return;
  const body = await refundResponse.text();
  if (/already been refunded|charge_already_refunded/i.test(body)) return;
  throw new Error('The card refund did not go through. This account was not deleted.');
}
