import type { SupabaseClient } from '@supabase/supabase-js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export type AccountRole = 'platemaker' | 'platetaker';
export type StripeIdentityKind = 'connect_account' | 'customer';

export function accountCodePrefix(role: AccountRole): 'PM' | 'PT' {
  return role === 'platemaker' ? 'PM' : 'PT';
}

export function mintAccountCode(role: AccountRole, bytes: Uint8Array): string {
  let body = '';
  for (let index = 0; index < 8; index += 1) {
    body += ALPHABET[(bytes[index] ?? 0) % ALPHABET.length];
  }
  return `${accountCodePrefix(role)}-${body}`;
}

function randomCodeBytes(): Uint8Array {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return bytes;
}

function missingRelation(message: string): boolean {
  return /does not exist|schema cache|account_identifiers|stripe_identity_claims|account_code/i.test(message);
}

type ClaimRow = { code?: string; profile_id?: string | null; stripe_id?: string };

/**
 * One code per account. A deleted account leaves the code reserved, so the next
 * account always receives a new one.
 */
export async function ensureAccountIdentifier(
  admin: SupabaseClient,
  profileId: string,
  role: string,
): Promise<string | null> {
  if (role !== 'platemaker' && role !== 'platetaker') return null;

  const profile = await admin.from('profiles').select('account_code').eq('id', profileId).maybeSingle();
  if (profile.error) {
    if (missingRelation(profile.error.message || '')) return null;
    console.error('[Account] Identifier read failed:', profile.error.message);
    return null;
  }
  if (typeof profile.data?.account_code === 'string' && profile.data.account_code.length > 0) {
    return profile.data.account_code;
  }

  const existing = await admin
    .from('account_identifiers')
    .select('code')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (existing.error) {
    if (missingRelation(existing.error.message || '')) return null;
    console.error('[Account] Identifier ledger read failed:', existing.error.message);
    return null;
  }
  if (existing.data?.code) {
    await admin.from('profiles').update({ account_code: existing.data.code }).eq('id', profileId);
    return existing.data.code as string;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintAccountCode(role, randomCodeBytes());
    const inserted = await admin
      .from('account_identifiers')
      .insert({ code, profile_id: profileId, role })
      .select('code')
      .maybeSingle();
    if (!inserted.error && inserted.data?.code) {
      const saved = await admin.from('profiles').update({ account_code: inserted.data.code }).eq('id', profileId);
      if (saved.error) console.error('[Account] Identifier was not copied onto the profile:', saved.error.message);
      return inserted.data.code as string;
    }
    const message = inserted.error?.message || '';
    const pgCode = inserted.error && typeof inserted.error === 'object' && 'code' in inserted.error
      ? String(inserted.error.code)
      : '';
    if (pgCode === '23505' && /profile_id/i.test(message)) {
      const won = await admin.from('account_identifiers').select('code').eq('profile_id', profileId).maybeSingle();
      return (won.data?.code as string | undefined) ?? null;
    }
    if (pgCode === '23505') continue;
    if (missingRelation(message)) return null;
    console.error('[Account] Identifier was not saved:', message);
    return null;
  }
  return null;
}

export async function claimStripeIdentity(
  admin: SupabaseClient,
  input: { stripeId: string; kind: StripeIdentityKind; profileId: string },
): Promise<{ ok: true; stripeId: string } | { ok: false; reason: 'taken' | 'retired' | 'error' }> {
  const inserted = await admin
    .from('stripe_identity_claims')
    .insert({ stripe_id: input.stripeId, kind: input.kind, profile_id: input.profileId })
    .select('stripe_id')
    .maybeSingle();
  if (!inserted.error) return { ok: true, stripeId: input.stripeId };

  const message = inserted.error.message || '';
  const pgCode = inserted.error && typeof inserted.error === 'object' && 'code' in inserted.error
    ? String(inserted.error.code)
    : '';
  if (missingRelation(message) && pgCode !== '23505') return { ok: true, stripeId: input.stripeId };
  if (pgCode !== '23505' && !/duplicate|unique/i.test(message)) {
    console.error('[Account] Stripe identity was not saved:', message);
    return { ok: false, reason: 'error' };
  }

  const existing = await admin
    .from('stripe_identity_claims')
    .select('profile_id, stripe_id')
    .eq('stripe_id', input.stripeId)
    .maybeSingle();
  const row = existing.data as ClaimRow | null;
  if (row?.stripe_id && row.profile_id === input.profileId) return { ok: true, stripeId: input.stripeId };
  if (row?.stripe_id && !row.profile_id) return { ok: false, reason: 'retired' };
  if (row?.stripe_id && row.profile_id && row.profile_id !== input.profileId) return { ok: false, reason: 'taken' };

  const owned = await admin
    .from('stripe_identity_claims')
    .select('stripe_id, profile_id')
    .eq('profile_id', input.profileId)
    .eq('kind', input.kind)
    .maybeSingle();
  const ownedId = typeof owned.data?.stripe_id === 'string' ? owned.data.stripe_id : '';
  if (ownedId) return { ok: true, stripeId: ownedId };
  return { ok: false, reason: 'error' };
}

export async function saveOwnedStripeCustomer(
  admin: SupabaseClient,
  profileId: string,
  customerId: string,
): Promise<{ ok: true; stripeId: string } | { ok: false; reason: 'taken' | 'retired' | 'error' }> {
  const claim = await claimStripeIdentity(admin, { stripeId: customerId, kind: 'customer', profileId });
  if (!claim.ok) return claim;
  const saved = await admin.from('profiles').update({ stripe_customer_id: claim.stripeId }).eq('id', profileId);
  if (saved.error) {
    if (/duplicate|unique|23505/i.test(saved.error.message || '')) return { ok: false, reason: 'taken' };
    console.error('[Account] Stripe customer was not saved:', saved.error.message);
    return { ok: false, reason: 'error' };
  }
  return { ok: true, stripeId: claim.stripeId };
}
