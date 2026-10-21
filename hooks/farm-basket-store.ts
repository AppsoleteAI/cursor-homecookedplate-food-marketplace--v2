import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { SavedShopOrder } from '@/backend/lib/shop-fulfillment';
import { useSavedShopOrders } from '@/hooks/use-saved-shop-orders';
import type { ComplianceRecord, FarmChannel, RegulatoryTrack } from '@/lib/cottage-food';
import { evaluateListing } from '@/lib/cottage-food';
import { farmOrdersFromSaved, mergeById, sameOrders } from '@/lib/saved-shop-order';
import { shareLaneListing, useSharedLaneListings } from '@/lib/lane-sync';

const STORAGE_KEY = 'farm_grown_basket_v1';

export type FarmCartLine = {
  productId: string;
  quantity: number;
};

export type FarmOrderLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  track: RegulatoryTrack;
};

export type FarmOrder = {
  id: string;
  createdAt: string;
  channel: FarmChannel;
  lines: FarmOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
  paid?: boolean;
  sellerId?: string | null;
  orderStatus?: string;
  handoffNote?: string;
};

export type FarmListing = {
  id: string;
  name: string;
  price: number;
  unit: string;
  summary: string;
  track: RegulatoryTrack;
  farmName: string;
  stateCode: string;
  county: string;
  ingredients: string;
  allergens: string;
  image?: string;
};

type FarmState = {
  items: FarmCartLine[];
  follows: string[];
  orders: FarmOrder[];
  compliance: ComplianceRecord | null;
  listings: FarmListing[];
};

let state: FarmState = {
  items: [],
  follows: [],
  orders: [],
  compliance: null,
  listings: [],
};

const listeners = new Set<() => void>();
let hydrateStarted = false;
let storeGeneration = 0;

function emit() {
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function hydrateFarmBasket() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  const generation = storeGeneration;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (generation !== storeGeneration || !raw) return;
      const parsed = JSON.parse(raw) as Partial<FarmState>;
      state = {
        items: parsed.items ?? [],
        follows: parsed.follows ?? [],
        orders: mergeById(parsed.orders ?? [], state.orders),
        compliance: parsed.compliance ?? null,
        listings: parsed.listings ?? [],
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

export function addFarmItem(productId: string, quantity = 1) {
  const existing = state.items.find((item) => item.productId === productId);
  const items = existing
    ? state.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
          : item
      )
    : [...state.items, { productId, quantity }];
  state = { ...state, items };
  emit();
}

export function setFarmQuantity(productId: string, quantity: number) {
  const items = quantity <= 0
    ? state.items.filter((item) => item.productId !== productId)
    : state.items.map((item) => (item.productId === productId ? { ...item, quantity } : item));
  state = { ...state, items };
  emit();
}

export function clearFarmItems() {
  state = { ...state, items: [] };
  emit();
}

/** Drop the paid lines and keep the saved listings. Safe before the lane screen has loaded. */
export async function forgetPaidFarmItems() {
  storeGeneration += 1;
  hydrateStarted = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FarmState>;
      state = {
        items: [],
        follows: parsed.follows ?? state.follows,
        orders: mergeById(parsed.orders ?? [], state.orders),
        compliance: parsed.compliance ?? state.compliance,
        listings: parsed.listings ?? state.listings,
      };
    } else {
      state = { ...state, items: [] };
    }
  } catch {
    state = { ...state, items: [] };
  }
  emit();
}

export function toggleFarmFollow(farmId: string) {
  const follows = state.follows.includes(farmId)
    ? state.follows.filter((id) => id !== farmId)
    : [...state.follows, farmId];
  state = { ...state, follows };
  emit();
}

export function saveFarmCompliance(compliance: ComplianceRecord) {
  state = { ...state, compliance };
  emit();
}

export function publishFarmListing(input: {
  name: string;
  price: number;
  unit: string;
  summary: string;
  image?: string;
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluateListing(state.compliance);
  if (!check.ok || !state.compliance) return { ok: false, blocks: check.blocks };
  if (!input.image) return { ok: false, blocks: ['Add a photo of this good.'] };
  const listing: FarmListing = {
    id: `listing-${Date.now()}`,
    name: input.name.trim(),
    price: input.price,
    unit: input.unit.trim(),
    summary: input.summary.trim(),
    track: state.compliance.track,
    farmName: state.compliance.farmName.trim(),
    stateCode: state.compliance.stateCode,
    county: state.compliance.county.trim(),
    ingredients: state.compliance.ingredients.trim(),
    allergens: state.compliance.allergens.trim(),
    image: input.image,
  };
  state = { ...state, listings: [listing, ...state.listings] };
  emit();
  shareLaneListing('farm', listing);
  return { ok: true };
}

function applySharedFarmListings(listings: FarmListing[]) {
  state = { ...state, listings };
  emit();
}

export function placeFarmOrder(input: {
  id?: string;
  channel: FarmChannel;
  lines: FarmOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
}): FarmOrder {
  const order: FarmOrder = {
    id: input.id ?? `fgb-${Date.now()}`,
    createdAt: new Date().toISOString(),
    channel: input.channel,
    lines: input.lines,
    baseAmount: input.baseAmount,
    buyerPays: input.buyerPays,
    sellerPayout: input.sellerPayout,
  };
  state = { ...state, items: [], orders: [order, ...state.orders.filter((existing) => existing.id !== order.id)] };
  emit();
  return order;
}

export function applyServerFarmOrders(rows: SavedShopOrder[]) {
  const next = mergeById(state.orders, farmOrdersFromSaved(rows));
  if (sameOrders(state.orders, next)) return;
  state = { ...state, orders: next };
  emit();
}

export function useFarmBasket() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useSavedShopOrders('farm', applyServerFarmOrders);
  useSharedLaneListings('farm', snapshot.listings, applySharedFarmListings);
  const itemCount = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    ...snapshot,
    itemCount,
    addItem: addFarmItem,
    setQuantity: setFarmQuantity,
    clearItems: clearFarmItems,
    toggleFollow: toggleFarmFollow,
    saveCompliance: saveFarmCompliance,
    publishListing: publishFarmListing,
    placeOrder: placeFarmOrder,
  };
}
