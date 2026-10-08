import { CATER_PACKAGES } from '@/constants/cater-event-deliver';
import { FARM_PRODUCTS } from '@/constants/farm-grown-basket';
import { TRUCK_MENU } from '@/constants/food-truck-popup';
import { PREP_ITEMS } from '@/constants/meal-prep-go';
import { SIT_DOWN_MENU } from '@/constants/sit-down-delicious';

export const SHOP_NAMES = ['farm', 'food_truck', 'catering', 'sit_down', 'meal_prep'] as const;
export type ShopName = (typeof SHOP_NAMES)[number];

export type ShopQuoteLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type CatalogItem = {
  name: string;
  unitPrice: number;
  minimum: number;
};

function catalogFor(shop: ShopName): Map<string, CatalogItem> {
  if (shop === 'farm') {
    return new Map(FARM_PRODUCTS.map((item) => [item.id, { name: item.name, unitPrice: item.price, minimum: 1 }]));
  }
  if (shop === 'food_truck') {
    return new Map(TRUCK_MENU.map((item) => [item.id, { name: item.name, unitPrice: item.price, minimum: 1 }]));
  }
  if (shop === 'catering') {
    return new Map(CATER_PACKAGES.map((item) => [item.id, {
      name: item.name,
      unitPrice: item.pricePerPerson,
      minimum: item.minimumHeadcount,
    }]));
  }
  if (shop === 'sit_down') {
    return new Map(SIT_DOWN_MENU.map((item) => [item.id, { name: item.name, unitPrice: item.price, minimum: 1 }]));
  }
  return new Map(PREP_ITEMS.map((item) => [item.id, { name: item.name, unitPrice: item.price, minimum: 1 }]));
}

/**
 * Prices come from the server catalog. The phone does not send a price.
 */
export function quoteShopOrder(
  shop: ShopName,
  lines: { productId: string; quantity: number }[],
): { baseAmount: number; lines: ShopQuoteLine[] } {
  const catalog = catalogFor(shop);
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
  }

  const quoted: ShopQuoteLine[] = [];
  for (const [productId, quantity] of merged) {
    const item = catalog.get(productId);
    if (!item) {
      throw new Error('This item is not on the server menu, so it cannot be charged.');
    }
    if (quantity < item.minimum) {
      throw new Error(`${item.name} needs at least ${item.minimum}.`);
    }
    quoted.push({
      productId,
      name: item.name,
      quantity,
      unitPrice: item.unitPrice,
    });
  }

  const baseAmount = Math.round(
    quoted.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) * 100,
  ) / 100;
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    throw new Error('Order total is invalid');
  }
  return { baseAmount, lines: quoted };
}
