/**
 * IAP shim — Web
 * Web uses Stripe directly. This shim satisfies Metro's platform-specific
 * module resolution so the app bundle doesn't error on web builds.
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
  throw new Error('[IAP] Use Stripe on web — IAP not applicable.');
}

export async function purchaseIAP(_productId: IAPProductId, _accountId?: string): Promise<IAPPurchaseResult> {
  throw new Error('[IAP] Use Stripe on web — IAP not applicable.');
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  return [];
}

export async function finishIAP(_transactionId: string): Promise<void> {}

export async function openStoreSubscriptions(): Promise<void> {}

/** False on web — Stripe is used instead. */
export const IAP_REQUIRED = false;
