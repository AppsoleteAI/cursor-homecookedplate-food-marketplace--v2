/**
 * Loads cook and buyer display fields with the service role.
 * Callers must pass only ids they are already allowed to show.
 * Stripe ids and other payout fields are never selected here.
 */
export async function loadPublicProfiles(
  admin: { from: (table: string) => any },
  ids: string[],
  includeEmail = false
): Promise<Map<string, { id: string; username: string | null; business_name: string | null; profile_image: string | null; email?: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const profiles = new Map<string, { id: string; username: string | null; business_name: string | null; profile_image: string | null; email?: string | null }>();
  if (unique.length === 0) return profiles;

  const columns = includeEmail
    ? 'id, username, business_name, profile_image, email'
    : 'id, username, business_name, profile_image';

  const { data, error } = await admin.from('profiles').select(columns).in('id', unique);
  if (error) {
    console.error('[PublicProfiles] Lookup failed:', error);
    return profiles;
  }

  for (const row of data || []) {
    profiles.set(row.id, row);
  }
  return profiles;
}

export function displayName(profile?: { username?: string | null; business_name?: string | null } | null, fallback = 'Unknown') {
  return profile?.business_name || profile?.username || fallback;
}
