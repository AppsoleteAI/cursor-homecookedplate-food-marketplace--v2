import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { useStripe } from '@/lib/stripe';
import type { ShopName } from '@/backend/lib/shop-catalog';
import { fulfillmentIsDelivery } from '@/backend/lib/delivery-fee';
import type { ShopFulfillment } from '@/backend/lib/shop-fulfillment';

type ShopLine = { productId: string; quantity: number };

const OFFERING_OWNER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function offeringOwnerId(fulfillment: ShopFulfillment): string | undefined {
  const raw = 'cookId' in fulfillment ? fulfillment.cookId
    : 'truckId' in fulfillment ? fulfillment.truckId
    : 'companyId' in fulfillment ? fulfillment.companyId
    : 'placeId' in fulfillment ? fulfillment.placeId
    : undefined;
  return raw && OFFERING_OWNER.test(raw) ? raw : undefined;
}

export function useShopCardPayment() {
  const stripe = useStripe();
  const utils = trpc.useUtils();
  const createCheckout = trpc.payments.createShopCheckout.useMutation();
  const confirmPayment = trpc.payments.confirmShopPayment.useMutation();
  const abandonShop = trpc.payments.abandonShopOrder.useMutation();
  const [charging, setCharging] = useState(false);

  const chargeShop = useCallback(async (shop: ShopName, lines: ShopLine[], fulfillment: ShopFulfillment, sellerAccountId?: string) => {
    if (fulfillment.shop !== shop) {
      throw new Error('This handoff does not match the shop.');
    }
    setCharging(true);
    try {
      const explicitSeller = sellerAccountId && OFFERING_OWNER.test(sellerAccountId) ? sellerAccountId : undefined;
      const sellerId = explicitSeller ?? offeringOwnerId(fulfillment);
      const created = await createCheckout.mutateAsync({
        shop,
        lines,
        ...(sellerId ? { sellerId } : {}),
        deliver: fulfillmentIsDelivery(fulfillment),
        ...(Platform.OS === 'web' && typeof window !== 'undefined'
          ? { webOrigin: window.location.origin, returnPath: window.location.pathname }
          : {}),
      });
      if (Platform.OS === 'web' && created.checkoutUrl && typeof window !== 'undefined') {
        window.sessionStorage.setItem('hcp-shop-return', JSON.stringify({ shop, fulfillment, paymentIntentId: created.paymentIntentId }));
        window.location.assign(created.checkoutUrl);
        return null;
      }
      const initPaymentSheet = stripe?.initPaymentSheet;
      const presentPaymentSheet = stripe?.presentPaymentSheet;
      if (!initPaymentSheet || !presentPaymentSheet || !created.clientSecret) {
        throw new Error('Payment system not available');
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: created.clientSecret,
        merchantDisplayName: 'HomeCookedPlate',
        applePay: { merchantCountryCode: 'US' },
        returnURL: 'homecookedplate://checkout',
      });
      if (initError) {
        await abandonShop.mutateAsync({ orderId: created.orderId }).catch(() => undefined);
        throw new Error(initError.message);
      }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        await abandonShop.mutateAsync({ orderId: created.orderId }).catch(() => undefined);
        if (presentError.code === 'Canceled') return null;
        throw new Error(presentError.message);
      }
      const paid = await confirmPayment.mutateAsync({
        paymentIntentId: created.paymentIntentId,
        fulfillment,
      });
      await utils.payments.listShopOrders.invalidate({ shop });
      return paid;
    } finally {
      setCharging(false);
    }
  }, [abandonShop, confirmPayment, createCheckout, stripe, utils]);

  return { chargeShop, charging };
}

export function useWebShopReturn(shop: ShopName, onPaid: (orderId: string) => void | Promise<void>) {
  const params = useLocalSearchParams<{ webpay?: string; session_id?: string }>();
  const sessionId = typeof params.session_id === 'string' ? params.session_id : '';
  const webReturn = trpc.payments.confirmWebCheckout.useQuery(
    { sessionId },
    { enabled: Platform.OS === 'web' && params.webpay === 'success' && sessionId.length > 0, retry: false }
  );
  const confirmPayment = trpc.payments.confirmShopPayment.useMutation();
  const abandonShop = trpc.payments.abandonShopOrder.useMutation();
  const finished = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    if (Platform.OS !== 'web' || params.webpay !== 'cancel' || typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('hcp-shop-return');
    window.sessionStorage.removeItem('hcp-shop-return');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { paymentIntentId?: string };
      if (saved.paymentIntentId) abandonShop.mutate({ paymentIntentId: saved.paymentIntentId });
    } catch {
      return;
    }
  }, [abandonShop, params.webpay]);

  useEffect(() => {
    if (finished.current || Platform.OS !== 'web' || webReturn.data?.status !== 'succeeded') return;
    const raw = window.sessionStorage.getItem('hcp-shop-return');
    if (!raw) return;
    let saved: { shop?: ShopName; fulfillment?: ShopFulfillment; paymentIntentId?: string };
    try {
      saved = JSON.parse(raw) as { shop?: ShopName; fulfillment?: ShopFulfillment; paymentIntentId?: string };
    } catch {
      return;
    }
    if (saved.shop !== shop || !saved.fulfillment || saved.paymentIntentId !== webReturn.data.paymentIntentId) return;
    finished.current = true;
    confirmPayment.mutateAsync({
      paymentIntentId: webReturn.data.paymentIntentId,
      fulfillment: saved.fulfillment,
    }).then(async (paid) => {
      if (paid?.orderId) await onPaidRef.current(paid.orderId);
      window.sessionStorage.removeItem('hcp-shop-return');
    }).catch(() => {
      finished.current = false;
    });
  }, [confirmPayment, shop, webReturn.data]);
}
