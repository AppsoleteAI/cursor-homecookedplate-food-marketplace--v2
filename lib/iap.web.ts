/**
 * IAP shim — Web
 * Web uses Stripe directly. This shim satisfies Metro's platform-specific
 * module resolution so the app bundle doesn't error on web builds.
 */

export const MEMBERSHIP_MONTHLY_PRODUCT_ID = 'com.rork.homecookedplate.membership.monthly' as const;
export const MEMBERSHIP_ANNUAL_PRODUCT_ID = 'com.rork.homecookedplate.membership.annual' as const;

export type IAPProductId = typeof MEMBERSHIP_MONTHLY_PRODUCT_ID | typeof MEMBERSHIP_ANNUAL_PRODUCT_ID;

export interface IAPProduct {
  productId: IAPProductId;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}

export interface IAPPurchaseResult {
  productId: IAPProductId;
  transactionId: string;
  receiptData: string;
}

export async function getIAPProducts(): Promise<IAPProduct[]> {
  throw new Error('[IAP] Use Stripe on web — IAP not applicable.');
}

export async function purchaseIAP(_productId: IAPProductId, _accountId?: string): Promise<IAPPurchaseResult> {
  throw new Error('[IAP] Use Stripe on web — IAP not applicable.');
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  return [];
}

export async function finishIAP(_transactionId: string): Promise<void> {}

/** False on web — Stripe is used instead. */
export const IAP_REQUIRED = false;
