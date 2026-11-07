import { quoteCard, quoteCheckout, type CheckoutArea, type CombinedReceipt, type QuotedCheckout } from './combined-checkout';
import { cottageBandLabel, cottageDirectoryRow } from '@/lib/cottage-directory';
import { stateName } from '@/lib/cottage-food';

export const COTTAGE_GUIDANCE =
  'HomeCookedPlate is not the authority on what you can sell. State laws, county laws, and local municipality laws change too often for this app to be the final authority. The PlateMaker and the local jurisdiction do that due diligence. A cottage-directory note is guidance, not a restriction. Naming a state does not require the food to fit that state’s cottage-directory row.';

/** Naming a state never makes the cottage-directory row a listing rule. */
export function cottageDirectoryRestrictsListing(): boolean {
  return false;
}

export type StateMeal = {
  stateCode: string;
  state: string;
  metro: string;
  area: CheckoutArea;
  name: string;
  price: number;
  sellerId: string;
};

export type CottageLaw = {
  code: string;
  state: string;
  band: string;
  bandLabel: string;
  note?: string;
  expanded?: string;
  cap?: string;
  foodFreedom: boolean;
};

export function cottageLaw(stateCode: string): CottageLaw | null {
  const row = cottageDirectoryRow(stateCode.trim().toUpperCase());
  if (!row) return null;
  return {
    code: row.code,
    state: stateName(row.code),
    band: row.band,
    bandLabel: cottageBandLabel(row.band),
    note: row.note,
    expanded: row.expanded,
    cap: row.cap,
    foodFreedom: row.foodFreedom === true,
  };
}

/** A directory summary the cook can read. It does not decide whether the food can be listed. */
export function cottageFoodGuidance(stateCode: string): { state: string | null; note: string } {
  const law = cottageLaw(stateCode);
  const directory = law
    ? [law.bandLabel, law.note, law.expanded, law.cap].filter(Boolean).join(' ')
    : 'This state is not in the cottage directory.';
  return {
    state: law?.state ?? null,
    note: `${COTTAGE_GUIDANCE} ${directory}`,
  };
}

/**
 * Six checkout areas. Home and farm are both in Los Angeles so one PlateTaker can
 * order those two areas. The other four areas are four other metros.
 * The food names are not required to match the cottage-directory row.
 */
export const SIX_AREA_MEALS: StateMeal[] = [
  {
    stateCode: 'CA',
    state: 'California',
    metro: 'Los Angeles-Long Beach-Anaheim',
    area: 'home',
    name: 'Cheesecake',
    price: 12,
    sellerId: '11111111-1111-4111-8111-111111111101',
  },
  {
    stateCode: 'CA',
    state: 'California',
    metro: 'Los Angeles-Long Beach-Anaheim',
    area: 'farm',
    name: 'Pumpkin pie',
    price: 18,
    sellerId: '11111111-1111-4111-8111-111111111102',
  },
  {
    stateCode: 'NY',
    state: 'New York',
    metro: 'New York-Newark-Jersey City',
    area: 'meal_prep',
    name: 'Cream pie',
    price: 9,
    sellerId: '11111111-1111-4111-8111-111111111103',
  },
  {
    stateCode: 'TX',
    state: 'Texas',
    metro: 'Austin-Round Rock-Georgetown',
    area: 'food_truck',
    name: 'Beef brisket',
    price: 22,
    sellerId: '11111111-1111-4111-8111-111111111104',
  },
  {
    stateCode: 'IL',
    state: 'Illinois',
    metro: 'Chicago-Naperville-Elgin',
    area: 'food_cart',
    name: 'Hot beef sandwich',
    price: 16,
    sellerId: '11111111-1111-4111-8111-111111111105',
  },
  {
    stateCode: 'WA',
    state: 'Washington',
    metro: 'Seattle-Tacoma-Bellevue',
    area: 'catering',
    name: 'Hot turkey dinner',
    price: 28,
    sellerId: '11111111-1111-4111-8111-111111111106',
  },
];

export const FOUR_AREA_MEALS: StateMeal[] = SIX_AREA_MEALS.slice(0, 4);

export function cookMayList(role: string | null | undefined): boolean {
  return role === 'platemaker';
}

export function quoteStateMeal(
  meal: StateMeal,
  buyer: { buyerRole?: string | null; buyerMembershipTier?: string | null } = {},
): QuotedCheckout {
  return quoteCheckout({
    area: meal.area,
    sellerId: meal.sellerId,
    sellerName: meal.state,
    lines: [{ name: meal.name, quantity: 1, unitPrice: meal.price, lineTotal: meal.price }],
    buyerRole: buyer.buyerRole,
    buyerMembershipTier: buyer.buyerMembershipTier,
  });
}

/** One paid order for each area. */
export function purchaseEachArea(
  meals: StateMeal[] = SIX_AREA_MEALS,
  buyer: { buyerRole?: string | null; buyerMembershipTier?: string | null } = { buyerRole: 'platetaker' },
): QuotedCheckout[] {
  return meals.map((meal) => quoteStateMeal(meal, buyer));
}

/** One card for one item from each of two areas. The buyer fee uses the combined food total. */
export function purchaseMultipleFromTwoAreas(
  meals: StateMeal[] = SIX_AREA_MEALS.slice(0, 2),
  quantities: number[] = [1, 1],
  buyer: { buyerRole?: string | null; buyerMembershipTier?: string | null } = { buyerRole: 'platetaker' },
): CombinedReceipt {
  return quoteCard(meals.map((meal, index) => {
    const quantity = quantities[index] ?? 1;
    const lineTotal = Math.round(meal.price * quantity * 100) / 100;
    return {
      area: meal.area,
      sellerId: meal.sellerId,
      sellerName: meal.state,
      lines: [{ name: meal.name, quantity, unitPrice: meal.price, lineTotal }],
      buyerRole: buyer.buyerRole,
      buyerMembershipTier: buyer.buyerMembershipTier,
    };
  }));
}

/** One card that pays two of those areas, one item from each. */
export function purchaseTwoAreas(
  meals: StateMeal[] = FOUR_AREA_MEALS.slice(0, 2),
  buyer: { buyerRole?: string | null; buyerMembershipTier?: string | null } = { buyerRole: 'platetaker' },
): CombinedReceipt {
  return quoteCard(meals.map((meal) => ({
    area: meal.area,
    sellerId: meal.sellerId,
    sellerName: meal.state,
    lines: [{ name: meal.name, quantity: 1, unitPrice: meal.price, lineTotal: meal.price }],
    buyerRole: buyer.buyerRole,
    buyerMembershipTier: buyer.buyerMembershipTier,
  })));
}

export function receiptAmountForRole(
  role: 'platemaker' | 'platetaker',
  amounts: { buyerPays: number; sellerPayout: number },
): { label: string; amount: number } {
  if (role === 'platemaker') return { label: 'You receive', amount: amounts.sellerPayout };
  return { label: 'You pay', amount: amounts.buyerPays };
}
