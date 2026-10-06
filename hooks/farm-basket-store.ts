import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { ComplianceRecord, FarmChannel, RegulatoryTrack } from '@/lib/cottage-food';
import { evaluateListing } from '@/lib/cottage-food';

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
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FarmState>;
      state = {
        items: parsed.items ?? [],
        follows: parsed.follows ?? [],
        orders: parsed.orders ?? [],
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
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluateListing(state.compliance);
  if (!check.ok || !state.compliance) return { ok: false, blocks: check.blocks };
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
  };
  state = { ...state, listings: [listing, ...state.listings] };
  emit();
  return { ok: true };
}

export function placeFarmOrder(input: {
  channel: FarmChannel;
  lines: FarmOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
}): FarmOrder {
  const order: FarmOrder = {
    id: `fgb-${Date.now()}`,
    createdAt: new Date().toISOString(),
    channel: input.channel,
    lines: input.lines,
    baseAmount: input.baseAmount,
    buyerPays: input.buyerPays,
    sellerPayout: input.sellerPayout,
  };
  state = { ...state, items: [], orders: [order, ...state.orders] };
  emit();
  return order;
}

export function useFarmBasket() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
