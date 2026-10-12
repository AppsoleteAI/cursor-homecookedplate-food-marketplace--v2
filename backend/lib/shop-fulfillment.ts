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
  fulfillment: ShopFulfillment;
};

function isLine(value: unknown): value is ShopLineItem {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<ShopLineItem>;
  return typeof line.productId === 'string'
    && typeof line.name === 'string'
    && typeof line.quantity === 'number'
    && typeof line.unitPrice === 'number';
}

export function unpackShopLines(existing: unknown): { items: ShopLineItem[]; fulfillment?: unknown } {
  if (Array.isArray(existing)) {
    return { items: existing.filter(isLine) };
  }
  if (!existing || typeof existing !== 'object') return { items: [] };
  const record = existing as { items?: unknown; fulfillment?: unknown };
  return {
    items: Array.isArray(record.items) ? record.items.filter(isLine) : [],
    fulfillment: record.fulfillment,
  };
}

/** Keeps the server-priced lines and attaches the handoff the buyer chose. */
export function packShopLines(existing: unknown, fulfillment: ShopFulfillment) {
  return {
    items: unpackShopLines(existing).items,
    fulfillment,
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
}): SavedShopOrder | null {
  if (!SHOP_NAMES.includes(row.shop as ShopName)) return null;
  const packed = unpackShopLines(row.lines);
  const parsed = shopFulfillmentSchema.safeParse(packed.fulfillment);
  if (!parsed.success || parsed.data.shop !== row.shop) return null;
  const baseAmount = Number(row.base_amount);
  const buyerPays = Number(row.total_charge);
  if (!Number.isFinite(baseAmount) || !Number.isFinite(buyerPays)) return null;
  return {
    id: row.id,
    shop: parsed.data.shop,
    createdAt: row.created_at,
    baseAmount,
    buyerPays,
    sellerPayout: money(calculateFees(baseAmount).sellerPayout),
    items: packed.items,
    fulfillment: parsed.data,
  };
}
