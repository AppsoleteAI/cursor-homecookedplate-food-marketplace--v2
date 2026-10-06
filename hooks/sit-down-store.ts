import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { DiningService, SitDownLicense } from '@/lib/sit-down-license';
import { evaluateSitDownItem } from '@/lib/sit-down-license';

const STORAGE_KEY = 'sit_down_delicious_v1';

export type SitCartLine = {
  itemId: string;
  placeId: string;
  quantity: number;
};

export type SitOrderLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type SitOrder = {
  id: string;
  createdAt: string;
  placeId: string;
  placeName: string;
  service: DiningService;
  partySize: number;
  lines: SitOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
};

export type SitListing = {
  id: string;
  placeId: 'owner-place';
  name: string;
  price: number;
  summary: string;
  ingredients: string;
  allergens: string;
};

type SitState = {
  items: SitCartLine[];
  follows: string[];
  orders: SitOrder[];
  license: SitDownLicense | null;
  listings: SitListing[];
  ownerOpen: boolean;
};

let state: SitState = {
  items: [],
  follows: [],
  orders: [],
  license: null,
  listings: [],
  ownerOpen: false,
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

export function hydrateSitDown() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SitState>;
      state = {
        items: parsed.items ?? [],
        follows: parsed.follows ?? [],
        orders: parsed.orders ?? [],
        license: parsed.license ?? null,
        listings: parsed.listings ?? [],
        ownerOpen: parsed.ownerOpen ?? false,
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

export function addSitItem(
  itemId: string,
  placeId: string,
  quantity = 1,
): { ok: true } | { ok: false; reason: string } {
  const current = state.items[0]?.placeId;
  if (current && current !== placeId) {
    return { ok: false, reason: 'One restaurant per order. Clear the SitDownDelicious basket before you add from another shop.' };
  }
  const existing = state.items.find((item) => item.itemId === itemId);
  const items = existing
    ? state.items.map((item) =>
        item.itemId === itemId ? { ...item, quantity: Math.min(99, item.quantity + quantity) } : item
      )
    : [...state.items, { itemId, placeId, quantity }];
  state = { ...state, items };
  emit();
  return { ok: true };
}

export function setSitQuantity(itemId: string, quantity: number) {
  const items = quantity <= 0
    ? state.items.filter((item) => item.itemId !== itemId)
    : state.items.map((item) => (item.itemId === itemId ? { ...item, quantity } : item));
  state = { ...state, items };
  emit();
}

export function clearSitItems() {
  state = { ...state, items: [] };
  emit();
}

export function toggleSitFollow(placeId: string) {
  const follows = state.follows.includes(placeId)
    ? state.follows.filter((id) => id !== placeId)
    : [...state.follows, placeId];
  state = { ...state, follows };
  emit();
}

export function setOwnerOpen(ownerOpen: boolean) {
  state = { ...state, ownerOpen };
  emit();
}

export function saveSitLicense(license: SitDownLicense) {
  state = { ...state, license };
  emit();
}

export function publishSitItem(input: {
  name: string;
  price: number;
  summary: string;
  ingredients: string;
  allergens: string;
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluateSitDownItem(state.license, input);
  if (!check.ok) return check;
  const listing: SitListing = {
    id: `sit-item-${Date.now()}`,
    placeId: 'owner-place',
    name: input.name.trim(),
    price: input.price,
    summary: input.summary.trim(),
    ingredients: input.ingredients.trim(),
    allergens: input.allergens.trim(),
  };
  state = { ...state, listings: [listing, ...state.listings] };
  emit();
  return { ok: true };
}

export function placeSitOrder(input: {
  placeId: string;
  placeName: string;
  service: DiningService;
  partySize: number;
  lines: SitOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
}): SitOrder {
  const order: SitOrder = {
    id: `sdd-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state = { ...state, items: [], orders: [order, ...state.orders] };
  emit();
  return order;
}

export function useSitDown() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const itemCount = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    ...snapshot,
    itemCount,
    addItem: addSitItem,
    setQuantity: setSitQuantity,
    clearItems: clearSitItems,
    toggleFollow: toggleSitFollow,
    setOwnerOpen,
    saveLicense: saveSitLicense,
    publishItem: publishSitItem,
    placeOrder: placeSitOrder,
  };
}
