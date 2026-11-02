export function applePayMerchantName(names: (string | null | undefined)[]): string {
  const unique: string[] = [];
  for (const name of names) {
    const cleaned = (name ?? '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2 || unique.includes(cleaned)) continue;
    unique.push(cleaned);
  }
  if (unique.length === 0) return 'Your cook';
  const joined = unique.join(', ');
  return joined.length <= 64 ? joined : `${joined.slice(0, 61)}...`;
}

export function profilePayeeName(profile?: { username?: string | null; business_name?: string | null } | null): string {
  const business = profile?.business_name?.replace(/\s+/g, ' ').trim() || '';
  if (business.length >= 2) return business;
  return profile?.username?.replace(/\s+/g, ' ').trim() || '';
}
