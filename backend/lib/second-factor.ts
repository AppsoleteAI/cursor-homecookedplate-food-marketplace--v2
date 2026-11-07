export type AssuranceLevel = 'aal1' | 'aal2';

export const SECOND_FACTOR_MESSAGE = 'Enter the code from your authenticator app to finish signing in.';
export const AUTHENTICATOR_MISMATCH_MESSAGE = 'That authenticator code does not match.';

type ListedFactor = {
  id?: string;
  factor_type?: string;
  status?: string;
};

/** Reads the `aal` claim from an access token Supabase has already accepted. */
export function readAccessTokenAal(token: string): AssuranceLevel | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? padded : `${padded}${'='.repeat(4 - (padded.length % 4))}`;
    const decoded = typeof atob === 'function'
      ? atob(pad)
      : Buffer.from(pad, 'base64').toString('utf8');
    const json = JSON.parse(decoded) as { aal?: unknown };
    if (json.aal === 'aal1' || json.aal === 'aal2') return json.aal;
    return null;
  } catch {
    return null;
  }
}

/**
 * A session may enter only when it has no verified factor, or the token is aal2.
 * A failed factor lookup stays closed so an aal1 token cannot slip through.
 */
/** A project with authenticator sign-in turned off has no factor to enforce. Any other lookup failure stays closed. */
export function mfaLookupState(errorMessage: string | null | undefined): 'ok' | 'off' | 'failed' {
  if (!errorMessage) return 'ok';
  if (/not enabled|mfa enroll is disabled|multi-factor authentication is disabled/i.test(errorMessage)) return 'off';
  return 'failed';
}

export function sessionMayEnter(
  aal: AssuranceLevel | null,
  verifiedFactorCount: number,
  factorListFailed: boolean,
): boolean {
  if (aal === 'aal2') return true;
  if (factorListFailed) return false;
  return verifiedFactorCount <= 0;
}

export function verifiedFactors(factors: ListedFactor[] | null | undefined): ListedFactor[] {
  return (factors ?? []).filter((factor) => factor.status === 'verified' && typeof factor.id === 'string');
}

export function verifiedTotpFactorId(factors: ListedFactor[] | null | undefined): string | null {
  const match = verifiedFactors(factors).find((factor) => factor.factor_type === 'totp');
  return typeof match?.id === 'string' ? match.id : null;
}

const FACTOR_ID = /^[0-9a-f-]{36}$/i;

/** Exchanges an authenticator code for the aal2 session Supabase issues. */
export async function verifyTotpCode(input: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  factorId: string;
  code: string;
}): Promise<{ access_token: string; refresh_token: string } | null> {
  if (!FACTOR_ID.test(input.factorId) || !/^\d{6}$/.test(input.code)) return null;
  const root = input.supabaseUrl.replace(/\/$/, '');
  const headers = {
    apikey: input.anonKey,
    Authorization: `Bearer ${input.accessToken}`,
    'Content-Type': 'application/json',
  };
  const challenge = await fetch(`${root}/auth/v1/factors/${input.factorId}/challenge`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!challenge.ok) return null;
  const challengeBody = await challenge.json() as { id?: string };
  if (!challengeBody.id) return null;
  const verified = await fetch(`${root}/auth/v1/factors/${input.factorId}/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ challenge_id: challengeBody.id, code: input.code }),
  });
  if (!verified.ok) return null;
  const body = await verified.json() as { access_token?: string; refresh_token?: string };
  if (!body.access_token || !body.refresh_token) return null;
  return { access_token: body.access_token, refresh_token: body.refresh_token };
}
