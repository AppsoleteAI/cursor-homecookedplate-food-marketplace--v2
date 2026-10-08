import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { CaterLicenseRecord, DropOffWindow } from '@/lib/cater-event-license';
import { evaluateCaterPackage } from '@/lib/cater-event-license';

const STORAGE_KEY = 'cater_event_deliver_v1';

export type CaterCartLine = {
  packageId: string;
  companyId: string;
  headcount: number;
};

export type CaterOrderLine = {
  packageId: string;
  name: string;
  headcount: number;
  pricePerPerson: number;
};

export type CaterOrder = {
  id: string;
  createdAt: string;
  companyId: string;
  companyName: string;
  organization: string;
  dropoffWindow: DropOffWindow;
  address: string;
  lines: CaterOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
};

export type CaterListing = {
  id: string;
  companyId: 'owner-company';
  name: string;
  pricePerPerson: number;
  minimumHeadcount: number;
  summary: string;
  ingredients: string;
  allergens: string;
};

type CaterState = {
  items: CaterCartLine[];
  follows: string[];
  orders: CaterOrder[];
  license: CaterLicenseRecord | null;
  listings: CaterListing[];
  accepting: boolean;
};

let state: CaterState = {
  items: [],
  follows: [],
  orders: [],
  license: null,
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

export function hydrateCaterEvent() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CaterState>;
      state = {
        items: parsed.items ?? [],
        follows: parsed.follows ?? [],
        orders: parsed.orders ?? [],
        license: parsed.license ?? null,
        listings: parsed.listings ?? [],
        accepting: parsed.accepting ?? false,
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

export function addCaterPackage(
  packageId: string,
  companyId: string,
  headcount: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(headcount) || headcount < 1) {
    return { ok: false, reason: 'Enter a whole number of people.' };
  }
  const currentCompany = state.items[0]?.companyId;
  if (currentCompany && currentCompany !== companyId) {
    return { ok: false, reason: 'A catering order is one company at a time. Clear the order before you add a package from somewhere else.' };
  }
  const existing = state.items.find((item) => item.packageId === packageId);
  const items = existing
    ? state.items.map((item) => (item.packageId === packageId ? { ...item, headcount } : item))
    : [...state.items, { packageId, companyId, headcount }];
  state = { ...state, items };
  emit();
  return { ok: true };
}

export function setCaterHeadcount(packageId: string, headcount: number) {
  const items = headcount <= 0
    ? state.items.filter((item) => item.packageId !== packageId)
    : state.items.map((item) => (item.packageId === packageId ? { ...item, headcount } : item));
  state = { ...state, items };
  emit();
}

export function clearCaterItems() {
  state = { ...state, items: [] };
  emit();
}

export function toggleCaterFollow(companyId: string) {
  const follows = state.follows.includes(companyId)
    ? state.follows.filter((id) => id !== companyId)
    : [...state.follows, companyId];
  state = { ...state, follows };
  emit();
}

export function setCaterAccepting(accepting: boolean) {
  state = { ...state, accepting };
  emit();
}

export function saveCaterLicense(license: CaterLicenseRecord) {
  state = { ...state, license };
  emit();
}

export function publishCaterPackage(input: {
  name: string;
  pricePerPerson: number;
  minimumHeadcount: number;
  summary: string;
  ingredients: string;
  allergens: string;
}): { ok: true } | { ok: false; blocks: string[] } {
  const check = evaluateCaterPackage(state.license, input);
  if (!check.ok) return check;
  const listing: CaterListing = {
    id: `cater-package-${Date.now()}`,
    companyId: 'owner-company',
    name: input.name.trim(),
    pricePerPerson: input.pricePerPerson,
    minimumHeadcount: input.minimumHeadcount,
    summary: input.summary.trim(),
    ingredients: input.ingredients.trim(),
    allergens: input.allergens.trim(),
  };
  state = { ...state, listings: [listing, ...state.listings] };
  emit();
  return { ok: true };
}

export function placeCaterOrder(input: {
  id?: string;
  companyId: string;
  companyName: string;
  organization: string;
  dropoffWindow: DropOffWindow;
  address: string;
  lines: CaterOrderLine[];
  baseAmount: number;
  buyerPays: number;
  sellerPayout: number;
}): CaterOrder {
  const { id, ...rest } = input;
  const order: CaterOrder = {
    id: id ?? `ced-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...rest,
  };
  state = { ...state, items: [], orders: [order, ...state.orders] };
  emit();
  return order;
}

export function useCaterEvent() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const headcount = snapshot.items.reduce((sum, item) => sum + item.headcount, 0);
  return {
    ...snapshot,
    headcount,
    packageCount: snapshot.items.length,
    addPackage: addCaterPackage,
    setHeadcount: setCaterHeadcount,
    clearItems: clearCaterItems,
    toggleFollow: toggleCaterFollow,
    setAccepting: setCaterAccepting,
    saveLicense: saveCaterLicense,
    publishPackage: publishCaterPackage,
    placeOrder: placeCaterOrder,
  };
}
