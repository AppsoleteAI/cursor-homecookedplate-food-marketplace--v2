const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readSellerId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { sellerId?: unknown }).sellerId;
  return typeof id === 'string' && UUID.test(id) ? id : undefined;
}

/** Listing owner, then the catalog seller, then the cook's own phone listing. */
export function shopSellerId(
  listing: { sellerId?: string } | null | undefined,
  catalogSeller: string | null | undefined,
  user: { id?: string; role?: string | null } | null | undefined,
): string | undefined {
  if (listing?.sellerId && UUID.test(listing.sellerId)) return listing.sellerId;
  if (catalogSeller && UUID.test(catalogSeller)) return catalogSeller;
  if (listing && user?.role === 'platemaker' && user.id && UUID.test(user.id)) return user.id;
  return undefined;
}
