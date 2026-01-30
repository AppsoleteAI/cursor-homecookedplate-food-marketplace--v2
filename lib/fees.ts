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
  };

  // Verify no NaN values
  if (!Number.isFinite(result.totalCaptured) || !Number.isFinite(result.appRevenue) || !Number.isFinite(result.sellerPayout)) {
    console.error('[FEES_DEBUG] calculateOrderSplit returned NaN:', result);
    throw new Error('Fee calculation resulted in NaN values');
  }

  return result;
};

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
