import { getCompany } from '@/constants/cater-event-deliver';
import { getFarm, getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem, getTruck } from '@/constants/food-truck-popup';
import { getPrepCook } from '@/constants/meal-prep-go';
import { getPlace } from '@/constants/sit-down-delicious';
import { checkoutKey, type CheckoutArea } from '@/backend/lib/combined-checkout';
import type { CartItem } from '@/types';

const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CombinedCheckoutDraft = {
  area: CheckoutArea;
  sellerId: string;
  sellerName: string;
  lines: { productId: string; quantity: number }[];
};

type Bucket = CombinedCheckoutDraft;

function sellerOrCatalog(sellerId?: string): string {
  return sellerId && SELLER_ID.test(sellerId) ? sellerId : '';
}

export function payableCheckouts(checkouts: CombinedCheckoutDraft[]) {
  return checkouts.map((checkout) => ({
    area: checkout.area,
    lines: checkout.lines,
    ...(SELLER_ID.test(checkout.sellerId) ? { sellerId: checkout.sellerId } : {}),
  }));
}

function addLine(buckets: Map<string, Bucket>, draft: Omit<Bucket, 'lines'>, productId: string, quantity: number) {
  const key = checkoutKey(draft.area, draft.sellerId);
  const existing = buckets.get(key);
  if (!existing) {
    buckets.set(key, { ...draft, lines: [{ productId, quantity }] });
    return;
  }
  const line = existing.lines.find((item) => item.productId === productId);
  if (line) line.quantity += quantity;
  else existing.lines.push({ productId, quantity });
}

export function gatherCombinedCheckouts(input: {
  home: CartItem[];
  farm: { productId: string; quantity: number }[];
  prep: { itemId: string; cookId: string; quantity: number }[];
  truck: { itemId: string; truckId: string; quantity: number }[];
  cater: { packageId: string; companyId: string; headcount: number }[];
  sit: { itemId: string; placeId: string; quantity: number }[];
}): { checkouts: CombinedCheckoutDraft[]; blocked: string[] } {
  const buckets = new Map<string, Bucket>();
  const blocked: string[] = [];

  for (const item of input.home) {
    if (!SELLER_ID.test(item.meal.plateMakerId)) {
      blocked.push(`${item.meal.name} has no in-app cook.`);
      continue;
    }
    addLine(buckets, {
      area: 'home',
      sellerId: item.meal.plateMakerId,
      sellerName: item.meal.plateMakerName || 'Cook',
    }, item.meal.id, item.quantity);
  }

  for (const item of input.farm) {
    const product = getCatalogProduct(item.productId);
    const farm = product ? getFarm(product.farmId) : undefined;
    if (!product || !farm) {
      blocked.push(`${product?.name || 'A farm good'} is not on the menu, so it cannot be charged.`);
      continue;
    }
    addLine(buckets, { area: 'farm', sellerId: sellerOrCatalog(farm.sellerId), sellerName: farm.name }, item.productId, item.quantity);
  }

  for (const item of input.prep) {
    const cook = getPrepCook(item.cookId);
    if (!cook) {
      blocked.push('A weekly item is not on the menu, so it cannot be charged.');
      continue;
    }
    addLine(buckets, { area: 'meal_prep', sellerId: sellerOrCatalog(cook.sellerId), sellerName: cook.name }, item.itemId, item.quantity);
  }

  for (const item of input.truck) {
    const truck = getTruck(item.truckId);
    const menu = getMenuItem(item.itemId);
    if (!truck || !menu) {
      blocked.push(`${truck?.name || menu?.name || 'A truck item'} is not on the menu, so it cannot be charged.`);
      continue;
    }
    addLine(buckets, {
      area: truck.unit === 'cart' ? 'food_cart' : 'food_truck',
      sellerId: sellerOrCatalog(truck.sellerId),
      sellerName: truck.name,
    }, item.itemId, item.quantity);
  }

  for (const item of input.cater) {
    const company = getCompany(item.companyId);
    if (!company) {
      blocked.push('A catering package is not on the menu, so it cannot be charged.');
      continue;
    }
    addLine(buckets, { area: 'catering', sellerId: sellerOrCatalog(company.sellerId), sellerName: company.name }, item.packageId, item.headcount);
  }

  for (const item of input.sit) {
    const place = getPlace(item.placeId);
    if (!place) {
      blocked.push('A restaurant item is not on the menu, so it cannot be charged.');
      continue;
    }
    addLine(buckets, {
      area: place.kind === 'ghost_kitchen' ? 'ghost_kitchen' : 'sit_down',
      sellerId: sellerOrCatalog(place.sellerId),
      sellerName: place.name,
    }, item.itemId, item.quantity);
  }

  return { checkouts: [...buckets.values()], blocked };
}
