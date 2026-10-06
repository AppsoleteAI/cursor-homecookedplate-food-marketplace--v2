import type { FarmChannel, RegulatoryTrack } from '@/lib/cottage-food';

export type FarmStand = {
  id: string;
  name: string;
  zip: string;
  city: string;
  stateCode: string;
  county: string;
  summary: string;
  model: 'direct' | 'neighborhood' | 'hub';
  image: string;
};

export type FarmProduct = {
  id: string;
  farmId: string;
  name: string;
  price: number;
  unit: string;
  track: RegulatoryTrack;
  summary: string;
  image: string;
  ingredients: string;
  allergens: string;
  kind: 'good' | 'csa';
  seasonNote?: string;
};

export const FARM_STANDS: FarmStand[] = [
  {
    id: 'hearth-orchard',
    name: 'Hearth Orchard',
    zip: '19380',
    city: 'West Chester',
    stateCode: 'PA',
    county: 'Chester',
    summary: 'Tree fruit and fruit butter from a family orchard. Pickup at the barn or the Saturday market.',
    model: 'direct',
    image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=900',
  },
  {
    id: 'red-clay',
    name: 'Red Clay Homestead',
    zip: '82001',
    city: 'Cheyenne',
    stateCode: 'WY',
    county: 'Laramie',
    summary: 'A small flock and a kitchen garden. Neighbors pick up eggs and greens at the gate.',
    model: 'neighborhood',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900',
  },
  {
    id: 'mill-run',
    name: 'Mill Run Apiary',
    zip: '84401',
    city: 'Ogden',
    stateCode: 'UT',
    county: 'Weber',
    summary: 'Raw honey and beeswax from hives along the bench. Jars are sold direct from the farm.',
    model: 'direct',
    image: 'https://images.unsplash.com/photo-1473973266408-ed4e27abdd47?w=900',
  },
  {
    id: 'sourdough-acre',
    name: 'Sourdough Acre',
    zip: '95616',
    city: 'Davis',
    stateCode: 'CA',
    county: 'Yolo',
    summary: 'Loaves and cookies from a home kitchen. Pick them up in the neighborhood.',
    model: 'neighborhood',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900',
  },
  {
    id: 'gulf-citrus',
    name: 'Gulf Citrus Stand',
    zip: '32601',
    city: 'Gainesville',
    stateCode: 'FL',
    county: 'Alachua',
    summary: 'Whole citrus and marmalade. The stand is on the grove road, and a weekly hub takes the fruit only.',
    model: 'hub',
    image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=900',
  },
  {
    id: 'prairie-grain',
    name: 'Prairie Grain Co-op',
    zip: '58102',
    city: 'Fargo',
    stateCode: 'ND',
    county: 'Cass',
    summary: 'A grower co-op for wheat berries, oats, and granola. Members vote on the weekly box.',
    model: 'direct',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=900',
  },
];

