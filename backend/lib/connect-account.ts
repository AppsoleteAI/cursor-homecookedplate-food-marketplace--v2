import type { SupabaseClient } from '@supabase/supabase-js';

/** Live account links only accept HTTPS. This is the Worker that mints a fresh link. */
export const CONNECT_PUBLIC_ORIGIN = 'https://plate-marketplace-api.appsolete.workers.dev';

export const STRIPE_PAYOUT_SETUP_MESSAGE = 'Finish Stripe payout setup before selling. An account id is not enough.';

export function connectOnboardingUrls(accountId: string, origin: string = CONNECT_PUBLIC_ORIGIN): { returnUrl: string; refreshUrl: string } {
  const base = origin.replace(/\/$/, '');
  return {
    returnUrl: `${base}/stripe/connect-return`,
    refreshUrl: `${base}/stripe/connect-refresh?account=${encodeURIComponent(accountId)}`,
  };
}

/** Express accounts on this platform receive Transfers. They do not take card payments. Country stays US. */
export function expressAccountFields(input: { email: string; businessName?: string | null }): URLSearchParams {
  const body = new URLSearchParams({
    type: 'express',
    country: 'US',
    email: input.email,
    'capabilities[transfers][requested]': 'true',
    'metadata[marketplace]': 'homecookedplate',
    'metadata[payout_hold_days]': '7',
  });
  if (input.businessName) body.set('business_profile[name]', input.businessName);
  return body;
}

export async function createAccountLink(
  stripeSecretKey: string,
  accountId: string,
  origin?: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const urls = connectOnboardingUrls(accountId, origin);
  const response = await fetch('https://api.stripe.com/v1/account_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      account: accountId,
      refresh_url: urls.refreshUrl,
      return_url: urls.returnUrl,
      type: 'account_onboarding',
    }).toString(),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: text };
  try {
    const json = JSON.parse(text) as { url?: unknown };
    if (typeof json.url !== 'string' || json.url.length === 0) return { ok: false, error: text };
    return { ok: true, url: json.url };
  } catch {
    return { ok: false, error: text };
  }
}

export function connectReturnHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payout setup</title>
</head>
<body>
  <p>Stripe payout setup is ready to check in HomeCookedPlate.</p>
  <p><a href="homecookedplate://payout-responsibility">Open the app</a></p>
  <p><a href="https://homecookedplate.com/payout-responsibility">Open payouts on the web</a></p>
</body>
</html>`;
}

type PayoutProfile = {
  stripe_account_id?: string | null;
  stripe_payouts_enabled?: boolean | null;
  selling_removed?: boolean | null;
  final_payout_at?: string | null;
};

export type PayoutGate =
  | { ok: true; stripeAccountId: string; finalSettlement: boolean }
  | { ok: false; message: string; retryAt?: string };

/**
 * Selling requires payouts_enabled. A stored account id is only the Connect record.
 * A false flag is checked against Stripe once and then saved.
 */
export async function confirmCookPayouts(
  admin: SupabaseClient,
  sellerId: string,
  stripeSecretKey: string | undefined,
  purpose: 'sell' | 'transfer' = 'sell',
): Promise<PayoutGate> {
  const read = await admin
    .from('profiles')
    .select('stripe_account_id, stripe_payouts_enabled, selling_removed, final_payout_at')
    .eq('id', sellerId)
    .maybeSingle();
  let profile = read.data as PayoutProfile | null;
  const missingColumn = read.error?.message || '';
  if (read.error && /stripe_payouts_enabled|final_payout_at/i.test(missingColumn)) {
    const again = await admin
      .from('profiles')
      .select('stripe_account_id, stripe_payouts_enabled, selling_removed')
      .eq('id', sellerId)
      .maybeSingle();
    profile = again.error && /stripe_payouts_enabled/i.test(again.error.message || '')
      ? (await admin.from('profiles').select('stripe_account_id, selling_removed').eq('id', sellerId).maybeSingle()).data as PayoutProfile | null
      : again.data as PayoutProfile | null;
  } else if (read.error || !profile) {
    return { ok: false, message: 'Seller has not completed Stripe onboarding' };
  }

  if (!profile?.stripe_account_id) {
    return { ok: false, message: 'Seller has not completed Stripe onboarding' };
  }
  let finalSettlement = false;
  if (profile.selling_removed === true && purpose === 'sell') {
    return { ok: false, message: 'This cook is not allowed to take payments' };
  }
  if (profile.selling_removed === true) {
    const finalAt = profile.final_payout_at ? new Date(profile.final_payout_at).getTime() : Number.NaN;
    if (!Number.isFinite(finalAt) || finalAt > Date.now()) {
      return {
        ok: false,
        message: 'Selling is removed. The remaining payout waits 30 days, minus pending chargebacks and fees still owed.',
        retryAt: profile.final_payout_at || undefined,
      };
    }
    finalSettlement = true;
  }
  if (profile.stripe_payouts_enabled === true) {
    return { ok: true, stripeAccountId: profile.stripe_account_id, finalSettlement };
  }
  if (!stripeSecretKey) return { ok: false, message: STRIPE_PAYOUT_SETUP_MESSAGE };

  const response = await fetch(`https://api.stripe.com/v1/accounts/${profile.stripe_account_id}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  if (!response.ok) return { ok: false, message: STRIPE_PAYOUT_SETUP_MESSAGE };
  const account = await response.json() as { payouts_enabled?: boolean };
  const enabled = account.payouts_enabled === true;
  await admin.from('profiles').update({ stripe_payouts_enabled: enabled }).eq('id', sellerId);
  if (!enabled) return { ok: false, message: STRIPE_PAYOUT_SETUP_MESSAGE };
  return { ok: true, stripeAccountId: profile.stripe_account_id, finalSettlement };
}
