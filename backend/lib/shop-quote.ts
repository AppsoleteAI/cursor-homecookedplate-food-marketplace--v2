import type { SupabaseClient } from '@supabase/supabase-js';
import { offerFromRow } from './active-offer';
import { promotionalBase, type PromotionPrice } from './fees';
import { catalogItem, listingMenuPrice, type ShopName, type ShopQuoteLine } from './shop-catalog';

export type PricedShopLine = ShopQuoteLine & { lineTotal: number };

function missingRelation(error: { code?: string; message?: string } | null, table: string): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || new RegExp(table, 'i').test(error.message ?? '') || /schema cache/i.test(error.message ?? '');
}

async function offerForListing(
  admin: SupabaseClient,
  shop: ShopName,
  sellerId: string,
  listingId: string,
): Promise<PromotionPrice | null> {
  const { data, error } = await admin
    .from('area_offers')
    .select('id, listing_id, type, title, description, discount_percentage, discount_amount, buy_quantity, get_quantity, free_item_name, start_date, end_date, is_active')
    .eq('user_id', sellerId)
    .eq('area', shop)
    .eq('listing_id', listingId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(5);
  if (error) {
    if (missingRelation(error, 'area_offers')) return null;
    throw new Error('This offer could not be priced.');
  }
  for (const row of data || []) {
    const offer = offerFromRow({ ...row, meal_id: row.listing_id });
    if (offer) return offer;
  }
  return null;
}

/**
 * Catalog price, or the cook's stored listing price, then one active area offer.
 * The phone does not send a price. A line that lands on zero is refused.
 */
export async function priceShopOrder(
  admin: SupabaseClient,
  shop: ShopName,
  lines: { productId: string; quantity: number }[],
  sellerId?: string | null,
): Promise<{ baseAmount: number; lines: PricedShopLine[] }> {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
  }

  const quoted: PricedShopLine[] = [];
  let baseAmount = 0;
  for (const [productId, quantity] of merged) {
    const catalog = catalogItem(shop, productId);
    let name = catalog?.name ?? '';
    let unitPrice = catalog?.unitPrice ?? 0;
    let minimum = catalog?.minimum ?? 1;
    if (!catalog) {
      if (!sellerId) {
        throw new Error('This item is not on the server menu, so it cannot be charged.');
      }
      const { data, error } = await admin
        .from('lane_listings')
        .select('listing')
        .eq('id', productId)
        .eq('seller_id', sellerId)
        .eq('lane', shop)
        .maybeSingle();
      const menu = !error && data ? listingMenuPrice(data.listing) : null;
      if (!menu) {
        throw new Error('This item is not on the server menu, so it cannot be charged.');
      }
      name = menu.name;
      unitPrice = menu.unitPrice;
      minimum = menu.minimum;
    }
    if (quantity < minimum) {
      throw new Error(`${name} needs at least ${minimum}.`);
    }
    const offer = sellerId ? await offerForListing(admin, shop, sellerId, productId) : null;
    const charged = promotionalBase(unitPrice, quantity, offer);
    if (!(charged > 0)) {
      throw new Error('This offer takes the price to zero. Use a smaller discount.');
    }
    baseAmount = Math.round((baseAmount + charged) * 100) / 100;
    quoted.push({
      productId,
      name,
      quantity,
      unitPrice: Math.round((charged / quantity) * 100) / 100,
      lineTotal: charged,
    });
  }
  if (!(baseAmount > 0)) {
    throw new Error('Order total is invalid');
  }
  return { baseAmount, lines: quoted };
}
