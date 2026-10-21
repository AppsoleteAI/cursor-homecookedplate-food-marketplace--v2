/** The Early Bird end date stays with the metro named on this row. A later move does not replace it. */
export const EARLY_BIRD_CLAIM = 'EARLY_BIRD_CLAIM';

type Admin = {
  from: (table: string) => any;
};

export function earlyBirdCoversThisMetro(
  claimMetro: string | null | undefined,
  currentMetro: string | null | undefined,
  hasOpenOrder: boolean,
): boolean {
  const claim = (claimMetro || '').trim();
  if (!claim) return true;
  const current = (currentMetro || '').trim() || 'Remote/Other';
  if (claim === current) return true;
  return hasOpenOrder;
}

export async function readEarlyBirdClaim(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('audit_logs')
    .select('new_data')
    .eq('user_id', userId)
    .eq('action', EARLY_BIRD_CLAIM)
    .order('created_at', { ascending: false })
    .limit(1);
  const name = data?.[0]?.new_data?.metroName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export async function saveEarlyBirdClaim(admin: Admin, userId: string, metroName: string): Promise<void> {
  const name = metroName.trim();
  if (!name || name === 'Remote/Other') return;
  const existing = await readEarlyBirdClaim(admin, userId);
  if (existing) return;
  await admin.from('audit_logs').insert({
    user_id: userId,
    action: EARLY_BIRD_CLAIM,
    table_name: 'profiles',
    new_data: { metroName: name },
  });
}
