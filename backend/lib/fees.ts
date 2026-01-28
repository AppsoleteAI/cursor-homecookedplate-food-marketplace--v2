/**
 * MANDATORY LOCATION FOR ALL FINANCIAL CALCULATIONS [cite: 2026-01-17]
 * 
 * Fee Calculation Utility (Financial Source of Truth)
 * Calculates platform fees for marketplace payments using dual fee structure:
 * - Platetaker (Buyer) pays: base amount + 10% fee (10% on top of total_price)
 * - Platemaker (Seller) receives: base amount - 10% fee (10% deducted from total_price)
 * - Platform (Rork) retains: 20% total (10% buyer fee + 10% seller fee)
 * 
 * Financial Source of Truth:
 * - Base amount = order.total_price (always use this as the source of truth)
 * - 20% Take Rate: Always calculate 10% on top of total_price and 10% deducted from it
 */

/**
 * Calculate fees for a marketplace transaction
 * @param baseAmount - The base order amount (order.total_price) before fees
 * @param buyerFeePercent - Percentage fee charged to buyer (default: 10%)
 * @param sellerFeePercent - Percentage fee taken from seller (default: 10%)
 * @returns Object containing calculated fee breakdown
 * 
 * Formula:
 * - buyerFee = baseAmount * 0.1 (10% on top)
 * - sellerFee = baseAmount * 0.1 (10% deducted)
 * - totalCharge = baseAmount + buyerFee (what buyer pays)
 * - sellerPayout = baseAmount - sellerFee (what seller receives)
 * - appTotalRevenue = buyerFee + sellerFee (20% total)
 */
export function calculateFees(
  baseAmount: number,
  buyerFeePercent: number = 10,
  sellerFeePercent: number = 10
) {
  // Null/NaN validation (Codeleka approach - prevent crashes from invalid data)
  if (!Number.isFinite(baseAmount) || baseAmount < 0) {
    console.error('[FEES_DEBUG] Invalid baseAmount:', baseAmount);
    throw new Error(`Invalid baseAmount: ${baseAmount}. Must be a finite, non-negative number.`);
  }
  
  if (!Number.isFinite(buyerFeePercent) || buyerFeePercent < 0) {
    console.error('[FEES_DEBUG] Invalid buyerFeePercent:', buyerFeePercent);
    buyerFeePercent = 10; // Default fallback
  }
  
  if (!Number.isFinite(sellerFeePercent) || sellerFeePercent < 0) {
    console.error('[FEES_DEBUG] Invalid sellerFeePercent:', sellerFeePercent);
    sellerFeePercent = 10; // Default fallback
  }

  const buyerFee = baseAmount * (buyerFeePercent / 100);
  const sellerFee = baseAmount * (sellerFeePercent / 100);

  // Verify calculations don't return NaN (Codeleka approach)
  const result = {
    baseAmount,
    buyerFee: Number.isFinite(buyerFee) ? buyerFee : 0,
    sellerFee: Number.isFinite(sellerFee) ? sellerFee : 0,
    totalCharge: Number.isFinite(baseAmount + buyerFee) ? baseAmount + buyerFee : baseAmount,
    appTotalRevenue: Number.isFinite(buyerFee + sellerFee) ? buyerFee + sellerFee : 0,
    sellerPayout: Number.isFinite(baseAmount - sellerFee) ? baseAmount - sellerFee : baseAmount,
  };

  // Log calculation for debugging (Philipp Lackner - Watches approach)
  if (__DEV__) {
    console.log('[FEES_DEBUG] calculateFees result:', JSON.stringify(result, null, 2));
  }

  return result;
}

/**
 * Calculates the "Double 10" split for Rork orders.
 * Buyer pays +10%, Seller pays -10%. Platform keeps 20%.
 */
