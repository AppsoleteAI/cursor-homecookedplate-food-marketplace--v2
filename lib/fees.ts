/**
 * Frontend Fee Calculation Utilities
 * 
 * These functions duplicate the logic from backend/lib/fees.ts to enable
 * real-time fee calculations in React Native components.
 * 
 * MANDATORY: Keep these functions in sync with backend/lib/fees.ts
 * to ensure UI/API consistency.
 * 
 * Fee Structure (Double 10):
 * - Buyer pays: base price + 10% (buyer fee)
 * - Seller receives: base price - 10% (seller fee)
 * - Platform revenue: 20% total (10% buyer + 10% seller)
 */

/**
 * Calculates the "Double 10" split for Rork orders.
 * Buyer pays +10%, Seller pays -10%. Platform keeps 20%.
 * 
 * @param baseAmount - The base order amount (meal price)
 * @returns Object with totalCaptured, appRevenue, and sellerPayout
 */
export { promotionalBase, type PromotionPrice } from '@/backend/lib/fees';

export const calculateOrderSplit = (baseAmount: number) => {
  // Null/NaN validation
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
    buyerFee: Number.isFinite(platetakerFee) ? platetakerFee : 0,
    sellerFee: Number.isFinite(platemakerFee) ? platemakerFee : 0,
  };

  // Verify no NaN values
  if (!Number.isFinite(result.totalCaptured) || !Number.isFinite(result.appRevenue) || !Number.isFinite(result.sellerPayout)) {
    console.error('[FEES_DEBUG] calculateOrderSplit returned NaN:', result);
    throw new Error('Fee calculation resulted in NaN values');
  }

  return result;
};

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Platform share added on top of the delivery amount the PlateMaker sets. Mirrors backend/lib/fees.ts. */
export const DELIVERY_PLATFORM_RATE = 0.10;

/**
 * The PlateMaker sets the delivery amount and receives it.
 * The PlateTaker pays that amount plus 10%. The platform keeps the 10%.
 */
export function calculateDeliveryLevy(deliveryFee: number) {
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    throw new Error(`Invalid deliveryFee: ${deliveryFee}. Must be a finite, non-negative number.`);
  }
  const fee = roundMoney(deliveryFee);
  const platformFee = roundMoney(fee * DELIVERY_PLATFORM_RATE);
  return {
    deliveryFee: fee,
    platformFee,
    buyerPays: roundMoney(fee + platformFee),
    sellerReceives: fee,
  };
}

/** Food split plus one delivery levy. A zero delivery fee leaves the food split unchanged. */
export function orderTotalWithDelivery(
  foodBuyerPays: number,
  foodSellerPayout: number,
  deliveryFee: number,
) {
  const levy = calculateDeliveryLevy(deliveryFee);
  return {
    levy,
    buyerPays: roundMoney(foodBuyerPays + levy.buyerPays),
    sellerReceives: roundMoney(foodSellerPayout + levy.sellerReceives),
  };
}

const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.30;

/**
 * Mirrors backend/lib/fees.ts buyerCardCharge.
 * The buyer pays the service total, tax when a tax amount applies, and the
 * Stripe card fee. The card fee is grossed up so it is not taken from the platform share.
 */
export function buyerCardCharge(marketplaceTotal: number, taxAmount = 0) {
  if (!Number.isFinite(marketplaceTotal) || marketplaceTotal < 0) {
    throw new Error(`Invalid marketplaceTotal: ${marketplaceTotal}. Must be a finite, non-negative number.`);
  }
  if (!Number.isFinite(taxAmount) || taxAmount < 0) {
    throw new Error(`Invalid taxAmount: ${taxAmount}. Must be a finite, non-negative number.`);
  }

  const netCents = Math.round(marketplaceTotal * 100) + Math.round(taxAmount * 100);
  if (netCents === 0) {
    return {
      marketplaceTotal: 0,
      taxAmount: 0,
      stripeFee: 0,
      cardCharge: 0,
    };
  }

  const fixedCents = Math.round(STRIPE_FIXED * 100);
  let chargeCents = Math.round((netCents + fixedCents) / (1 - STRIPE_PERCENT));
  let stripeCents = Math.round(chargeCents * STRIPE_PERCENT + fixedCents);
  for (let attempt = 0; attempt < 3 && chargeCents - stripeCents !== netCents; attempt += 1) {
    chargeCents += netCents - (chargeCents - stripeCents);
    stripeCents = Math.round(chargeCents * STRIPE_PERCENT + fixedCents);
  }

  return {
    marketplaceTotal: roundMoney(marketplaceTotal),
    taxAmount: roundMoney(taxAmount),
    stripeFee: stripeCents / 100,
    cardCharge: chargeCents / 100,
  };
}

/**
 * Calculate order breakdown for UI display and API consistency.
 * 
 * MANDATORY LOCATION FOR ALL FINANCIAL CALCULATIONS
 * This function ensures UI and API use the same calculation logic.
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
