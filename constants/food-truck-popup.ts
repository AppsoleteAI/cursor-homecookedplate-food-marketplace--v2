export type TruckStop = {
  day: string;
  hours: string;
  place: string;
  lot: string;
};

export type FoodTruck = {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  county: string;
  zip: string;
  cuisine: string;
  summary: string;
  image: string;
  active: boolean;
  windowNote: string;
  stops: TruckStop[];
};

export type TruckMenuItem = {
  id: string;
  truckId: string;
  name: string;
  price: number;
  summary: string;
  ingredients: string;
  allergens: string;
  image: string;
};

export const FOOD_TRUCKS: FoodTruck[] = [
  {
    id: 'lantern-tacos',
    name: 'Lantern Tacos',
    city: 'Austin',
    stateCode: 'TX',
    county: 'Travis',
    zip: '78701',
    cuisine: 'Tacos',
    summary: 'Tacos from the downtown lot. The window is open, and order-ahead holds your ticket.',
    image: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=900',
    active: true,
    windowNote: 'Pickup at the service window. No courier.',
    stops: [
      { day: 'Weekdays', hours: '11:00–2:00', place: 'Republic Square', lot: 'Downtown association lot' },
      { day: 'Thursday', hours: '5:00–9:00', place: 'East Side yard', lot: 'Private lot, host permission posted' },
    ],
  },
  {
    id: 'harbor-bowls',
    name: 'Harbor Bowls',
    city: 'San Diego',
    stateCode: 'CA',
    county: 'San Diego',
    zip: '92101',
    cuisine: 'Rice bowls',
    summary: 'Rice bowls from the waterfront lot. Order ahead and pick them up at the window.',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=900',
    active: true,
    windowNote: 'Order ahead, then pick up at the window when the board shows your name.',
    stops: [
      { day: 'Wednesday–Sunday', hours: '11:30–3:00', place: 'Embarcadero lot', lot: 'Port food-truck row' },
    ],
  },
  {
    id: 'night-fry',
    name: 'Night Fry Co.',
    city: 'Philadelphia',
    stateCode: 'PA',
    county: 'Philadelphia',
    zip: '19107',
    cuisine: 'Chicken',
    summary: 'The window is closed right now. Tonight’s lot is on the schedule.',
    image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=900',
    active: false,
    windowNote: 'Orders open only while the truck marks itself active.',
    stops: [
      { day: 'Friday', hours: '6:00–10:00', place: 'Center City courtyard', lot: 'Building-hosted truck night' },
      { day: 'Saturday', hours: '12:00–4:00', place: 'Schuylkill park edge', lot: 'Weekend lot' },
    ],
  },
  {
    id: 'maple-melt',
    name: 'Maple Melt',
    city: 'Salt Lake City',
    stateCode: 'UT',
    county: 'Salt Lake',
    zip: '84101',
    cuisine: 'Sandwiches',
    summary: 'Sandwiches at the library plaza. The window is open.',
    image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=900',
    active: true,
    windowNote: 'Sandwiches are handed through the window. Nothing is delivered.',
    stops: [
      { day: 'Tuesday–Friday', hours: '11:00–1:30', place: 'Library plaza', lot: 'City vending spot' },
    ],
  },
  {
    id: 'citrus-grill',
    name: 'Citrus Grill',
    city: 'Miami',
    stateCode: 'FL',
    county: 'Miami-Dade',
    zip: '33130',
    cuisine: 'Grill',
    summary: 'Parked and closed today. The weekend calendar is posted.',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900',
    active: false,
    windowNote: 'Come back when the truck is marked active.',
    stops: [
      { day: 'Saturday', hours: '12:00–8:00', place: 'Wynwood yard', lot: 'Association lot' },
      { day: 'Sunday', hours: '12:00–6:00', place: 'Waterfront park', lot: 'City event lot' },
    ],
  },
];

export const TRUCK_MENU: TruckMenuItem[] = [
  {
    id: 'lantern-al-pastor',
    truckId: 'lantern-tacos',
    name: 'Al pastor taco',
    price: 5,
    summary: 'Two tortillas, pork, pineapple, onion, cilantro. Order ahead for the window.',
    ingredients: 'Pork, pineapple, onion, cilantro, corn tortilla',
    allergens: 'None of the major allergens',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
  },
  {
    id: 'lantern-queso',
    truckId: 'lantern-tacos',
    name: 'Queso and chips',
    price: 7,
    summary: 'A hot side from the same window.',
    ingredients: 'Corn chips, milk, cheese, jalapeño',
    allergens: 'Milk',
    image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800',
  },
  {
    id: 'harbor-salmon',
    truckId: 'harbor-bowls',
    name: 'Salmon rice bowl',
    price: 16,
    summary: 'Rice, salmon, cabbage, sesame. Held hot on the truck.',
    ingredients: 'Rice, salmon, cabbage, sesame, soy sauce',
    allergens: 'Fish, soy, sesame',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  },
  {
    id: 'harbor-tofu',
    truckId: 'harbor-bowls',
    name: 'Tofu rice bowl',
    price: 14,
    summary: 'The same bowl with tofu.',
    ingredients: 'Rice, tofu, cabbage, sesame, soy sauce',
    allergens: 'Soy, sesame',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  },
  {
    id: 'night-sandwich',
    truckId: 'night-fry',
    name: 'Crispy chicken sandwich',
    price: 13,
    summary: 'Offered when the window is active. The truck is closed on the board right now.',
    ingredients: 'Chicken, wheat bun, pickles, mayonnaise',
    allergens: 'Wheat, eggs',
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800',
  },
  {
    id: 'maple-melt',
    truckId: 'maple-melt',
    name: 'Grilled cheese',
    price: 9,
    summary: 'Served at the plaza window while the truck is active.',
    ingredients: 'Wheat bread, butter, cheddar',
    allergens: 'Wheat, milk',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
  },
  {
    id: 'citrus-plate',
    truckId: 'citrus-grill',
    name: 'Citrus chicken plate',
    price: 15,
    summary: 'Weekend menu. The window is closed today.',
    ingredients: 'Chicken, orange, rice, greens',
    allergens: 'None of the major allergens',
    image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800',
  },
];

export function getTruck(id: string): FoodTruck | undefined {
  return FOOD_TRUCKS.find((truck) => truck.id === id);
}

export function getMenuItem(id: string): TruckMenuItem | undefined {
  return TRUCK_MENU.find((item) => item.id === id);
}

export function menuForTruck(truckId: string): TruckMenuItem[] {
  return TRUCK_MENU.filter((item) => item.truckId === truckId);
}

export function trucksNearZip(zip: string): FoodTruck[] {
  const digits = zip.replace(/\D/g, '');
  if (digits.length < 3) return FOOD_TRUCKS;
  return FOOD_TRUCKS.filter((truck) => truck.zip.startsWith(digits.slice(0, 3)));
}
