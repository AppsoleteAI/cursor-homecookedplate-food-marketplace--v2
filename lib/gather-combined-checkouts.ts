import { getCompany } from '@/constants/cater-event-deliver';
import { getFarm, getCatalogProduct } from '@/constants/farm-grown-basket';
import { getMenuItem, getTruck } from '@/constants/food-truck-popup';
import { getPrepCook } from '@/constants/meal-prep-go';
import { getPlace } from '@/constants/sit-down-delicious';
import { checkoutKey, type CheckoutArea } from '@/backend/lib/combined-checkout';
import type { ShopFulfillment } from '@/backend/lib/shop-fulfillment';
import { deviceTimeZone } from '@/lib/pickup-time';
import type { CartItem } from '@/types';

const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CombinedLine = {
  productId: string;
  quantity: number;
  pickupTime?: string;
  pickupTimeZone?: string;
  specialInstructions?: string;
  cookingTemperature?: string;
  allergies?: string[];
};

export type CombinedCheckoutDraft = {
  area: CheckoutArea;
  sellerId: string;
  sellerName: string;
  lines: CombinedLine[];
};

type Bucket = CombinedCheckoutDraft;

function sellerOrCatalog(sellerId?: string): string {
  return sellerId && SELLER_ID.test(sellerId) ? sellerId : '';
}

/** Matches the server receipt id. A catalog seller with no profile id is keyed by the area. */
export function combinedChargeKey(area: CheckoutArea, sellerId: string): string {
  return checkoutKey(area, SELLER_ID.test(sellerId) ? sellerId : area);
}

export function payableCheckouts(
  checkouts: CombinedCheckoutDraft[],
  handoffs: Record<string, ShopFulfillment | null | undefined> = {},
  homeDelivery: Record<string, string | undefined> = {},
) {
  return checkouts.map((checkout) => {
    const handoff = handoffs[combinedChargeKey(checkout.area, checkout.sellerId)] ?? undefined;
    const address = checkout.area === 'home' ? (homeDelivery[checkout.sellerId] || '').trim() : '';
    return {
      area: checkout.area,
      lines: checkout.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        ...(line.pickupTime ? { pickupTime: line.pickupTime } : {}),
        ...(line.pickupTimeZone ? { pickupTimeZone: line.pickupTimeZone } : {}),
        ...(line.specialInstructions ? { specialInstructions: line.specialInstructions } : {}),
        ...(line.cookingTemperature ? { cookingTemperature: line.cookingTemperature } : {}),
        ...(line.allergies && line.allergies.length > 0 ? { allergies: line.allergies } : {}),
      })),
      ...(SELLER_ID.test(checkout.sellerId) ? { sellerId: checkout.sellerId } : {}),
      ...(handoff ? { handoff } : {}),
      ...(address.length >= 8 ? { deliveryAddress: address } : {}),
    };
  });
}

function addLine(buckets: Map<string, Bucket>, draft: Omit<Bucket, 'lines'>, line: CombinedLine) {
  const key = checkoutKey(draft.area, draft.sellerId);
  const existing = buckets.get(key);
  if (!existing) {
    buckets.set(key, { ...draft, lines: [{ ...line }] });
    return;
  }
  const found = existing.lines.find((item) => item.productId === line.productId);
  if (found) {
    found.quantity += line.quantity;
    if (!found.pickupTime && line.pickupTime) found.pickupTime = line.pickupTime;
    if (!found.pickupTimeZone && line.pickupTimeZone) found.pickupTimeZone = line.pickupTimeZone;
  } else {
    existing.lines.push({ ...line });
  }
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
    }, {
      productId: item.meal.id,
      quantity: item.quantity,
      ...(item.pickupTime ? { pickupTime: item.pickupTime.toISOString(), pickupTimeZone: deviceTimeZone() } : {}),
      ...(item.specialInstructions ? { specialInstructions: item.specialInstructions } : {}),
      ...(item.cookingTemperature ? { cookingTemperature: item.cookingTemperature } : {}),
      ...(item.allergies && item.allergies.length > 0 ? { allergies: item.allergies } : {}),
    });
  }

  for (const item of input.farm) {
    const product = getCatalogProduct(item.productId);
    const farm = product ? getFarm(product.farmId) : undefined;
    if (!product || !farm) {
      blocked.push(`${product?.name || 'A farm good'} is not on the menu, so it cannot be charged.`);
      continue;
    }
    addLine(buckets, { area: 'farm', sellerId: sellerOrCatalog(farm.sellerId), sellerName: farm.name }, { productId: item.productId, quantity: item.quantity });
  }

  for (const item of input.prep) {
    const cook = getPrepCook(item.cookId);
    if (!cook) {
      blocked.push('A weekly item is not on the menu, so it cannot be charged.');
      continue;
    }
    addLine(buckets, { area: 'meal_prep', sellerId: sellerOrCatalog(cook.sellerId), sellerName: cook.name }, { productId: item.itemId, quantity: item.quantity });
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
    }, { productId: item.itemId, quantity: item.quantity });
  }

  for (const item of input.cater) {
    const company = getCompany(item.companyId);
    if (!company) {
      blocked.push('A catering package is not on the menu, so it cannot be charged.');
      continue;
    }
    addLine(buckets, { area: 'catering', sellerId: sellerOrCatalog(company.sellerId), sellerName: company.name }, { productId: item.packageId, quantity: item.headcount });
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
    }, { productId: item.itemId, quantity: item.quantity });
  }

  return { checkouts: [...buckets.values()], blocked };
}
