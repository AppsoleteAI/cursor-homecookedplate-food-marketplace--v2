import type { CheckoutArea } from '@/backend/lib/combined-checkout';
import { checkoutAreaShop, type ShopFulfillment } from '@/backend/lib/shop-fulfillment';

/**
 * A shop area on a combined charge uses the same handoff as that lane's own checkout.
 * A plate on the same charge has no shop handoff.
 * A ghost kitchen is takeout. It has no table.
 */
export function assertShopHandoff(
  area: CheckoutArea,
  handoff: ShopFulfillment | undefined,
): ShopFulfillment | null {
  const shop = checkoutAreaShop(area);
  if (!shop) {
    if (handoff) throw new Error('A plate checkout has no shop handoff.');
    return null;
  }
  if (!handoff || handoff.shop !== shop) {
    throw new Error('Choose a pickup, drop-off, or table before this order is paid.');
  }
  if (area === 'ghost_kitchen' && (handoff.shop !== 'sit_down' || handoff.service !== 'takeout')) {
    throw new Error('A ghost kitchen is takeout. It has no table.');
  }
  return handoff;
}
