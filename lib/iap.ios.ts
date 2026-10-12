/**
 * StoreKit membership purchases. Android uses Play Billing. Web uses Stripe.
 * Product ids must exist in App Store Connect before a purchase sheet can open.
 */
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  requestPurchase,
  type Purchase,
} from 'expo-iap';

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

const MEMBERSHIP_IDS = new Set<string>([
  MEMBERSHIP_MONTHLY_PRODUCT_ID,
  MEMBERSHIP_ANNUAL_PRODUCT_ID,
]);

const pending = new Map<string, Purchase>();

function isCancel(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'user-cancelled';
}

function cancelledError(): Error {
  const error = new Error('Purchase cancelled');
  (error as Error & { code: string }).code = 'user-cancelled';
  return error;
}

function remember(purchase: Purchase): IAPPurchaseResult {
  if (!MEMBERSHIP_IDS.has(purchase.productId)) {
    throw new Error('StoreKit returned a product that is not a HomeCookedPlate membership.');
  }
  if (purchase.purchaseState === 'pending') {
    throw new Error('The App Store purchase is still pending.');
  }
  if (!purchase.purchaseToken) {
    throw new Error('StoreKit did not return a signed transaction.');
  }
  const transactionId = 'transactionId' in purchase && purchase.transactionId
    ? purchase.transactionId
    : purchase.id;
  pending.set(transactionId, purchase);
  return {
    productId: purchase.productId as IAPProductId,
    transactionId,
    receiptData: purchase.purchaseToken,
  };
}

export async function getIAPProducts(): Promise<IAPProduct[]> {
  await initConnection();
  const products = await fetchProducts({
    skus: [MEMBERSHIP_MONTHLY_PRODUCT_ID, MEMBERSHIP_ANNUAL_PRODUCT_ID],
    type: 'subs',
  });
  return (products ?? []).flatMap((product) => {
    if (!MEMBERSHIP_IDS.has(product.id)) return [];
    return [{
      productId: product.id as IAPProductId,
      title: product.title,
      description: product.description,
      price: product.price == null ? product.displayPrice : String(product.price),
      localizedPrice: product.displayPrice,
      currency: product.currency,
    }];
  });
}

export async function purchaseIAP(productId: IAPProductId, accountId?: string): Promise<IAPPurchaseResult> {
  await initConnection();
  const appAccountToken = accountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)
    ? accountId
    : undefined;
  try {
    const result = await requestPurchase({
      request: { apple: { sku: productId, ...(appAccountToken ? { appAccountToken } : {}) } },
      type: 'subs',
    });
    const purchase = Array.isArray(result) ? result[0] : result;
    if (!purchase) {
      throw new Error('StoreKit did not return a purchase.');
    }
    return remember(purchase);
  } catch (error) {
    if (isCancel(error)) throw cancelledError();
    throw error;
  }
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  await initConnection();
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  return (purchases ?? [])
    .filter((purchase) => MEMBERSHIP_IDS.has(purchase.productId) && !!purchase.purchaseToken)
    .map((purchase) => remember(purchase));
}

export async function finishIAP(transactionId: string): Promise<void> {
  const purchase = pending.get(transactionId);
  if (!purchase) return;
  await initConnection();
  await finishTransaction({ purchase, isConsumable: false });
  pending.delete(transactionId);
}

export const IAP_REQUIRED = true;