export const FARM_PRODUCTS: FarmProduct[] = [
  {
    id: 'hearth-apples',
    farmId: 'hearth-orchard',
    name: 'Bushel of apples',
    price: 28,
    unit: 'half bushel',
    track: 'whole_produce',
    summary: 'Uncut apples from this week’s pick.',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800',
    ingredients: 'Apples',
    allergens: 'None of the major allergens',
    kind: 'good',
  },
  {
    id: 'hearth-butter',
    farmId: 'hearth-orchard',
    name: 'Apple butter',
    price: 12,
    unit: '8 oz jar',
    track: 'cottage_non_tcs',
    summary: 'Shelf-stable apple butter made in the orchard kitchen. Sold only by the maker, direct to you.',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800',
    ingredients: 'Apples, sugar, cinnamon, lemon juice',
    allergens: 'None of the major allergens',
    kind: 'good',
  },
  {
    id: 'red-clay-eggs',
    farmId: 'red-clay',
    name: 'Pasture eggs',
    price: 7,
    unit: 'dozen',
    track: 'shell_eggs',
    summary: 'One dozen eggs from the flock.',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800',
    ingredients: 'Shell eggs',
    allergens: 'Eggs',
    kind: 'good',
  },
  {
    id: 'red-clay-greens',
    farmId: 'red-clay',
    name: 'Whole head lettuce',
    price: 4,
    unit: 'head',
    track: 'whole_produce',
    summary: 'Whole heads only. Cut greens are not offered.',
    image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800',
    ingredients: 'Lettuce',
    allergens: 'None of the major allergens',
    kind: 'good',
  },
  {
    id: 'mill-honey',
    farmId: 'mill-run',
    name: 'Raw honey',
    price: 14,
    unit: '12 oz jar',
    track: 'cottage_non_tcs',
    summary: 'Unfiltered honey from this apiary. Do not feed honey to infants under one year.',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
    ingredients: 'Raw honey',
    allergens: 'None of the major allergens',
    kind: 'good',
  },
  {
    id: 'sourdough-loaf',
    farmId: 'sourdough-acre',
    name: 'Country sourdough',
    price: 9,
    unit: 'loaf',
    track: 'cottage_non_tcs',
    summary: 'Shelf-stable loaf. No cream filling. Pickup from the baker.',
    image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800',
    ingredients: 'Wheat flour, water, salt, starter',
    allergens: 'Wheat',
    kind: 'good',
  },
  {
    id: 'sourdough-cookies',
    farmId: 'sourdough-acre',
    name: 'Oat cookies',
    price: 8,
    unit: '6 cookies',
    track: 'cottage_non_tcs',
    summary: 'Shelf-stable cookies from the same home kitchen as the bread.',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583a?w=800',
    ingredients: 'Oats, wheat flour, butter, sugar, egg',
    allergens: 'Wheat, milk, eggs',
    kind: 'good',
  },
  {
    id: 'gulf-oranges',
    farmId: 'gulf-citrus',
    name: 'Whole oranges',
    price: 18,
    unit: '10 lb',
    track: 'whole_produce',
    summary: 'Whole fruit for farm pickup or the weekly hub. The hub does not carry the marmalade.',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800',
    ingredients: 'Oranges',
    allergens: 'None of the major allergens',
    kind: 'good',
  },
  {
    id: 'gulf-marmalade',
    farmId: 'gulf-citrus',
    name: 'Orange marmalade',
    price: 11,
    unit: '8 oz jar',
    track: 'cottage_non_tcs',
    summary: 'Shelf-stable marmalade. Direct from the maker. Not available through the hub.',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800',
    ingredients: 'Oranges, sugar, pectin',
    allergens: 'None of the major allergens',
    kind: 'good',
  },
  {
    id: 'prairie-granola',
    farmId: 'prairie-grain',
    name: 'Oat granola',
    price: 10,
    unit: '12 oz bag',
    track: 'cottage_non_tcs',
    summary: 'Shelf-stable granola from co-op oats. Packed by the member who baked it.',
    image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=800',
    ingredients: 'Oats, honey, sunflower oil, almonds',
    allergens: 'Tree nuts (almonds)',
    kind: 'good',
  },
  {
    id: 'prairie-berries',
    farmId: 'prairie-grain',
    name: 'Wheat berries',
    price: 6,
    unit: '2 lb',
    track: 'whole_produce',
    summary: 'Cleaned whole grain from co-op fields.',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800',
    ingredients: 'Wheat berries',
    allergens: 'Wheat',
    kind: 'good',
  },
  {
    id: 'hearth-csa',
    farmId: 'hearth-orchard',
    name: 'Orchard CSA box',
    price: 36,
    unit: 'weekly box',
    track: 'csa_share',
    summary: 'This week’s fruit box. A pause holds the next box. This checkout pays only the current box, not a season of installments.',
    image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800',
    ingredients: 'Seasonal whole fruit. Homemade items, if included, are labeled separately.',
    allergens: 'See the label on any homemade item in the box',
    kind: 'csa',
    seasonNote: 'Season runs while the trees are picking. A pause skips a week without a new charge in this app.',
  },
  {
    id: 'prairie-csa',
    farmId: 'prairie-grain',
    name: 'Co-op grain share',
    price: 42,
    unit: 'monthly share',
    track: 'csa_share',
    summary: 'Grain, oats, and a bag of granola.',
    image: 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?w=800',
    ingredients: 'Whole grains plus oat granola (oats, honey, sunflower oil, almonds)',
    allergens: 'Wheat, tree nuts (almonds)',
    kind: 'csa',
    seasonNote: 'Year-round. Skipping a month is arranged with the co-op before the pack date.',
  },
];

export function getFarm(id: string): FarmStand | undefined {
  return FARM_STANDS.find((farm) => farm.id === id);
}

export function getCatalogProduct(id: string): FarmProduct | undefined {
  return FARM_PRODUCTS.find((product) => product.id === id);
}

export function productsForFarm(farmId: string): FarmProduct[] {
  return FARM_PRODUCTS.filter((product) => product.farmId === farmId);
}

export function farmsNearZip(zip: string): FarmStand[] {
  const digits = zip.replace(/\D/g, '');
  if (digits.length < 3) return FARM_STANDS;
  return FARM_STANDS.filter((farm) => farm.zip.startsWith(digits.slice(0, 3)));
}

export const LOGISTICS_MODELS: {
  id: FarmStand['model'];
  title: string;
  detail: string;
  channels: FarmChannel[];
}[] = [
  {
    id: 'direct',
    title: 'Farm and community pickup',
    detail: 'You buy from one farm and collect the order at the farm or a community site the farm hosts. The farmer keeps the customer relationship.',
    channels: ['farm_pickup', 'community_pickup'],
  },
  {
    id: 'neighborhood',
    title: 'Neighborhood handoff',
    detail: 'Backyard growers and small stands meet you at the property or hand the bag over nearby.',
    channels: ['farm_stand', 'hand_delivery'],
  },
  {
    id: 'hub',
    title: 'Weekly hub drop',
    detail: 'Farms bring one bulk drop to a local hub. The hub sorts whole produce for porch delivery.',
    channels: ['hub_delivery'],
  },
];