export const calculateOrderSplit = (baseAmount: number) => {
  // Null/NaN validation (Codeleka approach)
  if (!Number.isFinite(baseAmount) || baseAmount < 0) {
    console.error('[FEES_DEBUG] calculateOrderSplit: Invalid baseAmount:', baseAmount);
    throw new Error(`Invalid baseAmount: ${baseAmount}. Must be a finite, non-negative number.`);
  }

  const platetakerFee = baseAmount * 0.10; // 10% on top
  const platemakerFee = baseAmount * 0.10; // 10% deduction
  
  const result = {
    totalCaptured: Number.isFinite(baseAmount + platetakerFee) ? baseAmount + platetakerFee : baseAmount,
    appRevenue: Number.isFinite(platetakerFee + platemakerFee) ? platetakerFee + platemakerFee : 0,
    sellerPayout: Number.isFinite(baseAmount - platemakerFee) ? baseAmount - platemakerFee : baseAmount,
  };

  // Verify no NaN values (Codeleka approach)
  if (!Number.isFinite(result.totalCaptured) || !Number.isFinite(result.appRevenue) || !Number.isFinite(result.sellerPayout)) {
    console.error('[FEES_DEBUG] calculateOrderSplit returned NaN:', result);
    throw new Error('Fee calculation resulted in NaN values');
  }

  return result;
};

/**
 * Calculate order breakdown for UI display and API consistency.
 * 
 * MANDATORY LOCATION FOR ALL FINANCIAL CALCULATIONS [cite: 2026-01-17]
 * This function ensures UI and API use the same calculation logic.
 * The SQL trigger will re-verify the total_price on insert/update.
 * 
 * @param unitPrice - Price per unit (from meals table)
 * @param quantity - Number of units ordered
 * @returns Breakdown with subtotal, platform fee, and total
 * 
 * Formula:
 * - subtotal = unitPrice * quantity (base amount)
 * - platformFee = subtotal * 0.10 (10% buyer fee)
 * - total = subtotal + platformFee (what buyer pays)
 */
