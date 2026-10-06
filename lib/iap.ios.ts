/**
 * In-App Purchase (IAP) — StoreKit Interface
 *
 * APP STORE COMPLIANCE REQUIREMENT (Apple Developer Program License Agreement §3.3.9 / Guideline 3.1.1):
 * "Applications may only use IAP to charge for features or functionality within an Application."
 * The HomeCookedPlate membership subscription ($4.99/mo, $39.99/yr) sold within the iOS
 * app MUST be processed through Apple's StoreKit In-App Purchase system for App Store builds.
 * Stripe-based subscriptions are only permitted for web and Android distribution.
 *
 * ─── INTEGRATION STEPS ───────────────────────────────────────────────────────
 * 1. Install: `npx expo install expo-iap` (or `react-native-purchases` / `react-native-iap`)
 * 2. Create Subscription products in App Store Connect:
 *    - Product ID: "com.rork.homecookedplate.membership.monthly"  → $4.99/month
 *    - Product ID: "com.rork.homecookedplate.membership.annual"   → $39.99/year
 * 3. Enable In-App Purchases capability in Xcode and app.json entitlements
 * 4. Replace the stub implementations below with real StoreKit calls
 * 5. Add server-side receipt validation in backend/trpc/routes/membership/
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Platform routing:
 *  - iOS (App Store):  → this file (StoreKit / IAP)
 *  - Android:          → lib/iap.android.ts (routes to Stripe)
 *  - Web:              → lib/iap.web.ts (routes to Stripe)
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

/**
 * Fetches available subscription products from the App Store.
 * Replace with: `await IAP.getProducts({ skus: [MONTHLY_ID, ANNUAL_ID] })`
 */
export async function getIAPProducts(): Promise<IAPProduct[]> {
  // TODO: Replace with real StoreKit product fetch after installing expo-iap
  // Example:
  // await IAP.initConnection();
  // const products = await IAP.getSubscriptions({ skus: [MONTHLY_ID, ANNUAL_ID] });
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement getIAPProducts().'
  );
}

/**
 * Initiates a StoreKit purchase flow for the given product ID.
 * Replace with: `await IAP.requestSubscription({ sku: productId })`
 */
export async function purchaseIAP(_productId: IAPProductId): Promise<IAPPurchaseResult> {
  // TODO: Replace with real StoreKit purchase flow after installing expo-iap
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement purchaseIAP().'
  );
}

/**
 * Restores previously purchased subscriptions (required by App Store guidelines).
 * Replace with: `await IAP.getAvailablePurchases()`
 */
export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  // TODO: Replace with real StoreKit restore flow after installing expo-iap
  throw new Error(
    '[IAP] StoreKit not yet integrated. Install expo-iap and implement restoreIAPPurchases().'
  );
}

/** True when running on iOS — the only platform requiring StoreKit IAP. */
export const IAP_REQUIRED = true;
