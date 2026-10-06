import type { DiningService } from '@/lib/sit-down-license';

export type ShopKind = 'coffee' | 'yogurt' | 'ice_cream' | 'diner' | 'cafe';

export type SitDownPlace = {
  id: string;
  name: string;
  kind: ShopKind;
  street: string;
  city: string;
  stateCode: string;
  county: string;
  zip: string;
  summary: string;
  image: string;
  openNow: boolean;
  services: DiningService[];
  hours: string;
};

export type SitDownItem = {
  id: string;
  placeId: string;
  name: string;
  price: number;
  summary: string;
  ingredients: string;
  allergens: string;
  image: string;
};

export const SHOP_KIND_LABEL: Record<ShopKind, string> = {
  coffee: 'Coffee',
  yogurt: 'Yogurt',
  ice_cream: 'Ice cream',
  diner: 'Diner',
  cafe: 'Cafe',
};

export const SIT_DOWN_PLACES: SitDownPlace[] = [
  {
    id: 'hearth-coffee',
    name: 'Hearth Coffee',
    kind: 'coffee',
    street: '418 Walnut Street',
    city: 'Philadelphia',
    stateCode: 'PA',
    county: 'Philadelphia',
    zip: '19106',
    summary: 'A two-room coffee shop owned by the people who work the bar. Sit at a table or take a cup to go. Not a chain.',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900',
    openNow: true,
    services: ['sit_down', 'takeout'],
    hours: 'Daily 7:00–3:00',
  },
  {
    id: 'little-spoon',
    name: 'Little Spoon Yogurt',
    kind: 'yogurt',
    street: '220 Congress Avenue',
    city: 'Austin',
    stateCode: 'TX',
    county: 'Travis',
    zip: '78701',
    summary: 'A yogurt counter with six seats and a takeout window.',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900',
    openNow: true,
    services: ['sit_down', 'takeout'],
    hours: 'Daily 11:00–8:00',
  },
  {
    id: 'orchard-scoop',
    name: 'Orchard Scoop',
    kind: 'ice_cream',
    street: '15 Market Street',
    city: 'Salt Lake City',
    stateCode: 'UT',
    county: 'Salt Lake',
    zip: '84101',
    summary: 'A family ice cream shop. Closed on Mondays.',
    image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=900',
    openNow: false,
    services: ['sit_down', 'takeout'],
    hours: 'Tuesday–Sunday 12:00–9:00',
  },
  {
    id: 'rosa-corner',
    name: "Rosa's Corner",
    kind: 'diner',
    street: '880 Valencia Street',
    city: 'San Francisco',
    stateCode: 'CA',
    county: 'San Francisco',
    zip: '94110',
    summary: 'A twelve-table diner. Breakfast all day, takeout at the counter. Independently owned.',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900',
    openNow: true,
    services: ['sit_down', 'takeout'],
    hours: 'Daily 8:00–2:00',
  },
  {
    id: 'blue-window',
    name: 'Blue Window',
    kind: 'cafe',
    street: '64 King Street',
    city: 'Charleston',
    stateCode: 'SC',
    county: 'Charleston',
    zip: '29401',
    summary: 'A startup lunch cafe with communal tables. Takeout is boxed at the pass. No franchise.',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900',
    openNow: true,
    services: ['sit_down', 'takeout'],
    hours: 'Tuesday–Saturday 11:00–3:00',
  },
];

export const SIT_DOWN_MENU: SitDownItem[] = [
  {
    id: 'hearth-latte',
    placeId: 'hearth-coffee',
    name: 'Honey latte',
    price: 5,
    summary: 'Espresso and milk. Sit with it or take it to go.',
    ingredients: 'Espresso, milk, honey',
    allergens: 'Milk',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
  },
  {
    id: 'hearth-bun',
    placeId: 'hearth-coffee',
    name: 'Morning bun',
    price: 4,
    summary: 'Baked in the shop kitchen this morning.',
    ingredients: 'Wheat flour, butter, sugar, cinnamon',
    allergens: 'Wheat, milk',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
  },
  {
    id: 'spoon-cup',
    placeId: 'little-spoon',
    name: 'Plain yogurt cup',
    price: 6,
    summary: 'A cup from the cold case, topped at the counter.',
    ingredients: 'Milk, live cultures, honey',
    allergens: 'Milk',
    image: 'https://images.unsplash.com/photo-1571212515416-ffe4b2d2a90d?w=800',
  },
  {
    id: 'spoon-parfait',
    placeId: 'little-spoon',
    name: 'Berry parfait',
    price: 8,
    summary: 'Yogurt, berries, and granola. Eat in or take out.',
    ingredients: 'Yogurt, berries, oats, honey',
    allergens: 'Milk',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
  },
  {
    id: 'orchard-vanilla',
    placeId: 'orchard-scoop',
    name: 'Vanilla scoop',
    price: 4,
    summary: 'One scoop. The shop is closed today.',
    ingredients: 'Milk, cream, sugar, vanilla',
    allergens: 'Milk',
    image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800',
  },
  {
    id: 'rosa-plate',
    placeId: 'rosa-corner',
    name: 'Two-egg plate',
    price: 12,
    summary: 'Eggs, potatoes, toast. A table or a takeout box.',
    ingredients: 'Eggs, potatoes, wheat bread, butter',
    allergens: 'Eggs, wheat, milk',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  },
  {
    id: 'blue-bowl',
    placeId: 'blue-window',
    name: 'Lunch grain bowl',
    price: 14,
    summary: 'The daily bowl from the cafe pass.',
    ingredients: 'Rice, greens, chicken, sesame',
    allergens: 'Sesame',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  },
];

export function getPlace(id: string): SitDownPlace | undefined {
  return SIT_DOWN_PLACES.find((place) => place.id === id);
}

export function getSitItem(id: string): SitDownItem | undefined {
  return SIT_DOWN_MENU.find((item) => item.id === id);
}

export function menuForPlace(placeId: string): SitDownItem[] {
  return SIT_DOWN_MENU.filter((item) => item.placeId === placeId);
}

export function placesNearZip(zip: string): SitDownPlace[] {
  const digits = zip.replace(/\D/g, '');
  if (digits.length < 3) return SIT_DOWN_PLACES;
  return SIT_DOWN_PLACES.filter((place) => place.zip.startsWith(digits.slice(0, 3)));
}