export function calculateOrderBreakdown(unitPrice: number, quantity: number) {
  // Null/NaN validation
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error(`Invalid unitPrice: ${unitPrice}. Must be a finite, non-negative number.`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) {
    throw new Error(`Invalid quantity: ${quantity}. Must be between 1 and 999.`);
  }

  const subtotal = unitPrice * quantity;
  const platformFee = subtotal * 0.10; // 10% platform fee (buyer pays)
  const total = subtotal + platformFee;

  // Verify no NaN values
  if (!Number.isFinite(subtotal) || !Number.isFinite(platformFee) || !Number.isFinite(total)) {
    console.error('[FEES_DEBUG] calculateOrderBreakdown returned NaN:', { unitPrice, quantity, subtotal, platformFee, total });
    throw new Error('Order breakdown calculation resulted in NaN values');
  }

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    platformFee: parseFloat(platformFee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

/**
 * Calculates the total amount to charge the buyer in cents for Just-In-Time (JIT) Checkout.
 * This function is used when creating Stripe Checkout Sessions with dynamic price_data.
 * 
 * Fee Structure:
 * - Base price: Platemaker's listed price
 * - Marketplace commission: 10% added on top (buyer pays)
 * - Stripe processing fee: 2.9% + $0.30 (passed to buyer)
 * 
 * Formula:
 * 1. Convert base price to cents
 * 2. Add 10% marketplace markup (buyer fee)
 * 3. Calculate Stripe processing fee (2.9% + $0.30)
 * 4. Return total in cents for Stripe's unit_amount field
 * 
 * @param basePrice - The base item price in dollars (e.g., 15.00 for $15.00)
 * @returns The total charge amount in cents (e.g., 1731 for ~$17.31)
 * 
 * @example
 * ```typescript
 * const itemPrice = 15.00; // $15.00
 * const unitAmount = calculateTotalWithFees(itemPrice);
 * // Returns amount in cents including all fees
 * ```
 */
export function calculateTotalWithFees(basePrice: number): number {
  // Null/NaN validation (Codeleka approach)
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    console.error('[FEES_DEBUG] calculateTotalWithFees: Invalid basePrice:', basePrice);
    throw new Error(`Invalid basePrice: ${basePrice}. Must be a finite, non-negative number.`);
  }

  // Convert base price to cents
  const baseInCents = Math.round(basePrice * 100);
  
  // Add 10% marketplace markup (buyer fee)
  const amountWithMarkup = Math.round(baseInCents * 1.10);
  
  // Calculate Stripe processing fee (2.9% + $0.30 = 30 cents)
  const stripeFee = Math.round(amountWithMarkup * 0.029 + 30);
  
  // Return total in cents - verify no NaN
  const total = amountWithMarkup + stripeFee;
  if (!Number.isFinite(total) || total < 0) {
    console.error('[FEES_DEBUG] calculateTotalWithFees: Invalid result:', { basePrice, baseInCents, amountWithMarkup, stripeFee, total });
    throw new Error('Fee calculation resulted in invalid total');
  }

  return total;
}

/**
 * ---------------------------------------------------------------------------
 * Platform Fee Constants (Financial Source of Truth)
 * ---------------------------------------------------------------------------
 * Centralized fee structure for marketplace transactions.
 */
export const PLATFORM_FEES = {
  MARKETPLACE_PERCENT: 0.10, // 10% Platform Fee
  STRIPE_FIXED: 0.30,        // $0.30 Stripe Fee
  STRIPE_PERCENT: 0.029,     // 2.9% Stripe Fee
} as const;

/**
 * Net payout calculation for Platemaker transparency.
 * @param amount - The base order amount before fees
 * @returns The net payout after platform fee and Stripe processing fees
 */
export const getNetPayout = (amount: number): number => {
  const platformFee = amount * PLATFORM_FEES.MARKETPLACE_PERCENT;
  const stripeFee = (amount * PLATFORM_FEES.STRIPE_PERCENT) + PLATFORM_FEES.STRIPE_FIXED;
  return parseFloat((amount - platformFee - stripeFee).toFixed(2));
};

/**
 * ---------------------------------------------------------------------------
 * Revenue Forecast Utilities (Financial Source of Truth)
 * ---------------------------------------------------------------------------
 * These helpers power admin revenue projections and earnings transparency.
 *
 * Key assumptions (defaults are set in the UI layer; functions remain pure):
 * - Membership pricing: $4.99/mo or $39.99/yr
 * - GMV model: AOV + orders-per-platetaker-per-month
 * - Fee model: 10% platetaker fee + 10% platemaker rake (two-sided "double 10")
 */

export type ForecastTimeUnit = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface ForecastAssumptions {
  /** Subscription price per paying subscriber per month (e.g., 4.99). */
  subscriptionPriceMonthly: number;
  /** Subscription price per paying subscriber per year (e.g., 39.99). */
  subscriptionPriceAnnual: number;
  /** Average order value in dollars (base amount / GMV). */
  averageOrderValue: number;
  /** Orders per platetaker per month (used to estimate GMV). */
  ordersPerPlatetakerPerMonth: number;
  /** Fee percent charged to platetaker (buyer). */
  platetakerFeePercent: number;
  /** Fee percent charged to platemaker (seller). */
  platemakerRakePercent: number;
  /** Optional promotion pool of free subscribers that later convert to paid. */
  promoFreeSubscriberPool?: number;
}

export interface MetroCountsLike {
  metro_name: string;
  platemaker_count: number;
  platetaker_count: number;
  max_cap?: number | null;
}

export interface RevenueBreakdown {
  /** Subscription revenue from platemakers. */
  platemaker_subscriptions: number;
  /** Subscription revenue from platetakers. */
  platetaker_subscriptions: number;
  /** 10% rake taken from platemakers (seller side), applied to GMV baseline. */
  platemaker_rake: number;
  /** 10% fee charged to platetakers (buyer side), applied to GMV baseline. */
  platetaker_fee: number;
  /** Total revenue across all four streams. */
  total: number;
}

/**
 * Subscription price constants.
 *
 * IMPORTANT:
 * - Numeric prices live here (source of truth for forecasts/UI).
 * - Stripe Price IDs must remain in server/edge secrets and should NOT be hardcoded.
 * 
 * MANDATORY LOCATION FOR ALL FINANCIAL CALCULATIONS [cite: 2026-01-17]
 * Centralizes subscription pricing, platform fees, and revenue forecasting.
 */
export const SUBSCRIPTION_PRICES = {
  MONTHLY: 4.99,
  ANNUAL: 39.99,
  LIFETIME: 0.00, // Promotional lifetime slots
  // Env var names used by server/edge code (values provided via Supabase secrets).
  STRIPE_MONTHLY_ID_ENV: 'STRIPE_PRICE_ID_STANDARD_MONTHLY',
  STRIPE_ANNUAL_ID_ENV: 'STRIPE_PRICE_ID_STANDARD_ANNUAL',
} as const;

export const DEFAULT_FORECAST_ASSUMPTIONS: ForecastAssumptions = {
  subscriptionPriceMonthly: SUBSCRIPTION_PRICES.MONTHLY,
  subscriptionPriceAnnual: SUBSCRIPTION_PRICES.ANNUAL,
  averageOrderValue: 25,
  ordersPerPlatetakerPerMonth: 2,
  platetakerFeePercent: 10,
  platemakerRakePercent: 10,
  promoFreeSubscriberPool: 10_000,
};

function clampNonNegative(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function unitsPerMonth(unit: ForecastTimeUnit): number {
  // Approximate conversions suitable for business forecasting UI.
  // Keep deterministic and simple; do not depend on calendar month length.
  switch (unit) {
    case 'daily':
      return 1 / 30;
    case 'weekly':
      return 1 / 4.345; // ~52.14 weeks/year / 12
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3;
    case 'annual':
      return 1 / 12;
  }
}

export function subscriptionRevenueForUnit(params: {
  payingSubscribers: number;
  assumptions: Pick<ForecastAssumptions, 'subscriptionPriceMonthly' | 'subscriptionPriceAnnual'>;
  unit: ForecastTimeUnit;
}): number {
  const paying = clampNonNegative(params.payingSubscribers);
  const monthlyPrice = clampNonNegative(params.assumptions.subscriptionPriceMonthly);
  const annualPrice = clampNonNegative(params.assumptions.subscriptionPriceAnnual);

  if (params.unit === 'annual') {
    return paying * annualPrice;
  }

  // Convert monthly subscription to requested unit.
  const monthlyRevenue = paying * monthlyPrice;
  return monthlyRevenue * unitsPerMonth(params.unit);
}

export function forecastGmvForUnit(params: {
  platetakerCount: number;
  assumptions: Pick<ForecastAssumptions, 'averageOrderValue' | 'ordersPerPlatetakerPerMonth'>;
  unit: ForecastTimeUnit;
}): number {
  const takers = clampNonNegative(params.platetakerCount);
  const aov = clampNonNegative(params.assumptions.averageOrderValue);
  const ordersPerMonth = clampNonNegative(params.assumptions.ordersPerPlatetakerPerMonth);

  const gmvMonthly = takers * ordersPerMonth * aov;
  return gmvMonthly * unitsPerMonth(params.unit);
}

export function forecastFeeRevenueForUnit(params: {
  gmv: number;
  assumptions: Pick<ForecastAssumptions, 'platemakerRakePercent' | 'platetakerFeePercent'>;
}): Pick<RevenueBreakdown, 'platemaker_rake' | 'platetaker_fee'> {
  const gmv = clampNonNegative(params.gmv);
  const makerPct = clampNonNegative(params.assumptions.platemakerRakePercent);
  const takerPct = clampNonNegative(params.assumptions.platetakerFeePercent);

  return {
    platemaker_rake: gmv * (makerPct / 100),
    platetaker_fee: gmv * (takerPct / 100),
  };
}

export function forecastPromoPoolSubscriptionRevenueForUnit(params: {
  assumptions: Pick<ForecastAssumptions, 'subscriptionPriceMonthly' | 'subscriptionPriceAnnual' | 'promoFreeSubscriberPool'>;
  unit: ForecastTimeUnit;
}): number {
  const pool = clampNonNegative(params.assumptions.promoFreeSubscriberPool ?? 0);
  return subscriptionRevenueForUnit({
    payingSubscribers: pool,
    assumptions: {
      subscriptionPriceMonthly: params.assumptions.subscriptionPriceMonthly,
      subscriptionPriceAnnual: params.assumptions.subscriptionPriceAnnual,
    },
    unit: params.unit,
  });
}

/**
 * Revenue forecast helper for the 10,200-user promotion.
 * Calculates the total subscription revenue potential for a promotional pool (monthly basis),
 * e.g. when a free-trial cohort converts to paid.
 */
export const calculatePromotionalCapRevenue = (totalUsers: number): number => {
  const users = clampNonNegative(totalUsers);
  return parseFloat((users * SUBSCRIPTION_PRICES.MONTHLY).toFixed(2));
};

export function forecastRevenueBreakdownForCounts(params: {
  platemakerCount: number;
  platetakerCount: number;
  assumptions: ForecastAssumptions;
  unit: ForecastTimeUnit;
}): RevenueBreakdown {
  const makers = clampNonNegative(params.platemakerCount);
  const takers = clampNonNegative(params.platetakerCount);

  const platemaker_subscriptions = subscriptionRevenueForUnit({
    payingSubscribers: makers,
    assumptions: params.assumptions,
    unit: params.unit,
  });

  const platetaker_subscriptions = subscriptionRevenueForUnit({
    payingSubscribers: takers,
    assumptions: params.assumptions,
    unit: params.unit,
  });

  const gmv = forecastGmvForUnit({
    platetakerCount: takers,
    assumptions: params.assumptions,
    unit: params.unit,
  });

  const { platemaker_rake, platetaker_fee } = forecastFeeRevenueForUnit({
    gmv,
    assumptions: params.assumptions,
  });

  const total =
    platemaker_subscriptions +
    platetaker_subscriptions +
    platemaker_rake +
    platetaker_fee;

  return {
    platemaker_subscriptions,
    platetaker_subscriptions,
    platemaker_rake,
    platetaker_fee,
    total,
  };
}

export function getMetroCap(metro: Pick<MetroCountsLike, 'max_cap'>, fallbackCap: number = 100): number {
  const cap = metro.max_cap ?? fallbackCap;
  return clampNonNegative(Number(cap || fallbackCap)) || fallbackCap;
}

export function forecastRevenueForMetro(params: {
  metro: MetroCountsLike;
  assumptions: ForecastAssumptions;
  unit: ForecastTimeUnit;
  mode: 'current' | 'at_cap';
}): RevenueBreakdown {
  const cap = getMetroCap(params.metro, 100);
  const makers = params.mode === 'at_cap' ? cap : params.metro.platemaker_count;
  const takers = params.mode === 'at_cap' ? cap : params.metro.platetaker_count;

  return forecastRevenueBreakdownForCounts({
    platemakerCount: makers,
    platetakerCount: takers,
    assumptions: params.assumptions,
    unit: params.unit,
  });
}

export function forecastRevenueTotals(params: {
  metros: MetroCountsLike[];
  assumptions: ForecastAssumptions;
  unit: ForecastTimeUnit;
  mode: 'current' | 'at_cap';
}): RevenueBreakdown {
  return params.metros.reduce<RevenueBreakdown>(
    (acc, metro) => {
      const r = forecastRevenueForMetro({
        metro,
        assumptions: params.assumptions,
        unit: params.unit,
        mode: params.mode,
      });
      const platemaker_subscriptions = acc.platemaker_subscriptions + r.platemaker_subscriptions;
      const platetaker_subscriptions = acc.platetaker_subscriptions + r.platetaker_subscriptions;
      const platemaker_rake = acc.platemaker_rake + r.platemaker_rake;
      const platetaker_fee = acc.platetaker_fee + r.platetaker_fee;
      const total = acc.total + r.total;
      return { platemaker_subscriptions, platetaker_subscriptions, platemaker_rake, platetaker_fee, total };
    },
    { platemaker_subscriptions: 0, platetaker_subscriptions: 0, platemaker_rake: 0, platetaker_fee: 0, total: 0 }
  );
}
