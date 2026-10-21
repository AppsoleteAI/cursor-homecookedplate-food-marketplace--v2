import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { SavedShopOrder } from '@/backend/lib/shop-fulfillment';
import { useSavedShopOrders } from '@/hooks/use-saved-shop-orders';
import { mergeById, prepOrdersFromSaved, sameOrders } from '@/lib/saved-shop-order';
import type { PrepDiet, PrepLane } from '@/constants/meal-prep-go';
import { evaluatePrepItem, type PrepKitchenRecord } from '@/lib/meal-prep-go';
import { shareLaneListing, useSharedLaneListings } from '@/lib/lane-sync';

const STORAGE_KEY = 'meal_prep_go_v1';

export type PrepCartLine = {
  itemId: string;
  cookId: string;
  quantity: number;
};

export type PrepOrderLine = {
  itemId: string;
  name: string;
  lane: PrepLane;
  quantity: number;
  unitPrice: number;
  minutes: number;
};

export type PrepOrder = {
  id: string;
  createdAt: string;
  cookId: string;
  cookName: string;
  handoff: 'pickup' | 'dropoff';
  windowLabel: string;
  address: string;
  mix: string;
  lines: PrepOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
  paid?: boolean;
  sellerId?: string | null;
  orderStatus?: string;
  handoffNote?: string;
};

export type PrepListing = {
  id: string;
  cookId: 'owner-kitchen';
  lane: PrepLane;
  name: string;
  price: number;
  minutes: number;
  diet: PrepDiet;
  summary: string;
  ingredients: string;
  allergens: string;
  recipeNote: string;
  image?: string;
};

type PrepState = {
  items: PrepCartLine[];
  orders: PrepOrder[];
  kitchen: PrepKitchenRecord | null;
  listings: PrepListing[];
  accepting: boolean;
};

let state: PrepState = {
  items: [],
  orders: [],
  kitchen: null,
  listings: [],
  accepting: false,
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

export function hydrateMealPrep() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  const generation = storeGeneration;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (generation !== storeGeneration || !raw) return;
      const parsed = JSON.parse(raw) as Partial<PrepState>;
      state = {
        items: parsed.items ?? [],
        orders: mergeById(parsed.orders ?? [], state.orders),
        kitchen: parsed.kitchen ?? null,
        listings: parsed.listings ?? [],
        accepting: parsed.accepting ?? false,
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

export function setPrepQuantity(
  itemId: string,
  cookId: string,
  quantity: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, reason: 'Enter a whole number of portions.' };
  }
  const currentCook = state.items[0]?.cookId;
  if (quantity > 0 && currentCook && currentCook !== cookId) {
    return { ok: false, reason: 'A week comes from one cook. Clear the week before you add food from someone else.' };
  }
  const items = quantity === 0
    ? state.items.filter((item) => item.itemId !== itemId)
    : state.items.some((item) => item.itemId === itemId)
      ? state.items.map((item) => (item.itemId === itemId ? { ...item, quantity } : item))
      : [...state.items, { itemId, cookId, quantity }];
  state = { ...state, items };
  emit();
  return { ok: true };
}

export function clearPrepWeek() {
  state = { ...state, items: [] };
  emit();
}

/** Drop a paid week and keep the saved kitchen and menu. */
export async function forgetPaidPrepItems() {
  storeGeneration += 1;
  hydrateStarted = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PrepState>;
      state = {
        items: [],
        orders: mergeById(parsed.orders ?? [], state.orders),
        kitchen: parsed.kitchen ?? state.kitchen,
        listings: parsed.listings ?? state.listings,
        accepting: parsed.accepting ?? state.accepting,
      };
    } else {
      state = { ...state, items: [] };
    }
  } catch {
    state = { ...state, items: [] };
  }
  emit();
}

export function setPrepAccepting(accepting: boolean) {
  state = { ...state, accepting };
  emit();
}

export function savePrepKitchen(kitchen: PrepKitchenRecord) {
  state = { ...state, kitchen };
  emit();
}

export function publishPrepItem(input: {
  lane: PrepLane;
  name: string;
  price: number;
  minutes: number;
  diet: PrepDiet;
  summary: string;
  ingredients: string;
  allergens: string;
  recipeNote: string;
  image?: string;
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluatePrepItem(state.kitchen, input);
  if (!check.ok) return check;
  if (!input.image) return { ok: false, blocks: ['Add a photo of this weekly item.'] };
  const listing: PrepListing = {
    id: `prep-item-${Date.now()}`,
    cookId: 'owner-kitchen',
    lane: input.lane,
    name: input.name.trim(),
    price: input.price,
    minutes: input.minutes,
    diet: input.diet,
    summary: input.summary.trim(),
    ingredients: input.ingredients.trim(),
    allergens: input.allergens.trim(),
    recipeNote: input.recipeNote.trim(),
    image: input.image,
  };
  state = { ...state, listings: [listing, ...state.listings] };
  emit();
  shareLaneListing('meal_prep', listing);
  return { ok: true };
}

function applySharedPrepListings(listings: PrepListing[]) {
  state = { ...state, listings };
  emit();
}

export function placePrepOrder(input: {
  id?: string;
  cookId: string;
  cookName: string;
  handoff: 'pickup' | 'dropoff';
  windowLabel: string;
  address: string;
  mix: string;
  lines: PrepOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
}): PrepOrder {
  const { id, ...rest } = input;
  const order: PrepOrder = {
    id: id ?? `mpg-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...rest,
  };
  state = { ...state, items: [], orders: [order, ...state.orders.filter((existing) => existing.id !== order.id)] };
  emit();
  return order;
}

export function applyServerPrepOrders(rows: SavedShopOrder[]) {
  const next = mergeById(state.orders, prepOrdersFromSaved(rows));
  if (sameOrders(state.orders, next)) return;
  state = { ...state, orders: next };
  emit();
}

export function useMealPrep() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useSavedShopOrders('meal_prep', applyServerPrepOrders);
  useSharedLaneListings('meal_prep', snapshot.listings, applySharedPrepListings);
  const portionCount = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    ...snapshot,
    portionCount,
    itemCount: snapshot.items.length,
    setQuantity: setPrepQuantity,
    clearWeek: clearPrepWeek,
    setAccepting: setPrepAccepting,
    saveKitchen: savePrepKitchen,
    publishItem: publishPrepItem,
    placeOrder: placePrepOrder,
  };
}
