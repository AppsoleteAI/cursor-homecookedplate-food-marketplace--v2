export type PrepLane = 'ready' | 'cook' | 'addon';

export type PrepDiet = 'balanced' | 'high_protein' | 'plant' | 'classic';

export type PrepWindow = {
  day: string;
  hours: string;
  place: string;
};

export type PrepCook = {
  id: string;
  name: string;
  zip: string;
  city: string;
  stateCode: string;
  county: string;
  summary: string;
  image: string;
  accepting: boolean;
  weekLabel: string;
  handoffNote: string;
  windows: PrepWindow[];
};

export type PrepItem = {
  id: string;
  cookId: string;
  lane: PrepLane;
  name: string;
  price: number;
  minutes: number;
  diet: PrepDiet;
  summary: string;
  ingredients: string;
  allergens: string;
  recipeNote: string;
  image: string;
};

export const PREP_COOKS: PrepCook[] = [
  {
    id: 'weekday-table',
    name: 'Weekday Table',
    zip: '19380',
    city: 'West Chester',
    stateCode: 'PA',
    county: 'Chester',
    summary: 'A weekly mix of finished plates and portioned kits from one home kitchen. Pickup on Sunday, or a household drop-off in town.',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900',
    accepting: true,
    weekLabel: 'This week',
    handoffNote: 'Sunday pickup at the side door, or drop-off inside West Chester.',
    windows: [
      { day: 'Sunday', hours: '4:00–6:00', place: 'Side door pickup' },
      { day: 'Sunday', hours: '3:00–5:00', place: 'Household drop-off in town' },
    ],
  },
  {
    id: 'bench-batch',
    name: 'Bench Batch',
    zip: '84401',
    city: 'Ogden',
    stateCode: 'UT',
    county: 'Weber',
    summary: 'High-protein finished meals and one cook-at-home kit. Built for the work week.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900',
    accepting: true,
    weekLabel: 'This week',
    handoffNote: 'Monday evening pickup at the porch.',
    windows: [
      { day: 'Monday', hours: '5:00–7:00', place: 'Porch pickup' },
    ],
  },
  {
    id: 'garden-week',
    name: 'Garden Week',
    zip: '95616',
    city: 'Davis',
    stateCode: 'CA',
    county: 'Yolo',
    summary: 'Plant-based finished meals, simpler cook kits, and a bag of greens that rides with the week.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900',
    accepting: false,
    weekLabel: 'Next week',
    handoffNote: 'Saturday pickup at the garden gate. Not open this week.',
    windows: [
      { day: 'Saturday', hours: '10:00–12:00', place: 'Garden gate pickup' },
    ],
  },
];

