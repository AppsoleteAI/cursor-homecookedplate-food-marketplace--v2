import { PRODUCTION_ORIGINS } from './api-origin';

export const CHECKOUT_RETURN_MESSAGE = 'Checkout can only return to HomeCookedPlate.';

const SAFE_RETURN_PATH = /^\/[A-Za-z0-9/_-]{0,160}$/;

/** Stripe success and cancel pages stay on HomeCookedPlate. */
export function browserOrigin(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.protocol !== 'https:' || !PRODUCTION_ORIGINS.has(url.origin)) {
    throw new Error(CHECKOUT_RETURN_MESSAGE);
  }
  return url.origin;
}

/** A return path is a site path. A query, a hash, or another host is ignored. */
export function checkoutReturnPath(value: string | undefined, fallback: string): string {
  if (!value || !SAFE_RETURN_PATH.test(value) || value.includes('//')) return fallback;
  return value;
}

/** Membership returns to /membership on this website, or to the app when no page was sent. */
export function membershipReturnUrls(value: string | undefined): { successUrl: string; cancelUrl: string } {
  if (!value) {
    return {
      successUrl: 'homecookedplate://payment-success',
      cancelUrl: 'homecookedplate://payment-cancel',
    };
  }
  const origin = browserOrigin(value);
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/membership' || url.search || url.hash) {
    throw new Error(CHECKOUT_RETURN_MESSAGE);
  }
  return {
    successUrl: `${origin}/membership?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/membership`,
  };
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
