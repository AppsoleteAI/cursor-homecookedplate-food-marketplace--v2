import { buyerServiceFeePercent, calculateFees } from '@/backend/lib/fees';

/** One charge can hold several of these. A checkout is one area and one seller. */
export const CHECKOUT_AREAS = [
  'home',
  'farm',
  'meal_prep',
  'food_truck',
  'food_cart',
  'catering',
  'sit_down',
  'ghost_kitchen',
] as const;

export type CheckoutArea = (typeof CHECKOUT_AREAS)[number];

export const CHECKOUT_AREA_LABEL: Record<CheckoutArea, string> = {
  home: 'Home plate',
  farm: 'Farm',
  meal_prep: 'Meal prep',
  food_truck: 'Food truck',
  food_cart: 'Food cart',
  catering: 'Catering',
  sit_down: 'Sit-down',
  ghost_kitchen: 'Ghost kitchen',
};

export type QuotedLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  /** Offer price for this line. The unit price times quantity can miss a cent. */
  lineTotal?: number;
  productId?: string;
};

export function quotedLineAmount(line: QuotedLine): number {
  return line.lineTotal ?? line.unitPrice * line.quantity;
}

export type QuotedCheckout = {
  id: string;
  area: CheckoutArea;
  sellerId: string;
  sellerName: string;
  lines: QuotedLine[];
  baseAmount: number;
  buyerFee: number;
  sellerFee: number;
  buyerPays: number;
  sellerPayout: number;
  platformKeeps: number;
};

export type CombinedReceipt = {
  checkouts: QuotedCheckout[];
  combinedBase: number;
  combinedBuyerPays: number;
  combinedSellerPayout: number;
  combinedPlatform: number;
};

function money(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function checkoutKey(area: CheckoutArea, sellerId: string): string {
  return `${area}:${sellerId}`;
}

export function quoteCheckout(input: {
  area: CheckoutArea;
  sellerId: string;
  sellerName: string;
  lines: QuotedLine[];
  buyerRole?: string | null;
  buyerMembershipTier?: string | null;
  /** Food total on this card. Premium uses this, not one section alone. */
  cardBase?: number;
}): QuotedCheckout {
  const baseAmount = money(input.lines.reduce((sum, line) => sum + quotedLineAmount(line), 0));
  const buyerPercent = buyerServiceFeePercent({
    role: input.buyerRole,
    membershipTier: input.buyerMembershipTier,
    baseAmount: input.cardBase ?? baseAmount,
  });
  const fees = calculateFees(baseAmount, buyerPercent, 10);
  return {
    id: checkoutKey(input.area, input.sellerId),
    area: input.area,
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    lines: input.lines,
    baseAmount: money(fees.baseAmount),
    buyerFee: money(fees.buyerFee),
    sellerFee: money(fees.sellerFee),
    buyerPays: money(fees.totalCharge),
    sellerPayout: money(fees.sellerPayout),
    platformKeeps: money(fees.appTotalRevenue),
  };
}

/** One card uses the sum of its food totals for the buyer fee. */
export function quoteCard(inputs: Parameters<typeof quoteCheckout>[0][]): CombinedReceipt {
  const cardBase = money(inputs.reduce((sum, input) => (
    sum + input.lines.reduce((lineSum, line) => lineSum + quotedLineAmount(line), 0)
  ), 0));
  return quoteCombined(inputs.map((input) => quoteCheckout({ ...input, cardBase })));
}

/** The card is charged the sum of each checkout. */
export function quoteCombined(checkouts: QuotedCheckout[]): CombinedReceipt {
  return {
    checkouts,
    combinedBase: money(checkouts.reduce((sum, checkout) => sum + checkout.baseAmount, 0)),
    combinedBuyerPays: money(checkouts.reduce((sum, checkout) => sum + checkout.buyerPays, 0)),
    combinedSellerPayout: money(checkouts.reduce((sum, checkout) => sum + checkout.sellerPayout, 0)),
    combinedPlatform: money(checkouts.reduce((sum, checkout) => sum + checkout.platformKeeps, 0)),
  };
}
