/**
 * IAP shim — Android
 * Android does not go through the Apple App Store, so Stripe is used directly.
 * This file satisfies the platform-specific import resolution for Android builds.
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
  throw new Error('[IAP] Use Stripe on Android — IAP not applicable.');
}

export async function purchaseIAP(_productId: IAPProductId): Promise<IAPPurchaseResult> {
  throw new Error('[IAP] Use Stripe on Android — IAP not applicable.');
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  return [];
}

/** False on Android — Stripe is used instead. */
export const IAP_REQUIRED = false;
