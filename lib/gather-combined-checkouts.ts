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
    if (!farm?.sellerId || !SELLER_ID.test(farm.sellerId)) {
      blocked.push(`${product?.name || 'A farm good'} is not open for app payment.`);
      continue;
    }
    addLine(buckets, { area: 'farm', sellerId: farm.sellerId, sellerName: farm.name }, item.productId, item.quantity);
  }

  for (const item of input.prep) {
    const cook = getPrepCook(item.cookId);
    if (!cook?.sellerId || !SELLER_ID.test(cook.sellerId)) {
      blocked.push(`${cook?.name || 'A prep cook'} is not open for app payment.`);
      continue;
    }
    addLine(buckets, { area: 'meal_prep', sellerId: cook.sellerId, sellerName: cook.name }, item.itemId, item.quantity);
  }

  for (const item of input.truck) {
    const truck = getTruck(item.truckId);
    const menu = getMenuItem(item.itemId);
    if (!truck?.sellerId || !SELLER_ID.test(truck.sellerId)) {
      blocked.push(`${truck?.name || menu?.name || 'A truck'} is not open for app payment.`);
      continue;
    }
    addLine(buckets, {
      area: truck.unit === 'cart' ? 'food_cart' : 'food_truck',
      sellerId: truck.sellerId,
      sellerName: truck.name,
    }, item.itemId, item.quantity);
  }

  for (const item of input.cater) {
    const company = getCompany(item.companyId);
    if (!company?.sellerId || !SELLER_ID.test(company.sellerId)) {
      blocked.push(`${company?.name || 'A caterer'} is not open for app payment.`);
      continue;
    }
    addLine(buckets, { area: 'catering', sellerId: company.sellerId, sellerName: company.name }, item.packageId, item.headcount);
  }

  for (const item of input.sit) {
    const place = getPlace(item.placeId);
    if (!place?.sellerId || !SELLER_ID.test(place.sellerId)) {
      blocked.push(`${place?.name || 'A restaurant'} is not open for app payment.`);
      continue;
    }
    addLine(buckets, {
      area: place.kind === 'ghost_kitchen' ? 'ghost_kitchen' : 'sit_down',
      sellerId: place.sellerId,
      sellerName: place.name,
    }, item.itemId, item.quantity);
  }

  return { checkouts: [...buckets.values()], blocked };
}
