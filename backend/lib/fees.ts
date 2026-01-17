/**
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
  const buyerFee = baseAmount * (buyerFeePercent / 100);
  const sellerFee = baseAmount * (sellerFeePercent / 100);

  return {
    baseAmount,
    buyerFee,
    sellerFee,
    totalCharge: baseAmount + buyerFee, // What buyer pays (e.g., $100 + $10 = $110)
    appTotalRevenue: buyerFee + sellerFee, // Platform keeps (e.g., $10 + $10 = $20)
    sellerPayout: baseAmount - sellerFee, // What seller receives (e.g., $100 - $10 = $90)
  };
}

/**
 * Calculates the "Double 10" split for Rork orders.
 * Buyer pays +10%, Seller pays -10%. Platform keeps 20%.
 */
export const calculateOrderSplit = (baseAmount: number) => {
  const platetakerFee = baseAmount * 0.10; // 10% on top
  const platemakerFee = baseAmount * 0.10; // 10% deduction
  
  return {
    totalCaptured: baseAmount + platetakerFee, // $110
    appRevenue: platetakerFee + platemakerFee, // $20
    sellerPayout: baseAmount - platemakerFee,  // $90
  };
};
