export function browserOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Checkout can only return to an http page.');
  }
  return url.origin;
}

export async function openStripeCheckout(args: {
  secretKey: string;
  amountCents: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ url: string; paymentIntentId: string }> {
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(args.amountCents),
    'line_items[0][price_data][product_data][name]': args.productName.slice(0, 120),
  });
  for (const [key, value] of Object.entries(args.metadata)) {
    params.append(`payment_intent_data[metadata][${key}]`, value);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!response.ok) {
    console.error('[Stripe Checkout] Session was not created');
    throw new Error('Could not open card checkout');
  }
  const session = await response.json() as { url?: string; payment_intent?: string | { id?: string } };
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!session.url || !paymentIntentId) {
    throw new Error('Card checkout did not return a payment');
  }
  return { url: session.url, paymentIntentId };
}
