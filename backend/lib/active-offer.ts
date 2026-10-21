import type { PromotionPrice } from './fees';

export type StoredOffer = PromotionPrice & {
  id: string;
  mealId: string;
  title: string;
  description: string;
  freeItemName?: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type OfferRow = {
  id: string;
  meal_id: string;
  type: PromotionPrice['type'];
  title: string;
  description: string;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  free_item_name?: string | null;
  start_date: string;
  end_date: string;
  is_active?: boolean | null;
};

export function missingOffersTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /promotional_offers/i.test(error.message ?? '') || /schema cache/i.test(error.message ?? '');
}

export function offerFromRow(row: OfferRow, now = new Date()): StoredOffer | null {
  if (row.is_active === false) return null;
  const start = Date.parse(row.start_date);
  const end = Date.parse(row.end_date);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > now.getTime() || end < now.getTime()) return null;
  return {
    id: row.id,
    mealId: row.meal_id,
    type: row.type,
    title: row.title,
    description: row.description,
    discountPercentage: row.discount_percentage,
    discountAmount: row.discount_amount,
    buyQuantity: row.buy_quantity,
    getQuantity: row.get_quantity,
    freeItemName: row.free_item_name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: true,
  };
}

export async function loadActiveOffers(
  admin: { from: (table: string) => any },
  mealIds: string[],
): Promise<Map<string, StoredOffer>> {
  const offers = new Map<string, StoredOffer>();
  const ids = [...new Set(mealIds.filter(Boolean))];
  if (ids.length === 0) return offers;
  const { data, error } = await admin
    .from('promotional_offers')
    .select('id, meal_id, type, title, description, discount_percentage, discount_amount, buy_quantity, get_quantity, free_item_name, start_date, end_date, is_active')
    .in('meal_id', ids)
    .eq('is_active', true);
  if (error) {
    if (missingOffersTable(error)) return offers;
    console.error('[Offers] Lookup failed:', error.message);
    return offers;
  }
  for (const row of data || []) {
    const offer = offerFromRow(row);
    if (!offer || offers.has(offer.mealId)) continue;
    offers.set(offer.mealId, offer);
  }
  return offers;
}
