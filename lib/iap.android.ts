/**
 * Play Billing membership purchases. iOS uses StoreKit. Web uses Stripe.
 * Product ids must exist in Play Console before a purchase sheet can open.
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

type PlaySubscription = {
  id: string;
  title: string;
  description: string;
  price?: number | null;
  displayPrice: string;
  currency: string;
  subscriptionOfferDetailsAndroid?: {
    offerToken?: string;
    pricingPhases?: { pricingPhaseList?: { priceAmountMicros?: string }[] };
  }[];
  subscriptionOffers?: {
    offerTokenAndroid?: string | null;
    pricingPhasesAndroid?: { pricingPhaseList?: { priceAmountMicros?: string }[] };
  }[];
};

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

function firstFreeMicros(phases?: { priceAmountMicros?: string }[]): boolean {
  return phases?.[0]?.priceAmountMicros === '0';
}

function offerToken(product: PlaySubscription): string | null {
  const details = product.subscriptionOfferDetailsAndroid ?? [];
  const detail = details.find((offer) => offer.offerToken && firstFreeMicros(offer.pricingPhases?.pricingPhaseList))
    ?? details.find((offer) => offer.offerToken);
  if (detail?.offerToken) return detail.offerToken;
  const offers = product.subscriptionOffers ?? [];
  const offer = offers.find((item) => item.offerTokenAndroid && firstFreeMicros(item.pricingPhasesAndroid?.pricingPhaseList))
    ?? offers.find((item) => item.offerTokenAndroid);
  return offer?.offerTokenAndroid ?? null;
}

function remember(purchase: Purchase): IAPPurchaseResult {
  if (!MEMBERSHIP_IDS.has(purchase.productId)) {
    throw new Error('Play Billing returned a product that is not a HomeCookedPlate membership.');
  }
  if (purchase.purchaseState === 'pending') {
    throw new Error('The Play purchase is still pending.');
  }
  if ('isSuspendedAndroid' in purchase && purchase.isSuspendedAndroid) {
    throw new Error('The Play subscription is suspended.');
  }
  if (!purchase.purchaseToken) {
    throw new Error('Play Billing did not return a purchase token.');
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

async function loadSubscriptions(): Promise<PlaySubscription[]> {
  await initConnection();
  const products = await fetchProducts({
    skus: [MEMBERSHIP_MONTHLY_PRODUCT_ID, MEMBERSHIP_ANNUAL_PRODUCT_ID],
    type: 'subs',
  });
  return (products ?? []) as PlaySubscription[];
}

export async function getIAPProducts(): Promise<IAPProduct[]> {
  const products = await loadSubscriptions();
  return products.flatMap((product) => {
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
  const products = await loadSubscriptions();
  const product = products.find((item) => item.id === productId);
  const token = product ? offerToken(product) : null;
  if (!token) {
    throw new Error('Play Billing has no subscription offer for this membership.');
  }
  try {
    const result = await requestPurchase({
      request: {
        google: {
          skus: [productId],
          ...(accountId ? { obfuscatedAccountId: accountId } : {}),
          subscriptionOffers: [{ sku: productId, offerToken: token }],
        },
      },
      type: 'subs',
    });
    const purchase = Array.isArray(result) ? result[0] : result;
    if (!purchase) {
      throw new Error('Play Billing did not return a purchase.');
    }
    return remember(purchase);
  } catch (error) {
    if (isCancel(error)) throw cancelledError();
    throw error;
  }
}

export async function restoreIAPPurchases(): Promise<IAPPurchaseResult[]> {
  await initConnection();
  const purchases = await getAvailablePurchases();
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
