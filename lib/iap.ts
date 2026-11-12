/**
 * In-App Purchase (IAP) — default module.
 *
 * Metro resolves the platform files first:
 *  - iOS:     lib/iap.ios.ts (StoreKit)
 *  - Android: lib/iap.android.ts (Play Billing)
 *  - Web:     lib/iap.web.ts (Stripe)
 *
 * This file is the TypeScript and fallback entry for `@/lib/iap`.
 */

import {
  APPLE_PLATEMAKER_ANNUAL,
  APPLE_PLATEMAKER_MONTHLY,
  membershipStoreProductId,
  type AppleMembershipProductId,
} from '@/backend/lib/membership-products';

export const MEMBERSHIP_MONTHLY_PRODUCT_ID = APPLE_PLATEMAKER_MONTHLY;
export const MEMBERSHIP_ANNUAL_PRODUCT_ID = APPLE_PLATEMAKER_ANNUAL;

export type IAPProductId = AppleMembershipProductId;

export function membershipProductId(role: 'platemaker' | 'platetaker', interval: 'month' | 'year'): IAPProductId {
  return membershipStoreProductId('apple', role, interval);
}

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
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement getIAPProducts().'
  );
}

export async function purchaseIAP(_productId: IAPProductId, _accountId?: string): Promise<IAPPurchaseResult> {
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement purchaseIAP().'
  );
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement restoreIAPPurchases().'
  );
}

export async function finishIAP(_transactionId: string): Promise<void> {
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement finishIAP().'
  );
}

export async function openStoreSubscriptions(): Promise<void> {
  throw new Error('[IAP] Store subscriptions are managed on the phone.');
}

/** True when the resolved module requires StoreKit. Platform files override this. */
export const IAP_REQUIRED: boolean = true;