export const PREP_ITEMS: PrepItem[] = [
  {
    id: 'lemon-chicken',
    cookId: 'weekday-table',
    lane: 'ready',
    name: 'Lemon herb chicken',
    price: 13.5,
    minutes: 15,
    diet: 'balanced',
    summary: 'Finished plate. Reheat and eat.',
    ingredients: 'Chicken thigh, lemon, rice, green beans, olive oil, salt.',
    allergens: 'None',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=900',
  },
  {
    id: 'beef-rice',
    cookId: 'weekday-table',
    lane: 'ready',
    name: 'Beef and rice bowl',
    price: 14,
    minutes: 15,
    diet: 'high_protein',
    summary: 'Finished bowl with a higher protein portion.',
    ingredients: 'Ground beef, brown rice, peppers, tomato, onion.',
    allergens: 'None',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=900',
  },
  {
    id: 'sheet-pan-kit',
    cookId: 'weekday-table',
    lane: 'cook',
    name: 'Sheet-pan sausage and vegetables',
    price: 9.5,
    minutes: 35,
    diet: 'classic',
    summary: 'Ingredients are portioned. You cook them.',
    ingredients: 'Sausage, potatoes, onion, peppers, oil, spice packet.',
    allergens: 'None',
    recipeNote: 'Heat the oven to 425°F. Toss everything on one pan. Roast 30 minutes, turning once.',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900',
  },
  {
    id: 'herb-sauce',
    cookId: 'weekday-table',
    lane: 'addon',
    name: 'Herb sauce',
    price: 4.5,
    minutes: 0,
    diet: 'classic',
    summary: 'A jar that rides with the week. It is not a meal.',
    ingredients: 'Parsley, garlic, olive oil, lemon, salt.',
    allergens: 'None',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=900',
  },
  {
    id: 'turkey-chili',
    cookId: 'bench-batch',
    lane: 'ready',
    name: 'Turkey chili',
    price: 12.5,
    minutes: 15,
    diet: 'high_protein',
    summary: 'Finished chili. Reheat on the stove or in the microwave.',
    ingredients: 'Ground turkey, beans, tomato, onion, chili spice.',
    allergens: 'None',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=900',
  },
  {
    id: 'salmon-greens',
    cookId: 'bench-batch',
    lane: 'ready',
    name: 'Salmon and greens',
    price: 14.5,
    minutes: 15,
    diet: 'high_protein',
    summary: 'Finished plate with salmon, greens, and rice.',
    ingredients: 'Salmon, rice, kale, lemon, olive oil.',
    allergens: 'Fish',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900',
  },
  {
    id: 'fajita-kit',
    cookId: 'bench-batch',
    lane: 'cook',
    name: 'Chicken fajita kit',
    price: 10,
    minutes: 40,
    diet: 'high_protein',
    summary: 'Portioned chicken and vegetables. Swap the protein note is on the card.',
    ingredients: 'Chicken breast, peppers, onion, spice, tortillas.',
    allergens: 'Wheat',
    recipeNote: 'Slice the chicken. Cook it with the vegetables for 12 minutes. Warm the tortillas. The chicken portion can be swapped for turkey if you note it before the cutoff.',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=900',
  },
  {
    id: 'skillet-bread',
    cookId: 'bench-batch',
    lane: 'addon',
    name: 'Skillet bread',
    price: 5,
    minutes: 0,
    diet: 'classic',
    summary: 'One loaf that rides with the week.',
    ingredients: 'Flour, water, salt, yeast.',
    allergens: 'Wheat',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900',
  },
  {
    id: 'lentil-stew',
    cookId: 'garden-week',
    lane: 'ready',
    name: 'Lentil coconut stew',
    price: 12,
    minutes: 15,
    diet: 'plant',
    summary: 'Finished plant-based bowl. Reheat and eat.',
    ingredients: 'Lentils, coconut milk, spinach, tomato, ginger.',
    allergens: 'None',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=900',
  },
  {
    id: 'fried-rice-kit',
    cookId: 'garden-week',
    lane: 'cook',
    name: 'Vegetable fried rice kit',
    price: 8.5,
    minutes: 30,
    diet: 'plant',
    summary: 'Portioned vegetables and rice. You cook them.',
    ingredients: 'Rice, carrot, peas, egg optional packet, soy, garlic.',
    allergens: 'Soy, egg in the optional packet',
    recipeNote: 'Cook the rice. Stir-fry the vegetables for 8 minutes. Add the rice and sauce. Leave the egg packet out for a fully plant bowl.',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=900',
  },
  {
    id: 'bean-taco-kit',
    cookId: 'garden-week',
    lane: 'cook',
    name: 'Bean taco kit',
    price: 8,
    minutes: 30,
    diet: 'plant',
    summary: 'A simpler, lower-priced kit for the week.',
    ingredients: 'Beans, salsa, cabbage, tortillas, lime.',
    allergens: 'Wheat',
    recipeNote: 'Warm the beans with salsa. Fill the tortillas. Top with cabbage and lime.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900',
  },
  {
    id: 'mixed-greens',
    cookId: 'garden-week',
    lane: 'addon',
    name: 'Mixed greens',
    price: 4,
    minutes: 0,
    diet: 'plant',
    summary: 'A bag of greens that rides with the week.',
    ingredients: 'Lettuce, spinach.',
    allergens: 'None',
    recipeNote: '',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=900',
  },
];

export function getPrepCook(id: string): PrepCook | undefined {
  return PREP_COOKS.find((cook) => cook.id === id);
}

export function getPrepItem(id: string): PrepItem | undefined {
  return PREP_ITEMS.find((item) => item.id === id);
}

export function itemsForCook(cookId: string): PrepItem[] {
  return PREP_ITEMS.filter((item) => item.cookId === cookId);
}

export function cooksNearZip(zip: string): PrepCook[] {
  const digits = zip.replace(/\D/g, '');
  if (digits.length < 3) return PREP_COOKS;
  return PREP_COOKS.filter((cook) => cook.zip.startsWith(digits.slice(0, 3)));
}
