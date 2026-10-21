import { z } from 'zod';
import { calculateFees } from '@/backend/lib/fees';
import { SHOP_NAMES, type ShopName } from '@/backend/lib/shop-catalog';
import { DROP_OFF_WINDOWS } from '@/lib/cater-event-license';
import { PICKUP_SLOTS } from '@/lib/food-truck-permit';

const FARM_CHANNELS = [
  'farm_pickup',
  'community_pickup',
  'farm_stand',
  'hand_delivery',
  'hub_delivery',
] as const;

export const shopFulfillmentSchema = z.discriminatedUnion('shop', [
  z.object({
    shop: z.literal('farm'),
    channel: z.enum(FARM_CHANNELS),
  }),
  z.object({
    shop: z.literal('meal_prep'),
    cookId: z.string().min(1).max(80),
    cookName: z.string().min(1).max(120),
    handoff: z.enum(['pickup', 'dropoff']),
    windowLabel: z.string().min(1).max(160),
    address: z.string().max(240),
    mix: z.string().min(1).max(80),
  }).superRefine((value, ctx) => {
    if (value.handoff === 'dropoff' && value.address.trim().length < 8) {
      ctx.addIssue({ code: 'custom', message: 'Enter the household address for drop-off.' });
    }
  }),
  z.object({
    shop: z.literal('food_truck'),
    truckId: z.string().min(1).max(80),
    truckName: z.string().min(1).max(120),
    pickupSlot: z.enum(PICKUP_SLOTS),
  }),
  z.object({
    shop: z.literal('catering'),
    companyId: z.string().min(1).max(80),
    companyName: z.string().min(1).max(120),
    organization: z.string().min(2).max(120),
    dropoffWindow: z.enum(DROP_OFF_WINDOWS),
    address: z.string().min(8).max(240),
  }),
  z.object({
    shop: z.literal('sit_down'),
    placeId: z.string().min(1).max(80),
    placeName: z.string().min(1).max(120),
    service: z.enum(['sit_down', 'takeout']),
    partySize: z.number().int().min(1).max(12),
  }).transform((value) => ({
    ...value,
    partySize: value.service === 'takeout' ? 1 : value.partySize,
  })),
]);

export type ShopFulfillment = z.infer<typeof shopFulfillmentSchema>;

export const COMBINED_HANDOFF = 'Paid on a combined checkout';

/** An older combined charge saved before a handoff was collected. The order still belongs on that lane's screen. */
export type CombinedShopFulfillment = {
  shop: ShopName;
  combined: true;
  sellerId: string;
  sellerName: string;
  area: string;
};

export function checkoutAreaShop(area: string): ShopName | null {
  if (area === 'home') return null;
  if (area === 'food_cart') return 'food_truck';
  if (area === 'ghost_kitchen') return 'sit_down';
  if ((SHOP_NAMES as readonly string[]).includes(area)) return area as ShopName;
  return null;
}

export function isCombinedShopFulfillment(
  value: ShopFulfillment | CombinedShopFulfillment,
): value is CombinedShopFulfillment {
  return 'combined' in value && value.combined === true;
}

export type ShopLineItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type SavedShopOrder = {
  id: string;
  shop: ShopName;
  createdAt: string;
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
  items: ShopLineItem[];
  fulfillment: ShopFulfillment | CombinedShopFulfillment;
  paid: boolean;
  sellerId: string | null;
  orderStatus: string;
};

function isLine(value: unknown): value is ShopLineItem {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<ShopLineItem>;
  return typeof line.productId === 'string'
    && typeof line.name === 'string'
    && typeof line.quantity === 'number'
    && typeof line.unitPrice === 'number';
}

export function unpackShopLines(existing: unknown): {
  items: ShopLineItem[];
  fulfillment?: unknown;
  sellerId: string | null;
  status: string;
} {
  if (Array.isArray(existing)) {
    return { items: existing.filter(isLine), sellerId: null, status: 'pending' };
  }
  if (!existing || typeof existing !== 'object') return { items: [], sellerId: null, status: 'pending' };
  const record = existing as { items?: unknown; fulfillment?: unknown; sellerId?: unknown; status?: unknown };
  return {
    items: Array.isArray(record.items) ? record.items.filter(isLine) : [],
    fulfillment: record.fulfillment,
    sellerId: typeof record.sellerId === 'string' ? record.sellerId : null,
    status: typeof record.status === 'string' ? record.status : 'pending',
  };
}

/** Keeps the server-priced lines and attaches the handoff the buyer chose. */
export function packShopLines(existing: unknown, fulfillment: ShopFulfillment) {
  const unpacked = unpackShopLines(existing);
  return {
    items: unpacked.items,
    fulfillment,
    sellerId: unpacked.sellerId,
    status: unpacked.status,
  };
}

function money(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function presentSavedShopOrder(row: {
  id: string;
  shop: string;
  lines: unknown;
  base_amount: number | string;
  total_charge: number | string;
  created_at: string;
  paid?: boolean | null;
}): SavedShopOrder | null {
  if (!SHOP_NAMES.includes(row.shop as ShopName)) return null;
  const packed = unpackShopLines(row.lines);
  const baseAmount = Number(row.base_amount);
  const buyerPays = Number(row.total_charge);
  if (!Number.isFinite(baseAmount) || !Number.isFinite(buyerPays)) return null;
  const parsed = shopFulfillmentSchema.safeParse(packed.fulfillment);
  if (parsed.success && parsed.data.shop === row.shop) {
    return {
      id: row.id,
      shop: parsed.data.shop,
      createdAt: row.created_at,
      baseAmount,
      buyerPays,
      sellerPayout: money(calculateFees(baseAmount).sellerPayout),
      items: packed.items,
      fulfillment: parsed.data,
      paid: row.paid === true,
      sellerId: packed.sellerId,
      orderStatus: packed.status,
    };
  }
  const combined = combinedFulfillment(packed, row.shop);
  if (!combined) return null;
  return {
    id: row.id,
    shop: combined.shop,
    createdAt: row.created_at,
    baseAmount,
    buyerPays,
    sellerPayout: money(calculateFees(baseAmount).sellerPayout),
    items: packed.items,
    fulfillment: combined,
    paid: row.paid === true,
    sellerId: combined.sellerId,
    orderStatus: packed.status,
  };
}

function combinedFulfillment(
  packed: ReturnType<typeof unpackShopLines>,
  rowShop: string,
): CombinedShopFulfillment | null {
  if (!SHOP_NAMES.includes(rowShop as ShopName)) return null;
  const record = packed.fulfillment && typeof packed.fulfillment === 'object'
    ? packed.fulfillment as { area?: unknown; shop?: unknown; sellerId?: unknown; sellerName?: unknown }
    : null;
  if (!record) return null;
  const area = typeof record.area === 'string' ? record.area : typeof record.shop === 'string' ? record.shop : '';
  const shop = checkoutAreaShop(area);
  if (!shop || shop !== rowShop) return null;
  const sellerId = packed.sellerId || (typeof record.sellerId === 'string' ? record.sellerId : '');
  if (!sellerId) return null;
  const named = typeof record.sellerName === 'string' ? record.sellerName.trim() : '';
  return {
    shop,
    combined: true,
    sellerId,
    sellerName: named || 'Combined checkout',
    area,
  };
}
