import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { PickupSlot, TruckPermitRecord } from '@/lib/food-truck-permit';
import { evaluateTruckMenuItem } from '@/lib/food-truck-permit';

const STORAGE_KEY = 'food_truck_popup_v1';

export type TruckCartLine = {
  itemId: string;
  truckId: string;
  quantity: number;
};

export type TruckOrderLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type TruckOrder = {
  id: string;
  createdAt: string;
  truckId: string;
  truckName: string;
  pickupSlot: PickupSlot;
  lines: TruckOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
};

export type TruckListing = {
  id: string;
  truckId: 'owner-truck';
  name: string;
  price: number;
  summary: string;
  ingredients: string;
  allergens: string;
};

type TruckState = {
  items: TruckCartLine[];
  follows: string[];
  orders: TruckOrder[];
  permit: TruckPermitRecord | null;
  listings: TruckListing[];
  ownerActive: boolean;
};

let state: TruckState = {
  items: [],
  follows: [],
  orders: [],
  permit: null,
  listings: [],
  ownerActive: false,
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

export function hydrateFoodTruck() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TruckState>;
      state = {
        items: parsed.items ?? [],
        follows: parsed.follows ?? [],
        orders: parsed.orders ?? [],
        permit: parsed.permit ?? null,
        listings: parsed.listings ?? [],
        ownerActive: parsed.ownerActive ?? false,
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

export function addTruckItem(
  itemId: string,
  truckId: string,
  quantity = 1,
): { ok: true } | { ok: false; reason: string } {
  const currentTruck = state.items[0]?.truckId;
  if (currentTruck && currentTruck !== truckId) {
    return { ok: false, reason: 'A window order is one truck at a time. Clear the truck basket before you add from somewhere else.' };
  }
  const existing = state.items.find((item) => item.itemId === itemId);
  const items = existing
    ? state.items.map((item) =>
        item.itemId === itemId ? { ...item, quantity: Math.min(99, item.quantity + quantity) } : item
      )
    : [...state.items, { itemId, truckId, quantity }];
  state = { ...state, items };
  emit();
  return { ok: true };
}

export function setTruckQuantity(itemId: string, quantity: number) {
  const items = quantity <= 0
    ? state.items.filter((item) => item.itemId !== itemId)
    : state.items.map((item) => (item.itemId === itemId ? { ...item, quantity } : item));
  state = { ...state, items };
  emit();
}

export function clearTruckItems() {
  state = { ...state, items: [] };
  emit();
}

export function toggleTruckFollow(truckId: string) {
  const follows = state.follows.includes(truckId)
    ? state.follows.filter((id) => id !== truckId)
    : [...state.follows, truckId];
  state = { ...state, follows };
  emit();
}

export function setOwnerActive(ownerActive: boolean) {
  state = { ...state, ownerActive };
  emit();
}

export function saveTruckPermit(permit: TruckPermitRecord) {
  state = { ...state, permit };
  emit();
}

export function publishTruckItem(input: {
  name: string;
  price: number;
  summary: string;
  ingredients: string;
  allergens: string;
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluateTruckMenuItem(state.permit, input);
  if (!check.ok) return check;
  const listing: TruckListing = {
    id: `truck-item-${Date.now()}`,
    truckId: 'owner-truck',
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

export function placeTruckOrder(input: {
  id?: string;
  truckId: string;
  truckName: string;
  pickupSlot: PickupSlot;
  lines: TruckOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
}): TruckOrder {
  const { id, ...rest } = input;
  const order: TruckOrder = {
    id: id ?? `ftp-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...rest,
  };
  state = { ...state, items: [], orders: [order, ...state.orders] };
  emit();
  return order;
}

export function useFoodTruck() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const itemCount = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    ...snapshot,
    itemCount,
    addItem: addTruckItem,
    setQuantity: setTruckQuantity,
    clearItems: clearTruckItems,
    toggleFollow: toggleTruckFollow,
    setOwnerActive,
    savePermit: saveTruckPermit,
    publishItem: publishTruckItem,
    placeOrder: placeTruckOrder,
  };
}
