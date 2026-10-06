/**
 * IAP shim — Web
 * Web uses Stripe directly. This shim satisfies Metro's platform-specific
 * module resolution so the app bundle doesn't error on web builds.
 */

export type IAPProductId =
  | 'com.rork.homecookedplate.membership.monthly'
  | 'com.rork.homecookedplate.membership.annual';

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

export async function purchaseIAP(_productId: IAPProductId): Promise<IAPPurchaseResult> {
  throw new Error('[IAP] Use Stripe on web — IAP not applicable.');
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  return [];
}

/** False on web — Stripe is used instead. */
export const IAP_REQUIRED = false;
