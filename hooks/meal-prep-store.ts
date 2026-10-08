import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { PrepDiet, PrepLane } from '@/constants/meal-prep-go';
import { evaluatePrepItem, type PrepKitchenRecord } from '@/lib/meal-prep-go';

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
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PrepState>;
      state = {
        items: parsed.items ?? [],
        orders: parsed.orders ?? [],
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
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluatePrepItem(state.kitchen, input);
  if (!check.ok) return check;
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
  };
  state = { ...state, listings: [listing, ...state.listings] };
  emit();
  return { ok: true };
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
  state = { ...state, items: [], orders: [order, ...state.orders] };
  emit();
  return order;
}

export function useMealPrep() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
